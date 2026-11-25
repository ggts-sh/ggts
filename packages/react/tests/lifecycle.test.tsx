import { startTransition, StrictMode, Suspense, use, useState } from "react";
import { flushSync } from "react-dom";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GGPlot, GeomPoint, type GGPlotProps } from "../src/index.js";

const rows = [
  { x: 1, y: 2 },
  { x: 2, y: 3 },
];
const aes = { x: "x", y: "y" };

describe("React resource lifecycle", () => {
  it("retains the active StrictMode model and releases replaced and unmounted models", async () => {
    const rendered = vi.fn<NonNullable<GGPlotProps["onrender"]>>();
    const chart = (data: typeof rows) => (
      <StrictMode>
        <GGPlot data={data} aes={aes} width={480} height={320} onrender={rendered}>
          <GeomPoint />
        </GGPlot>
      </StrictMode>
    );
    const view = render(chart(rows));
    await act(async () => {
      await Promise.resolve();
    });
    const first = rendered.mock.calls.at(-1)![0];
    expect(first.row(0)).toEqual(rows[0]);
    expect(first.scene.batches.length).toBeGreaterThan(0);

    view.rerender(chart(rows.slice(0, 1)));
    await act(async () => {
      await Promise.resolve();
    });
    const second = rendered.mock.calls.at(-1)![0];
    expect(second).not.toBe(first);
    expect(first.row(0)).toBeNull();
    expect(first.scene.batches).toEqual([]);
    expect(second.row(0)).toEqual(rows[0]);
    expect(second.scene.batches.length).toBeGreaterThan(0);

    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(second.row(0)).toBeNull();
    expect(second.scene.batches).toEqual([]);
  });

  it("reads each registered descriptor once on an equivalent rerender", () => {
    let reads = 0;
    const countedAes = {
      get x() {
        reads++;
        return aes.x;
      },
      y: aes.y,
    };
    const layers = Array.from({ length: 12 }, (_, index) => index);
    const rendered = vi.fn<NonNullable<GGPlotProps["onrender"]>>();
    const chart = () => (
      <GGPlot data={rows} aes={aes} width={480} height={320} onrender={rendered}>
        {layers.map((key) => (
          <GeomPoint aes={countedAes} key={key} />
        ))}
      </GGPlot>
    );
    const view = render(chart());
    rendered.mockClear();
    reads = 0;

    view.rerender(chart());

    expect(rendered).not.toHaveBeenCalled();
    expect(reads).toBe(layers.length);
  });

  it("publishes and paints the committed size after a suspended update is superseded", async () => {
    type DeferredState = { size: number; suspend: boolean };
    let updateUrgent: ((size: number) => void) | undefined;
    let updateDeferred: ((state: DeferredState) => void) | undefined;
    const attemptedSuspension = vi.fn();
    const pending = new Promise<void>(() => {
      // The transition stays suspended until the next update supersedes it.
    });
    const rendered = vi.fn<NonNullable<GGPlotProps["onrender"]>>();

    function Urgent() {
      const [size, setSize] = useState(4);
      updateUrgent = setSize;
      return <GeomPoint size={size} />;
    }
    function Blocker({ suspend }: { suspend: boolean }) {
      if (suspend) {
        attemptedSuspension();
        use(pending);
      }
      return null;
    }
    function Deferred() {
      const [state, setState] = useState({ size: 2, suspend: false });
      updateDeferred = setState;
      return (
        <>
          <GeomPoint size={state.size} />
          <Blocker suspend={state.suspend} />
        </>
      );
    }

    const view = render(
      <GGPlot data={rows} aes={aes} width={480} height={320} onrender={rendered}>
        <Urgent />
        <Suspense fallback={null}>
          <Deferred />
        </Suspense>
      </GGPlot>,
    );
    if (updateUrgent === undefined || updateDeferred === undefined) {
      throw new Error("Both point layers must mount");
    }
    const setUrgent = updateUrgent;
    const setDeferred = updateDeferred;
    act(() => {
      startTransition(() => {
        setDeferred({ size: 3, suspend: true });
      });
    });
    await waitFor(() => {
      expect(attemptedSuspension).toHaveBeenCalled();
    });

    act(() => {
      flushSync(() => {
        setUrgent(8);
      });
    });
    act(() => {
      flushSync(() => {
        setDeferred({ size: 2, suspend: false });
      });
    });

    const sizes = rendered.mock.calls
      .at(-1)?.[1]
      .layers.map((layer): unknown => layer.params?.size);
    expect(sizes).toEqual([8, 2]);
    const radii = Array.from(view.container.querySelectorAll(".gg-points circle"), (point) =>
      point.getAttribute("r"),
    );
    expect(radii).toEqual(["8", "8", "2", "2"]);
  });

  it("disconnects container and canvas theme observers on unmount", async () => {
    const resizeObserve = vi.spyOn(ResizeObserver.prototype, "observe");
    const resizeDisconnect = vi.spyOn(ResizeObserver.prototype, "disconnect");
    const mutationObserve = vi.spyOn(MutationObserver.prototype, "observe");
    const mutationDisconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    try {
      const view = render(
        <div style={{ width: 480 }}>
          <GGPlot data={rows} aes={aes} height={320}>
            <GeomPoint render="canvas" />
          </GGPlot>
        </div>,
      );
      const root = view.container.querySelector<HTMLElement>(".gg-plot-root")!;
      await waitFor(() => {
        expect(root.dataset["ggReady"]).toBe("true");
      });
      const resizeObservers = resizeObserve.mock.contexts.filter(
        (_, index) => resizeObserve.mock.calls[index][0] === root,
      );
      const themeObservers = mutationObserve.mock.contexts.filter(
        (_, index) => mutationObserve.mock.calls[index][0] === document.documentElement,
      );
      expect(resizeObservers.length).toBeGreaterThan(0);
      expect(themeObservers.length).toBeGreaterThan(0);
      view.unmount();
      for (const observer of resizeObservers)
        expect(resizeDisconnect.mock.contexts).toContain(observer);
      for (const observer of themeObservers)
        expect(mutationDisconnect.mock.contexts).toContain(observer);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

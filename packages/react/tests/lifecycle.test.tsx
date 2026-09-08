import { StrictMode } from "react";
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

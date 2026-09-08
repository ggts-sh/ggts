import { StrictMode, useState } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPlotInteraction,
  GGPlot,
  GeomPoint,
  Inspect,
  GuideLegend,
  type GGPlotProps,
} from "../src/index.js";

afterEach(cleanup);

const rows = [
  { x: 1, y: 10, id: "a", group: "A" },
  { x: 2, y: 20, id: "b", group: "B" },
];
const aes = { x: "x", y: "y", color: "group" };

describe("React host parity", () => {
  it("hydrates real SVG without recovery and preserves unique resource IDs", async () => {
    const chart = (
      <>
        <GGPlot data={rows} aes={aes} width={480} height={320}>
          <GeomPoint />
        </GGPlot>
        <GGPlot data={rows} aes={aes} width={480} height={320}>
          <GeomPoint />
        </GGPlot>
      </>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(chart);
    document.body.append(container);
    expect(container.querySelectorAll(".gg-points circle")).toHaveLength(4);
    expect(
      [...container.querySelectorAll<HTMLElement>(".gg-plot-root")].every(
        (root) => root.dataset["ggReady"] === "false",
      ),
    ).toBe(true);
    const recover = vi.fn<(error: unknown) => void>();
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, chart, { onRecoverableError: recover });
      await Promise.resolve();
    });
    expect(recover).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".gg-points circle")).toHaveLength(4);
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    container.remove();
  });

  it("keeps StrictMode charts interactive after effect replay and removes conditional children", async () => {
    const selected = vi.fn<NonNullable<GGPlotProps["onselect"]>>();
    const chart = (show: boolean) => (
      <StrictMode>
        <GGPlot data={rows} aes={aes} width={480} height={320} select="point" onselect={selected}>
          {show && <GeomPoint />}
        </GGPlot>
      </StrictMode>
    );
    const result = render(chart(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.container.querySelectorAll(".gg-points circle")).toHaveLength(2);
    const capture = result.container.querySelector(".gg-capture")!;
    fireEvent.keyDown(capture, { key: "Home" });
    fireEvent.keyDown(capture, { key: "Enter" });
    expect(selected.mock.calls.at(-1)?.[0].keys).toEqual(["b"]);
    result.rerender(chart(false));
    expect(result.container.querySelectorAll(".gg-points circle")).toHaveLength(0);
  });

  it("does not invoke onrender for an equivalent parent rerender", () => {
    const callback = vi.fn<NonNullable<GGPlotProps["onrender"]>>();
    function Parent() {
      const [count, setCount] = useState(0);
      return (
        <>
          <button
            onClick={() => {
              setCount(count + 1);
            }}
          >
            Rerender {count}
          </button>
          <GGPlot data={rows} aes={aes} width={480} height={320} onrender={callback}>
            <GeomPoint alpha={0.7} />
          </GGPlot>
        </>
      );
    }
    const result = render(<Parent />);
    callback.mockClear();
    fireEvent.click(result.getByRole("button", { name: "Rerender 0" }));
    expect(callback).not.toHaveBeenCalled();
  });

  it("inspects and pins by keyboard with custom content and Escape dismissal", () => {
    const inspect = vi.fn<NonNullable<GGPlotProps["oninspect"]>>();
    const result = render(
      <GGPlot data={rows} aes={aes} width={480} height={320} oninspect={inspect}>
        <GeomPoint />
        <Inspect content={(event) => <strong>Record {event.focus.key}</strong>} />
      </GGPlot>,
    );
    const capture = result.container.querySelector(".gg-capture")!;
    fireEvent.keyDown(capture, { key: "Home" });
    expect(result.getByText("Record b")).toBeTruthy();
    fireEvent.keyDown(capture, { key: "Enter" });
    const pinned = inspect.mock.calls.at(-1)?.[0];
    expect(pinned !== undefined && "state" in pinned ? pinned.state : undefined).toBe("pinned");
    fireEvent.keyDown(capture, { key: "Escape" });
    expect(result.queryByText("Record b")).toBeNull();
  });

  it("persists keyboard interval selections in a shared controller", () => {
    const interaction = createPlotInteraction();
    const scope = { keys: "rows", x: "x", y: "y" };
    const result = render(
      <GGPlot
        data={rows}
        aes={aes}
        width={480}
        height={320}
        select="interval"
        tool="select-area"
        interaction={interaction}
        interactionScope={scope}
      >
        <GeomPoint />
      </GGPlot>,
    );
    const capture = result.container.querySelector(".gg-capture")!;
    fireEvent.keyDown(capture, { key: "Enter" });
    fireEvent.keyDown(capture, { key: "ArrowRight" });
    fireEvent.keyDown(capture, { key: "ArrowDown" });
    fireEvent.keyDown(capture, { key: "Enter" });
    expect(interaction.intervals(scope)).toHaveLength(1);
    expect(result.container.querySelector(".gg-interaction-overlay rect")).not.toBeNull();
    fireEvent.keyDown(capture, { key: "Delete" });
    expect(interaction.intervals(scope)).toHaveLength(0);
  });

  it("keeps hidden legend categories available to restore after filtering", () => {
    const result = render(
      <GGPlot data={rows} aes={aes} width={480} height={320}>
        <GeomPoint />
        <GuideLegend channel="color" filter />
      </GGPlot>,
    );
    const category = result.getByRole("checkbox", { name: "Show A" });
    fireEvent.click(category);
    expect(result.container.querySelectorAll(".gg-points circle")).toHaveLength(1);
    const restore = result.getByRole("checkbox", { name: "Show A" });
    expect((restore as HTMLInputElement).checked).toBe(false);
    fireEvent.click(restore);
    expect(result.container.querySelectorAll(".gg-points circle")).toHaveLength(2);
  });
  it("clears pinned inspection when the capability is disabled", () => {
    const oninspect = vi.fn<NonNullable<GGPlotProps["oninspect"]>>();
    const chart = (inspect: boolean) => (
      <GGPlot
        data={rows}
        aes={aes}
        width={480}
        height={320}
        inspect={inspect}
        oninspect={oninspect}
      >
        <GeomPoint />
      </GGPlot>
    );
    const result = render(chart(true));
    const capture = result.container.querySelector(".gg-capture")!;
    fireEvent.keyDown(capture, { key: "Enter" });
    expect(result.container.querySelector(".gg-tooltip-pinned")).not.toBeNull();
    result.rerender(chart(false));
    expect(oninspect.mock.calls.at(-1)?.[0].phase).toBe("clear");
    result.rerender(chart(true));
    expect(result.container.querySelector(".gg-tooltip")).toBeNull();
  });

  it("reconciles controller legend focus and previews without combining categories", async () => {
    const interaction = createPlotInteraction();
    const scope = { keys: "rows" };
    const result = render(
      <GGPlot
        data={rows}
        aes={aes}
        width={480}
        height={320}
        interaction={interaction}
        interactionScope={scope}
      >
        <GeomPoint />
        <GuideLegend channel="color" focus />
      </GGPlot>,
    );
    const a = result.getByRole("button", { name: "Focus A" });
    const b = result.getByRole("button", { name: "Focus B" });
    fireEvent.click(a);
    expect(interaction.emphasized(scope)).toEqual(["a"]);
    fireEvent.pointerEnter(b);
    const circles = result.container.querySelectorAll<SVGCircleElement>(".gg-points circle");
    expect(circles[0].style.opacity).toBe("0.36");
    expect(circles[1].style.opacity).toBe("");
    fireEvent.pointerLeave(b);
    await act(async () => {
      interaction.clearEmphasis({ scope });
      await Promise.resolve();
    });
    expect(a.getAttribute("aria-pressed")).toBe("false");
    expect(result.container.querySelectorAll(".gg-emphasis-ring")).toHaveLength(0);
  });

  it("emits all interval gesture phases and constrains the overlay to the chosen axis", () => {
    const onselect = vi.fn<NonNullable<GGPlotProps["onselect"]>>();
    const result = render(
      <GGPlot
        data={rows}
        aes={aes}
        width={480}
        height={320}
        select={{ type: "interval", mode: "x" }}
        tool="select-area"
        onselect={onselect}
      >
        <GeomPoint />
      </GGPlot>,
    );
    const capture = result.container.querySelector(".gg-capture")!;
    fireEvent.keyDown(capture, { key: "Enter" });
    fireEvent.keyDown(capture, { key: "ArrowRight" });
    fireEvent.keyDown(capture, { key: "Enter" });
    expect(onselect.mock.calls.map(([event]) => event.phase)).toEqual(["start", "change", "end"]);
    const final = onselect.mock.calls.at(-1)![0];
    if (final.mode === "point") throw new Error("expected interval selection");
    expect(final.pixels.y1 - final.pixels.y0).toBeGreaterThan(100);
  });

  it("trains the natural domain while zoomed so reset includes new rows", async () => {
    const interaction = createPlotInteraction();
    const scope = { keys: "rows", x: "x", y: "y" };
    const rendered = vi.fn<NonNullable<GGPlotProps["onrender"]>>();
    const chart = (data: typeof rows) => (
      <GGPlot
        data={data}
        aes={aes}
        width={480}
        height={320}
        zoom
        interaction={interaction}
        interactionScope={scope}
        onrender={rendered}
      >
        <GeomPoint />
      </GGPlot>
    );
    const result = render(chart(rows));
    await act(async () => {
      interaction.setZoom({ x: [1, 1.5] }, { scope });
      await Promise.resolve();
    });
    result.rerender(chart([...rows, { x: 3, y: 30, id: "c", group: "C" }]));
    await act(async () => {
      interaction.resetZoom({ scope });
      await Promise.resolve();
    });
    expect(result.container.querySelectorAll(".gg-points circle")).toHaveLength(3);
    expect(rendered.mock.calls.at(-1)![0].scales.x.domain).toEqual([0.9, 3.1]);
  });
  it("waits for positive container width and becomes unready when hidden again", async () => {
    const chart = (visible: boolean) => (
      <div style={{ display: visible ? "block" : "none", width: 640 }}>
        <GGPlot data={rows} aes={aes} height={320}>
          <GeomPoint />
        </GGPlot>
      </div>
    );
    const result = render(chart(false));
    const root = result.container.querySelector<HTMLElement>(".gg-plot-root");
    if (root === null) throw new Error("missing plot root");
    expect(root.dataset["ggReady"]).toBe("false");
    let onResize: ((width: number) => void) | undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) onResize?.(entry.contentRect.width);
    });
    observer.observe(root);
    const expectVisibility = async (visible: boolean) => {
      const expectedWidth = visible ? 640 : 0;
      const resized = new Promise<void>((resolve) => {
        onResize = (width) => {
          if (width === expectedWidth) resolve();
        };
      });
      result.rerender(chart(visible));
      // WebKit can deliver resize after waitFor's deadline under CI contention.
      // Await the native event, then flush React before checking the public signal.
      await act(async () => {
        await resized;
      });
      expect(root.dataset["ggReady"]).toBe(visible ? "true" : "false");
      expect(root.getBoundingClientRect().width).toBe(expectedWidth);
    };
    try {
      for (const visible of [true, false, true, false]) await expectVisibility(visible);
    } finally {
      observer.disconnect();
    }
  });
});

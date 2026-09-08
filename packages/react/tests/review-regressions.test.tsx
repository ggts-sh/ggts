import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CoordFlip, GGPlot, GeomPoint, GuideLegend, type GGPlotProps } from "../src/index.js";

const rows = [
  { x: 0, y: 0, id: "low", group: "A" },
  { x: 50, y: 50, id: "middle", group: "B" },
  { x: 100, y: 100, id: "high", group: "B" },
];
const aes = { x: "x", y: "y" };

function brushMiddle(container: HTMLElement): void {
  const point = container.querySelectorAll(".gg-points circle")[1];
  if (point === undefined) throw new Error("Missing middle point");
  const capture = container.querySelector(".gg-capture");
  if (capture === null) throw new Error("Missing interaction capture");
  const box = point.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  fireEvent.pointerDown(capture, { clientX: x - 8, clientY: y - 8 });
  fireEvent.pointerMove(capture, { clientX: x + 8, clientY: y + 8 });
  fireEvent.pointerUp(capture, { clientX: x + 8, clientY: y + 8 });
}

describe("flipped axis brushes", () => {
  it.each(["x", "y"] as const)("selects the brushed semantic %s range", (mode) => {
    const onselect = vi.fn<NonNullable<GGPlotProps["onselect"]>>();
    const result = render(
      <GGPlot
        data={rows}
        aes={aes}
        width={480}
        height={320}
        select={{ type: "interval", mode }}
        tool="select-area"
        onselect={onselect}
      >
        <GeomPoint />
        <CoordFlip />
      </GGPlot>,
    );
    brushMiddle(result.container);
    const event = onselect.mock.calls.at(-1)?.[0];
    expect(event?.phase).toBe("end");
    expect(event?.keys).toEqual(["middle"]);
    if (event === undefined || event.mode === "point") throw new Error("Missing interval event");
    if (mode === "x") {
      expect(event.pixels.x1 - event.pixels.x0).toBeGreaterThan(300);
      expect(event.pixels.y1 - event.pixels.y0).toBeCloseTo(16);
    } else {
      expect(event.pixels.y1 - event.pixels.y0).toBeGreaterThan(200);
      expect(event.pixels.x1 - event.pixels.x0).toBeCloseTo(16);
    }
  });

  it.each(["x", "y"] as const)("zooms to the brushed semantic %s range", (mode) => {
    const onzoom = vi.fn<NonNullable<GGPlotProps["onzoom"]>>();
    const result = render(
      <GGPlot
        data={rows}
        aes={aes}
        width={480}
        height={320}
        zoom={{ mode }}
        tool="zoom-area"
        onzoom={onzoom}
      >
        <GeomPoint />
        <CoordFlip />
      </GGPlot>,
    );
    brushMiddle(result.container);
    const event = onzoom.mock.calls.at(-1)?.[0];
    const bounds = event?.domains?.[mode];
    if (bounds === undefined) throw new Error("Missing zoom domain");
    expect(bounds[0]).toBeGreaterThan(0);
    expect(bounds[0]).toBeLessThan(50);
    expect(bounds[1]).toBeGreaterThan(50);
    expect(bounds[1]).toBeLessThan(100);
    expect(event?.domains?.[mode === "x" ? "y" : "x"]).toBeUndefined();
    expect(result.container.querySelectorAll(".gg-points circle")).toHaveLength(1);
  });
});

describe("disabled legend filtering", () => {
  it.each(["prop", "child"] as const)(
    "restores rows when the %s capability is removed",
    (input) => {
      const onlegendfilter = vi.fn<NonNullable<GGPlotProps["onlegendfilter"]>>();
      const oninteraction = vi.fn<NonNullable<GGPlotProps["oninteraction"]>>();
      const chart = (enabled: boolean) => (
        <GGPlot
          data={rows}
          aes={{ ...aes, color: "group" }}
          width={480}
          height={320}
          {...(input === "prop" && enabled ? { legendFilter: true } : {})}
          onlegendfilter={onlegendfilter}
          oninteraction={oninteraction}
        >
          <GeomPoint />
          <GuideLegend channel="color" focus />
          {input === "child" && enabled && <GuideLegend channel="color" filter />}
        </GGPlot>
      );
      const result = render(chart(true));
      fireEvent.click(result.getByRole("checkbox", { name: "Show A" }));
      expect(result.container.querySelectorAll(".gg-points circle")).toHaveLength(2);
      onlegendfilter.mockClear();
      oninteraction.mockClear();
      result.rerender(chart(false));
      expect(result.queryByRole("checkbox", { name: "Show A" })).toBeNull();
      expect(result.container.querySelectorAll(".gg-points circle")).toHaveLength(3);
      expect(onlegendfilter).toHaveBeenCalledExactlyOnceWith({
        type: "legend-filter",
        phase: "clear",
        source: "programmatic",
        clause: null,
      });
      expect(oninteraction).toHaveBeenCalledWith(onlegendfilter.mock.calls[0]?.[0]);
      result.rerender(chart(true));
      expect((result.getByRole("checkbox", { name: "Show A" }) as HTMLInputElement).checked).toBe(
        true,
      );
      expect(result.container.querySelectorAll(".gg-points circle")).toHaveLength(3);
    },
  );
});

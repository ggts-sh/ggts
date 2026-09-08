import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createPlotInteraction, GGPlot, GeomPoint, type GGPlotProps } from "../src/index.js";

const rows = [
  { x: 1, y: 10, id: "a" },
  { x: 1, y: 20, id: "b" },
  { x: 2, y: 30, id: "c" },
];

function hoverFirstMark(container: HTMLElement) {
  const circle = container.querySelector(".gg-points circle");
  if (circle === null) throw new Error("missing point");
  const box = circle.getBoundingClientRect();
  fireEvent.pointerMove(container.querySelector(".gg-capture")!, {
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
  });
}

describe("launch acceptance", () => {
  it("publishes grouped inspection members and axis semantics", () => {
    const oninspect = vi.fn<NonNullable<GGPlotProps["oninspect"]>>();
    const view = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y", color: "id" }}
        width={480}
        height={320}
        inspect={{ mode: "x" }}
        oninspect={oninspect}
      >
        <GeomPoint />
      </GGPlot>,
    );
    hoverFirstMark(view.container);
    const event = oninspect.mock.calls.at(-1)?.[0];
    if (event === undefined || event.phase === "clear") throw new Error("missing inspection");
    expect(event.mode).toBe("x");
    if (event.mode !== "x") throw new Error("expected grouped inspection");
    expect(event.groupMemberCount).toBe(2);
    expect(event.members).toHaveLength(2);
    expect(event.members.map((member) => member.key)).toEqual(expect.arrayContaining(["a", "b"]));
    expect(event.groupTotal).toBeNull();
  });

  it("updates an open canvas data table and replaces backends without stale marks", () => {
    const chart = (backend: "canvas" | "svg", data = rows) => (
      <GGPlot
        data={data}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        layers={[{ geom: "point", render: backend }]}
        ariaLabel="Observations"
      />
    );
    const view = render(chart("svg"));
    expect(view.container.querySelectorAll(".gg-points circle")).toHaveLength(3);
    view.rerender(chart("canvas"));
    expect(view.container.querySelectorAll("canvas.gg-canvas")).toHaveLength(1);
    expect(view.container.querySelectorAll(".gg-points circle")).toHaveLength(0);
    fireEvent.click(view.getByRole("button", { name: "Show data table" }));
    expect(view.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(3);
    view.rerender(chart("canvas", rows.slice(0, 1)));
    expect(view.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(1);
    view.rerender(chart("svg", rows.slice(0, 1)));
    expect(view.container.querySelector("canvas.gg-canvas")).toBeNull();
    expect(view.queryByRole("table")).toBeNull();
    expect(view.container.querySelectorAll(".gg-points circle")).toHaveLength(1);
  });

  it("resolves hover after zoom without rerunning the pipeline", () => {
    const interaction = createPlotInteraction();
    const scope = { keys: "rows", x: "x", y: "y" };
    const onrender = vi.fn<NonNullable<GGPlotProps["onrender"]>>();
    const oninspect = vi.fn<NonNullable<GGPlotProps["oninspect"]>>();
    const view = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        zoom
        inspect
        interaction={interaction}
        interactionScope={scope}
        onrender={onrender}
        oninspect={oninspect}
      >
        <GeomPoint />
      </GGPlot>,
    );
    act(() => {
      interaction.setZoom({ x: [0.5, 1.5] }, { scope });
    });
    expect(onrender.mock.calls.at(-1)?.[1].scales?.x?.domain).toEqual([0.5, 1.5]);
    onrender.mockClear();
    hoverFirstMark(view.container);
    const event = oninspect.mock.calls.at(-1)?.[0];
    if (event === undefined || event.phase === "clear") throw new Error("missing inspection");
    expect(event.focus.key).toBe("a");
    expect(onrender).not.toHaveBeenCalled();
  });
});

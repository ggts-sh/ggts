import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { fireEvent, render } from "@testing-library/react";

import {
  createPlotInteraction,
  GGPlot,
  GeomPoint,
  GeomText,
  GuideLegend,
  Inspect,
} from "../src/index.js";

const scope = { keys: "plot", x: "x", y: "y" };

function rowsOf(n: number, categories = 4) {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    x: i,
    y: (i * 37) % 101,
    group: `g${i % categories}`,
  }));
}

const ids = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => `r${from + i}`);

function center(mark: Element): [number, number] {
  const box = mark.getBoundingClientRect();
  return [box.left + box.width / 2, box.top + box.height / 2];
}

/** Checks on-screen positions, because rings and marks use different coordinate spaces. */
function expectRingsOnRows(container: HTMLElement, className: string, rows: readonly number[]) {
  const marks = [...container.querySelectorAll(".gg-points circle")];
  const rings = [...container.querySelectorAll(`circle.${className}`)].map((ring) => center(ring));
  expect(rings).toHaveLength(rows.length);
  rows.forEach((row, i) => {
    const [x, y] = center(marks[row]);
    expect(Math.abs(rings[i][0] - x)).toBeLessThan(1);
    expect(Math.abs(rings[i][1] - y)).toBeLessThan(1);
  });
}

function ringCount(container: HTMLElement, className: string) {
  return container.querySelectorAll(`.${className}`).length;
}

/** Moves the pointer onto marks. Returns the number of moves that showed a hover ring. */
function hoverAcross(container: HTMLElement, moves: number): number {
  const capture = container.querySelector(".gg-capture")!;
  const marks = [...container.querySelectorAll(".gg-points circle")];
  let hits = 0;
  for (let i = 0; i < moves; i++) {
    const box = marks[Math.floor((i * marks.length) / moves)].getBoundingClientRect();
    act(() => {
      fireEvent.pointerMove(capture, {
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        pointerType: "mouse",
      });
    });
    if (container.querySelector(".gg-hover-ring") !== null) hits += 1;
  }
  return hits;
}

function pressedGroups(container: HTMLElement) {
  return [...container.querySelectorAll('[aria-pressed="true"]')].map(
    (target) => /g\d/.exec(target.getAttribute("aria-label") ?? "")?.[0],
  );
}

describe("selection and emphasis rings", () => {
  function chart(n = 12) {
    const interaction = createPlotInteraction();
    const element = (data = rowsOf(n), width = 480) => (
      <GGPlot
        data={data}
        aes={{ x: "x", y: "y" }}
        width={width}
        height={320}
        identity="id"
        interaction={interaction}
        interactionScope={scope}
      >
        <GeomPoint />
        <Inspect mode="xy" />
      </GGPlot>
    );
    return { interaction, element, view: render(element()) };
  }

  it("follow the selection through set, replace, clear, and set again", () => {
    const { interaction, view } = chart();
    const expectRings = (rows: number[]) => {
      expectRingsOnRows(view.container, "gg-selected-ring", rows);
    };
    expectRings([]);
    act(() => {
      interaction.setSelection(["r1", "r2"], { scope });
    });
    expectRings([1, 2]);
    act(() => {
      interaction.setSelection(["r5"], { scope });
    });
    expectRings([5]);
    act(() => {
      interaction.clearSelection({ scope });
    });
    expectRings([]);
    act(() => {
      interaction.setSelection(["r7"], { scope });
    });
    expectRings([7]);
  });

  it("stay in place while the pointer moves", () => {
    const { interaction, view } = chart();
    act(() => {
      interaction.setSelection(["r3", "r4"], { scope });
    });
    expect(hoverAcross(view.container, 6)).toBeGreaterThan(0);
    expectRingsOnRows(view.container, "gg-selected-ring", [3, 4]);
  });

  it("follow a resize", () => {
    const { interaction, element, view } = chart();
    act(() => {
      interaction.setSelection(["r6"], { scope });
    });
    const ring = view.container.querySelector("circle.gg-selected-ring")!;
    const before = center(ring)[0];
    view.rerender(element(rowsOf(12), 720));
    expectRingsOnRows(view.container, "gg-selected-ring", [6]);
    expect(center(view.container.querySelector("circle.gg-selected-ring")!)[0]).not.toBe(before);
  });

  it("follow new data and drop keys that left it", () => {
    const { interaction, element, view } = chart();
    act(() => {
      interaction.setSelection(["r2", "r9"], { scope });
    });
    const moved = rowsOf(12).map((row) => ({ ...row, y: 100 - row.y }));
    view.rerender(element(moved));
    expectRingsOnRows(view.container, "gg-selected-ring", [2, 9]);
    view.rerender(element(moved.slice(0, 5)));
    expectRingsOnRows(view.container, "gg-selected-ring", [2]);
  });

  it("render selection and emphasis together, each with its own marks", () => {
    const { interaction, view } = chart();
    act(() => {
      interaction.setSelection(["r1"], { scope });
      interaction.setEmphasis(["r2", "r3"], { scope });
    });
    expectRingsOnRows(view.container, "gg-selected-ring", [1]);
    expectRingsOnRows(view.container, "gg-emphasis-ring", [2, 3]);
  });

  it("draw emphasis rings up to the density limit and none above it", () => {
    const { interaction, view } = chart(60);
    act(() => {
      interaction.setEmphasis(ids(0, 48), { scope });
    });
    expect(ringCount(view.container, "gg-emphasis-ring")).toBe(48);
    act(() => {
      interaction.setEmphasis(ids(0, 49), { scope });
    });
    expect(ringCount(view.container, "gg-emphasis-ring")).toBe(0);
    act(() => {
      interaction.setEmphasis(ids(0, 2), { scope });
    });
    expect(ringCount(view.container, "gg-emphasis-ring")).toBe(2);
  });

  it("box a selected label with its glyph extent", () => {
    const interaction = createPlotInteraction();
    const view = render(
      <GGPlot
        data={rowsOf(4).map((row) => ({ ...row, label: row.id }))}
        aes={{ x: "x", y: "y", label: "label" }}
        width={480}
        height={320}
        identity="id"
        interaction={interaction}
        interactionScope={scope}
      >
        <GeomText />
      </GGPlot>,
    );
    act(() => {
      interaction.setSelection(["r1"], { scope });
    });
    const box = view.container.querySelector("rect.gg-selected-ring");
    expect(box).not.toBeNull();
    expect(Number(box!.getAttribute("width"))).toBeGreaterThan(0);
  });

  it("render no overlay when a selection matches no candidate", () => {
    const { interaction, view } = chart();
    expect(view.container.querySelector(".gg-interaction-overlay")).toBeNull();
    act(() => {
      interaction.setSelection(["not-a-row"], { scope });
    });
    expect(view.container.querySelector(".gg-interaction-overlay")).toBeNull();
    act(() => {
      interaction.setSelection(["r1"], { scope });
    });
    expect(view.container.querySelector(".gg-interaction-overlay")).not.toBeNull();
  });
});

describe("pressed legend entry", () => {
  function legend() {
    const interaction = createPlotInteraction();
    const view = render(
      <GGPlot
        data={rowsOf(12, 3)}
        aes={{ x: "x", y: "y", color: "group" }}
        width={480}
        height={320}
        identity="id"
        interaction={interaction}
        interactionScope={scope}
      >
        <GeomPoint />
        <GuideLegend channel="color" focus />
      </GGPlot>,
    );
    const target = (name: string) =>
      view.getAllByRole("button", {
        name: new RegExp(`${name} \\(.*legend\\)`),
      });
    return { interaction, view, target };
  }
  const group = (index: number) =>
    rowsOf(12, 3).flatMap((row) => (row.group === `g${index}` ? [row.id] : []));

  it("moves between the first and last entries and clears on a second click", () => {
    const { view, target } = legend();
    const pressed = () => pressedGroups(view.container);
    fireEvent.click(target("g0")[0]);
    expect(pressed()).toEqual(["g0"]);
    fireEvent.click(target("g2")[0]);
    expect(pressed()).toEqual(["g2"]);
    fireEvent.click(target("g2")[0]);
    expect(pressed()).toEqual([]);
  });

  it("follows controller keys only when they equal an entry's keys", () => {
    const { interaction, view } = legend();
    const pressed = () => pressedGroups(view.container);
    act(() => {
      interaction.setEmphasis(group(1), { scope });
    });
    expect(pressed()).toEqual(["g1"]);
    act(() => {
      interaction.setEmphasis(group(1).slice(1), { scope });
    });
    expect(pressed()).toEqual([]);
    act(() => {
      interaction.setEmphasis([...group(1), "r0"], { scope });
    });
    expect(pressed()).toEqual([]);
    act(() => {
      const [first, ...rest] = group(2);
      interaction.setEmphasis([...rest, first], { scope });
    });
    expect(pressed()).toEqual(["g2"]);
    act(() => {
      interaction.setEmphasis([...group(0), ...group(0)], { scope });
    });
    expect(pressed()).toEqual(["g0"]);
    act(() => {
      interaction.clearEmphasis({ scope });
    });
    expect(pressed()).toEqual([]);
  });
});

describe("work on a pointer move", () => {
  const CANDIDATES = 1000;
  const KEYS = 500;
  const MOVES = 12;

  function hoverChart(selected: readonly string[], emphasized: readonly string[] = []) {
    const interaction = createPlotInteraction();
    if (selected.length > 0) interaction.setSelection(selected, { scope });
    if (emphasized.length > 0) interaction.setEmphasis(emphasized, { scope });
    const view = render(
      <GGPlot
        data={rowsOf(CANDIDATES)}
        aes={{ x: "x", y: "y" }}
        width={800}
        height={500}
        identity="id"
        select="point"
        interaction={interaction}
        interactionScope={scope}
      >
        <GeomPoint />
        <Inspect mode="xy" />
      </GGPlot>,
    );
    return view;
  }

  function longMaps(run: () => void): number {
    const maps = vi.spyOn(Array.prototype, "map");
    run();
    const long = maps.mock.contexts.filter((list) => (list as unknown[]).length >= KEYS).length;
    maps.mockRestore();
    return long;
  }

  it.each([
    ["no selection", [], []],
    ["a large selection", ids(0, KEYS), []],
    ["a large emphasis", [], ids(0, KEYS)],
  ] satisfies [string, string[], string[]][])(
    "maps no long list with %s",
    (_name, selected, emphasized) => {
      const view = hoverChart(selected, emphasized);
      let hits = 0;
      const long = longMaps(() => {
        hits = hoverAcross(view.container, MOVES);
      });
      expect(hits).toBeGreaterThan(0);
      expect(long).toBe(0);
    },
  );

  it("builds no key set with a large selection", () => {
    const view = hoverChart(ids(0, KEYS));
    const adds = vi.spyOn(Set.prototype, "add");
    const hits = hoverAcross(view.container, MOVES);
    const addsPerMove = adds.mock.calls.length / MOVES;
    adds.mockRestore();
    expect(hits).toBeGreaterThan(0);
    // One walk of the selection is 500 adds. A move used to do two, and now does none.
    expect(addsPerMove).toBeLessThan(KEYS);
  });

  it("builds no key set for each legend entry when an entry is pressed", () => {
    const view = render(
      <GGPlot
        data={rowsOf(CANDIDATES, 8)}
        aes={{ x: "x", y: "y", color: "group" }}
        width={800}
        height={500}
        identity="id"
        legendFocus
      >
        <GeomPoint />
        <Inspect mode="xy" />
      </GGPlot>,
    );
    fireEvent.click(view.getByRole("button", { name: /g7 \(.*legend\)/ }));
    expect(pressedGroups(view.container)).toEqual(["g7"]);
    const adds = vi.spyOn(Set.prototype, "add");
    const hits = hoverAcross(view.container, MOVES);
    const addsPerMove = adds.mock.calls.length / MOVES;
    adds.mockRestore();
    expect(hits).toBeGreaterThan(0);
    // One walk of the pressed keys is 125 adds. A move used to do many, and now does none.
    expect(addsPerMove).toBeLessThan(125);
    expect(pressedGroups(view.container)).toEqual(["g7"]);
  });
});

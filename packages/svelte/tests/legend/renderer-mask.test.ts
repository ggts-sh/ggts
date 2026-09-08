import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";

import type { BatchInteractionMask, GeometryBatch, ThemeTokens } from "@ggts-sh/core";

import BatchFocusHarness from "../fixtures/BatchFocusHarness.svelte";
import { render } from "../helpers/render.js";

const theme = fromPartial<ThemeTokens>({
  ink: "#111111",
  accent: "#3366ff",
  paper: "#ffffff",
  interactionMuted: 0.25,
  fontFamily: "sans-serif",
});

const focusFirst: BatchInteractionMask = {
  primitiveCount: 2,
  focusedCount: 1,
  isFocused: (index) => index === 0,
};

function renderBatch(
  batch: GeometryBatch,
  opts?: {
    focusMask?: BatchInteractionMask | null;
    focusable?: boolean;
    markLabel?: (row: number) => string;
  },
): SVGElement[] {
  const { container } = render(BatchFocusHarness, {
    batch,
    theme,
    focusMask: opts?.focusMask === undefined ? focusFirst : opts.focusMask,
    focusable: opts?.focusable ?? false,
    markLabel: opts?.markLabel,
  });
  return [...container.querySelectorAll<SVGElement>(".gg-batch > *")];
}

describe("SVG batch focus masks", () => {
  it("reorders and mutes rect primitives", () => {
    const elements = renderBatch({
      kind: "rects",
      layerIndex: 0,
      panelIndex: 0,
      rects: Float32Array.from([1, 2, 3, 4, 11, 12, 13, 14]),
      rowIndex: Uint32Array.from([0, 1]),
      fill: "#3366ff",
      alpha: 1,
    });

    expect(elements.map((element) => element.getAttribute("x"))).toEqual(["11", "1"]);
    expect(elements.map((element) => element.dataset["ggFocused"])).toEqual(["false", "true"]);
    expect(elements[0].getAttribute("opacity")).toBe("0.25");
    expect(elements[1].getAttribute("opacity")).toBeNull();
  });

  it("reorders and mutes segment primitives", () => {
    const elements = renderBatch({
      kind: "segments",
      layerIndex: 0,
      panelIndex: 0,
      segments: Float32Array.from([1, 2, 3, 4, 11, 12, 13, 14]),
      rowIndex: Uint32Array.from([0, 1]),
      stroke: "#111111",
      linewidth: 1,
      alpha: 1,
    });

    expect(elements.map((element) => element.getAttribute("x1"))).toEqual(["11", "1"]);
    expect(elements.map((element) => element.dataset["ggFocused"])).toEqual(["false", "true"]);
    expect(elements[0].getAttribute("opacity")).toBe("0.25");
  });

  it("reorders and mutes glyph primitives", () => {
    const elements = renderBatch({
      kind: "glyphs",
      layerIndex: 0,
      panelIndex: 0,
      positions: Float32Array.from([1, 2, 11, 12]),
      rowIndex: Uint32Array.from([0, 1]),
      texts: ["focused", "muted"],
      color: "#111111",
      size: 11,
      anchor: "middle",
      alpha: 1,
    });

    expect(elements.map((element) => element.textContent)).toEqual(["muted", "focused"]);
    expect(elements.map((element) => element.dataset["ggFocused"])).toEqual(["false", "true"]);
    expect(elements[0].getAttribute("opacity")).toBe("0.25");
  });

  it("reorders and mutes path primitives under a focus mask", () => {
    const elements = renderBatch({
      kind: "paths",
      layerIndex: 0,
      panelIndex: 0,
      positions: Float32Array.from([0, 0, 10, 10, 20, 0, 30, 10]),
      rowIndex: Uint32Array.from([0, 0, 1, 1]),
      pathOffsets: Uint32Array.from([0, 2, 4]),
      strokes: ["#111111", "#222222"],
      linewidth: 1.5,
      alpha: 1,
      curve: "linear",
    });

    expect(elements).toHaveLength(2);
    expect(elements.map((element) => element.dataset["ggFocused"])).toEqual(["false", "true"]);
    expect(elements[0].getAttribute("opacity")).toBe("0.25");
    expect(elements[0].getAttribute("stroke-width")).toBe("1.5");
    expect(elements[1].getAttribute("opacity")).toBeNull();
  });
});

describe("SVG batch mark variants", () => {
  it("renders square and triangle point shapes with the expected SVG tags", () => {
    const square = renderBatch(
      {
        kind: "points",
        layerIndex: 0,
        panelIndex: 0,
        positions: Float32Array.from([10, 20]),
        rowIndex: Uint32Array.from([0]),
        size: 4,
        alpha: 1,
        shape: "square",
        fill: "#ff0000",
      },
      { focusMask: null },
    );
    expect(square).toHaveLength(1);
    expect(square[0].tagName.toLowerCase()).toBe("rect");
    expect(square[0].getAttribute("width")).toBe("8");
    expect(square[0].getAttribute("height")).toBe("8");
    expect(square[0].getAttribute("fill")).toBe("#ff0000");
    expect(Object.hasOwn(square[0].dataset, "ggFocused")).toBe(false);

    const triangle = renderBatch(
      {
        kind: "points",
        layerIndex: 0,
        panelIndex: 0,
        positions: Float32Array.from([15, 25]),
        rowIndex: Uint32Array.from([0]),
        size: 5,
        alpha: 1,
        shape: "triangle",
        fill: "#00ff00",
      },
      { focusMask: null },
    );
    expect(triangle).toHaveLength(1);
    expect(triangle[0].tagName.toLowerCase()).toBe("path");
    expect(triangle[0].getAttribute("d")).toMatch(/^M/);
    expect(triangle[0].getAttribute("fill")).toBe("#00ff00");
  });

  it("makes point marks keyboard-focusable with custom or default aria labels", () => {
    const labeled = renderBatch(
      {
        kind: "points",
        layerIndex: 2,
        panelIndex: 0,
        positions: Float32Array.from([1, 2, 3, 4]),
        rowIndex: Uint32Array.from([3, 7]),
        size: 3,
        alpha: 1,
        shape: "circle",
        fill: null,
        colors: ["#aaa", "#bbb"],
      },
      {
        focusMask: null,
        focusable: true,
        markLabel: (row) => `row-${row}`,
      },
    );
    expect(labeled).toHaveLength(2);
    expect(labeled[0].getAttribute("tabindex")).toBe("0");
    expect(labeled[0].getAttribute("role")).toBe("img");
    expect(labeled[0].getAttribute("aria-label")).toBe("row-3");
    expect(labeled[0].dataset["ggLayer"]).toBe("2");
    expect(labeled[0].dataset["ggRow"]).toBe("3");
    expect(labeled[1].getAttribute("aria-label")).toBe("row-7");

    const defaultLabel = renderBatch(
      {
        kind: "points",
        layerIndex: 0,
        panelIndex: 0,
        positions: Float32Array.from([5, 6]),
        rowIndex: Uint32Array.from([4]),
        size: 2,
        alpha: 1,
        shape: "circle",
        fill: "#111",
      },
      { focusMask: null, focusable: true },
    );
    expect(defaultLabel[0].getAttribute("aria-label")).toBe("data point 5");
  });

  it("skips focus attrs for synthetic NO_ROW marks even when focusable", () => {
    const elements = renderBatch(
      {
        kind: "points",
        layerIndex: 0,
        panelIndex: 0,
        positions: Float32Array.from([1, 1, 2, 2]),
        rowIndex: Uint32Array.from([0xffffffff, 1]),
        size: 2,
        alpha: 1,
        shape: "circle",
        fill: "#111",
      },
      { focusMask: null, focusable: true },
    );
    expect(elements[0].hasAttribute("tabindex")).toBe(false);
    expect(elements[0].hasAttribute("aria-label")).toBe(false);
    expect(elements[1].getAttribute("tabindex")).toBe("0");
    expect(elements[1].getAttribute("aria-label")).toBe("data point 2");
  });

  it("omits empty path subpaths and strokes rects with default stroke width", () => {
    const paths = renderBatch(
      {
        kind: "paths",
        layerIndex: 0,
        panelIndex: 0,
        // Empty first subpath (offsets 0..0), real second subpath (0..2 points).
        positions: Float32Array.from([0, 0, 10, 10]),
        rowIndex: Uint32Array.from([0, 0]),
        pathOffsets: Uint32Array.from([0, 0, 2]),
        strokes: [null, "#abcdef"],
        linewidth: 2,
        alpha: 0.5,
        curve: "linear",
      },
      { focusMask: null },
    );
    expect(paths).toHaveLength(1);
    expect(paths[0].getAttribute("stroke")).toBe("#abcdef");
    expect(paths[0].getAttribute("d")).toMatch(/^M/);
    expect(paths[0].closest(".gg-batch")?.getAttribute("opacity")).toBe("0.5");

    const rects = renderBatch(
      {
        kind: "rects",
        layerIndex: 0,
        panelIndex: 0,
        rects: Float32Array.from([1, 2, 3, 4]),
        rowIndex: Uint32Array.from([0]),
        fill: null,
        stroke: "#333333",
        // strokeWidth omitted → Batch defaults to 1 when stroke is present.
        alpha: 1,
      },
      { focusMask: null },
    );
    expect(rects).toHaveLength(1);
    expect(rects[0].getAttribute("stroke")).toBe("#333333");
    expect(rects[0].getAttribute("stroke-width")).toBe("1");
  });
});

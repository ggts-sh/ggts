/**
 * circle-open point shape — an unfilled ring (ggplot2 shape 1) for marking
 * records/extrema over filled scatter clouds.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";

import { pointShapeGeometry } from "../src/mark-style.ts";
import { renderToSVGString } from "../src/render-svg-full.ts";

describe("point shape circle-open", () => {
  it("resolves to a stroked circle geometry with no fill", () => {
    const geometry = pointShapeGeometry("circle-open", 10, 20, 3);
    expect(geometry).toMatchObject({ kind: "circle", mode: "stroke", cx: 10, cy: 20, r: 3 });
    if (geometry.kind === "circle" && geometry.mode === "stroke") {
      expect(geometry.strokeWidth).toBeGreaterThanOrEqual(1);
    }
  });

  it("renders an unfilled, stroked circle in SVG output", () => {
    const svg = renderToSVGString(
      gg([{ x: 1, y: 1 }], aes({ x: "x", y: "y" }))
        .geomPoint({
          shape: "circle-open",
          size: 3.5,
          aes: { color: { value: "#c53030" } },
        })
        .spec(),
      { width: 200, height: 100 },
    );
    expect(svg).toContain("gg-shape-circle-open");
    const mark = svg.match(/<circle[^>]*gg-shape-circle-open[^>]*\/>/);
    expect(mark).not.toBeNull();
    expect(mark![0]).toContain('fill="none"');
    expect(mark![0]).toContain('stroke="#c53030"');
    expect(mark![0]).toMatch(/stroke-width="[1-9]/);
  });

  it("hits like a circle of the same size for interaction candidates", () => {
    // Rings are visible marks; the pointer should find them.
    const geometry = pointShapeGeometry("circle-open", 0, 0, 4);
    expect(geometry.kind).toBe("circle");
  });
});

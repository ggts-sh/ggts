/**
 * facet_grid(space = ...) (#1825): column widths and row heights follow the
 * length of each panel's free position scale, so one data unit (or one band
 * category) has the same physical size in every panel.
 */
import { aes, gg, type FacetInput } from "@ggts-sh/spec";
import { describe, expect, it } from "bun:test";

import { runPipeline } from "../../src/pipeline.ts";

import { size } from "./fixtures.ts";

const dots = [
  { group: "A", item: "A1", n: 7 },
  { group: "A", item: "A2", n: 4 },
  { group: "B", item: "B1", n: 9 },
  { group: "B", item: "B2", n: 3 },
  { group: "B", item: "B3", n: 6 },
];

function panels(facet: FacetInput, rows: readonly Record<string, unknown>[] = dots) {
  const x = facet.rows === undefined ? "item" : "n";
  const y = facet.rows === undefined ? "n" : "item";
  return runPipeline(gg(rows, aes({ x, y })).geomPoint().facet(facet).spec(), size).scene.panels;
}

describe("facet grid space (#1825)", () => {
  it("keeps equal panel widths without space", () => {
    const [a, b] = panels({ cols: "group", scales: "free_x" });
    expect(a!.width).toBeCloseTo(b!.width, 6);
  });

  it("sizes band columns by category count under space free_x", () => {
    const [a, b] = panels({ cols: "group", scales: "free_x", space: "free_x" });
    expect(b!.width / a!.width).toBeCloseTo(3 / 2, 6);
    // Same total panel width as the equal-width layout, and no overlap.
    const [fa, fb] = panels({ cols: "group", scales: "free_x" });
    expect(a!.width + b!.width).toBeCloseTo(fa!.width + fb!.width, 6);
    expect(b!.x).toBeGreaterThan(a!.x + a!.width);
  });

  it("sizes band rows by category count under space free_y", () => {
    const [a, b] = panels({ rows: "group", scales: "free_y", space: "free_y" });
    expect(b!.height / a!.height).toBeCloseTo(3 / 2, 6);
    expect(b!.y).toBeGreaterThan(a!.y + a!.height);
  });

  it("sizes continuous columns by the expanded span of each x scale", () => {
    const rows = [
      { g: "short", x: 0, y: 1 },
      { g: "short", x: 10, y: 2 },
      { g: "wide", x: 0, y: 1 },
      { g: "wide", x: 30, y: 2 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({ cols: "g", scales: "free_x", space: "free_x" })
        .spec(),
      size,
    );
    const [a, b] = model.scene.panels;
    const span = (p: number) => {
      const scale = model.scales.panels[p]!.x;
      if (scale.type === "band") throw new Error("expected a continuous x");
      return scale.transformedDomain[1] - scale.transformedDomain[0];
    };
    expect(b!.width / a!.width).toBeCloseTo(span(1) / span(0), 6);
  });

  it("is a no-op when the matching scales are fixed", () => {
    const [a, b] = panels({ cols: "group", space: "free_x" });
    expect(a!.width).toBeCloseTo(b!.width, 6);
  });

  it("does not change heights under space free_x", () => {
    const [a, b] = panels({ cols: "group", scales: "free", space: "free_x" });
    expect(a!.height).toBeCloseTo(b!.height, 6);
  });
});

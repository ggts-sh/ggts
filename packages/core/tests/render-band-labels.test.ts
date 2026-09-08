import { describe, expect, it } from "bun:test";

import { renderToSVGString } from "../src/render-svg-full.ts";
import type { SpecInput } from "@ggts-sh/spec";

const rows = [
  { category: "Resolución", count: 9000 },
  { category: "Corrección (errores o erratas)", count: 3200 },
  { category: "Sentencia", count: 2800 },
  { category: "Orden", count: 2500 },
  { category: "Otro", count: 900 },
];
const spec: SpecInput = {
  data: { values: rows },
  layers: [{ geom: "col", aes: { x: { field: "category" }, y: { field: "count" } } }],
  labs: { x: "Tipo de resolución" },
};

describe("band label rendering (#387)", () => {
  it("wraps long categorical x labels into <tspan> lines at a readable width", () => {
    const svg = renderToSVGString(spec, { width: 560, height: 300 });
    // The longest label wraps into two tspan lines; no rotation on the x ticks.
    expect(svg).toContain("<tspan");
    expect(svg).not.toContain("rotate(-45)");
    // x ticks are not rotated (only the y-axis title carries rotate(-90)).
    const xTickRotate = svg.match(/translate\([\d.]+,0\)[^>]*>[^<]*<text transform="translate\(0/);
    expect(xTickRotate).toBeNull();
  });

  it("rotates x labels at narrow width and pushes the axis title below them", () => {
    const svg = renderToSVGString(spec, { width: 240, height: 300 });
    // Prefer −45° when parallel baselines clear (not −90 merely because an AABB
    // overlaps the neighbour column). Still rotated + end-anchored.
    expect(svg).toContain('rotate(-45)" text-anchor="end"');
    expect(svg).not.toContain('rotate(-90)" text-anchor="end"');
    // The x-axis title clears the rotated label band (offset well past the fixed 32).
    const title = svg.match(/class="gg-axis-title"[^>]*y="([\d.]+)"/);
    expect(title).not.toBeNull();
  });

  it("wrap-then−45° emits multi-line rotated tspans for the multi-word outlier (#637)", () => {
    // 240px: plain wrap fails; hybrid balances the long label onto 2 lines at −45°.
    const svg = renderToSVGString(spec, { width: 240, height: 300 });
    expect(svg).toContain('rotate(-45)" text-anchor="end"');
    // Hybrid path: rotated <text> contains <tspan> children (not a single glyph run).
    const rotatedWithTspans = svg.match(/rotate\(-45\)"[^>]*>[\s\S]*?<tspan[\s\S]*?<\/text>/);
    expect(rotatedWithTspans).not.toBeNull();
    expect(svg).toContain("Corrección");
    expect(svg).toContain("(errores o erratas)");
    expect(svg).not.toContain("Corrección (errores o err…");
  });

  it("keeps single-line rendering unchanged for short labels", () => {
    const shortSpec: SpecInput = {
      data: {
        values: [
          { c: "IT", n: 1 },
          { c: "HR", n: 2 },
          { c: "Ops", n: 3 },
        ],
      },
      layers: [{ geom: "col", aes: { x: { field: "c" }, y: { field: "n" } } }],
    };
    const svg = renderToSVGString(shortSpec, { width: 480, height: 300 });
    expect(svg).not.toContain("<tspan");
    expect(svg).not.toContain("rotate(-45)");
    expect(svg).not.toContain('rotate(-90)" text-anchor="end"');
  });
});

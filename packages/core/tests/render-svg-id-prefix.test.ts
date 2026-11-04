/**
 * #1902 — SVG ids are document-scoped. `url(#gg-clip-0)` resolves against the
 * whole document, so two renders inlined in one HTML page share their clip
 * path: every chart after the first is clipped to the first chart's panel
 * rect, silently losing marks. `idPrefix` namespaces each render's ids.
 */
import { describe, expect, it } from "bun:test";

import { aes, fillPaintLinear, gg, glow } from "@ggts-sh/spec";

import { renderToSVGString } from "../src/render-svg-full.ts";

function ids(svg: string): string[] {
  return [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
}

function refs(svg: string): string[] {
  return [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]!);
}

/** Every id unique, prefixed, and every url(#…) reference resolvable inside. */
function expectSelfContained(svg: string, scope: string): void {
  const defined = ids(svg);
  expect(defined.length).toBeGreaterThan(0);
  expect(new Set(defined).size).toBe(defined.length);
  for (const id of defined) expect(id.startsWith(scope)).toBe(true);
  for (const ref of refs(svg)) expect(defined).toContain(ref);
}

const rows = [
  { x: 0, y: 0 },
  { x: 1, y: 10 },
];

function lineSpec() {
  return gg(rows, aes({ x: "x", y: "y" }))
    .geomLine({ linewidth: 4 })
    .spec();
}

/** Gradient + glow paint, left-side facet strips, and a continuous ramp legend. */
function idFamilySpecs() {
  const paint = gg(
    { x: [1, 2, 3], lo: [1, 2, 1.5], hi: [3, 4, 3.5] },
    aes({ x: "x", ymin: "lo", ymax: "hi" }),
  )
    .geomRibbon({
      fillPaint: fillPaintLinear({
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 1,
        stops: [
          { offset: 0, color: "#1f77b4" },
          { offset: 1, color: "#ff7f0e" },
        ],
        fallback: "#1f77b4",
      }),
      glow: glow({ color: "#00aaff", radius: 6, opacity: 0.4 }),
    })
    .spec();
  const strips = gg(
    [
      { x: 1, y: 1, g: "a" },
      { x: 2, y: 2, g: "b" },
    ],
    aes({ x: "x", y: "y" }),
  )
    .geomPoint()
    .facet({ wrap: "g", ncol: 1, strip: { position: "left" } })
    .spec();
  const ramp = gg(
    [
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 2, z: 2 },
    ],
    aes({ x: "x", y: "y", color: "z" }),
  )
    .geomPoint()
    .spec();
  return { paint, strips, ramp };
}

describe("renderToSVGString idPrefix (#1902)", () => {
  it("keeps two inlined charts on their own clip paths", () => {
    const a = renderToSVGString(lineSpec(), { width: 400, height: 150, idPrefix: "chart-a" });
    const b = renderToSVGString(lineSpec(), { width: 400, height: 400, idPrefix: "chart-b" });

    expect(ids(a)).toEqual(["chart-a-gg-clip-0"]);
    expect(ids(b)).toEqual(["chart-b-gg-clip-0"]);
    expect(refs(a)).toEqual(["chart-a-gg-clip-0"]);
    expect(refs(b)).toEqual(["chart-b-gg-clip-0"]);
    // Each clip still carries its own panel size (the reported symptom).
    expect(a).toContain('<clipPath id="chart-a-gg-clip-0"><rect width="352" height="102"/>');
    expect(b).toContain('<clipPath id="chart-b-gg-clip-0"><rect width="352" height="352"/>');
    expectSelfContained(a, "chart-a-");
    expectSelfContained(b, "chart-b-");
  });

  it("namespaces paint defs, glow filters, strip clips and ramp legends", () => {
    const { paint, strips, ramp } = idFamilySpecs();
    const rendered = [
      renderToSVGString(paint, { width: 320, height: 200, idPrefix: "paint" }),
      renderToSVGString(strips, { width: 360, height: 220, idPrefix: "strips" }),
      renderToSVGString(ramp, { width: 400, height: 300, idPrefix: "ramp" }),
    ];

    expectSelfContained(rendered[0]!, "paint-");
    expectSelfContained(rendered[1]!, "strips-");
    expectSelfContained(rendered[2]!, "ramp-");
    expect(rendered[0]!).toContain('id="paint-gg-paint-l0-p0-fill"');
    expect(rendered[0]!).toContain('filter="url(#paint-gg-paint-l0-p0-glow)"');
    expect(rendered[1]!).toContain('clip-path="url(#strips-gg-strip-clip-0)"');
    expect(rendered[2]!).toContain('id="ramp-gg-ramp-color"');
    expect(rendered[2]!).toContain('fill="url(#ramp-gg-ramp-color)"');

    // The three renders could share one document without any id overlap.
    const all = rendered.flatMap((svg) => ids(svg));
    expect(new Set(all).size).toBe(all.length);
  });

  it("keeps the historical ids when no prefix is given", () => {
    const spec = lineSpec();
    const plain = renderToSVGString(spec, { width: 400, height: 150 });
    expect(ids(plain)).toEqual(["gg-clip-0"]);
    expect(plain).toContain('clip-path="url(#gg-clip-0)"');
    // Deterministic: same spec + options => same bytes, prefix or not.
    expect(renderToSVGString(spec, { width: 400, height: 150, idPrefix: "" })).toBe(plain);
    expect(renderToSVGString(spec, { width: 400, height: 150 })).toBe(plain);
  });

  it("sanitizes the prefix to id-safe characters", () => {
    const svg = renderToSVGString(lineSpec(), {
      width: 400,
      height: 150,
      idPrefix: "chart a/1",
    });
    expect(ids(svg)).toEqual(["chart_a_1-gg-clip-0"]);
    expectSelfContained(svg, "chart_a_1-");
  });
});

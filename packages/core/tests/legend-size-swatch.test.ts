/**
 * A discrete size legend must grow its swatch so the largest size key renders
 * at its true radius. Both renderers cap a size key at swatchSize/2, so a fixed
 * 10px swatch collapses every radius above 5px to an identical dot — distinct
 * large size keys would look the same while the plotted marks differ.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg, guideLegend } from "@ggts-sh/spec";

import { FONT_METRICS } from "../src/layout/font-metrics.ts";
import { MetricsTableMeasurer } from "../src/layout/measure.ts";
import { buildLegends, type DiscreteLegendInput } from "../src/legend.ts";
import { runPipeline } from "../src/pipeline.ts";
import { registerAll } from "../src/register.ts";
import { renderToSVGString } from "../src/render-svg-full.ts";

registerAll();

const measurer = new MetricsTableMeasurer(FONT_METRICS);

function sizeInput(entries: readonly { label: string; radius: number }[]): DiscreteLegendInput {
  const labels = entries.map((entry) => entry.label);
  const radii = new Map(entries.map((entry) => [entry.label, entry.radius]));
  return {
    kind: "discrete",
    scale: "size",
    title: "",
    domain: labels,
    firstSeen: labels,
    keyOf: (value) => ({ size: radii.get(value as string) ?? 0 }),
  };
}

describe("discrete size legend swatch sizing", () => {
  it("grows the swatch so large size keys are not clamped to an identical radius", () => {
    // Radii 6 and 9 both exceed the old fixed 5px cap (swatchSize/2 with a 10px
    // swatch) and would collapse to identical dots.
    const block = buildLegends(
      [
        sizeInput([
          { label: "small", radius: 2 },
          { label: "mid", radius: 6 },
          { label: "large", radius: 9 },
        ]),
      ],
      "stable-domain",
      measurer,
      400,
    );
    const legend = block.legends[0]!;
    expect(legend.type).toBe("discrete");
    if (legend.type !== "discrete") return;
    const maxRadius = Math.max(...legend.entries.map((entry) => entry.size ?? 0));
    expect(maxRadius).toBe(9);
    // swatchSize/2 must reach the largest radius so the renderers'
    // Math.min(swatchSize/2, entry.size) cap never binds.
    expect(legend.swatchSize / 2).toBeGreaterThanOrEqual(maxRadius);
    // Every key's rendered radius (post-cap) stays distinct.
    const rendered = legend.entries.map((entry) =>
      Math.min(legend.swatchSize / 2, entry.size ?? legend.swatchSize / 2),
    );
    expect(new Set(rendered).size).toBe(legend.entries.length);
    expect(rendered).toEqual([2, 6, 9]);
  });

  it("keeps the default 10px swatch when no size key exceeds 5px", () => {
    const block = buildLegends(
      [
        sizeInput([
          { label: "a", radius: 3 },
          { label: "b", radius: 4 },
        ]),
      ],
      "stable-domain",
      measurer,
      400,
    );
    const legend = block.legends[0]!;
    if (legend.type !== "discrete") throw new Error("expected discrete legend");
    expect(legend.swatchSize).toBe(10);
  });
});

describe("continuous size legend SVG rendering", () => {
  const bubbleRows = [
    { x: 1, y: 2, vol: 10 },
    { x: 2, y: 5, vol: 50 },
    { x: 3, y: 8, vol: 100 },
  ];

  it("draws sized circle keys with strictly increasing radii instead of a gradient ramp", () => {
    const spec = gg(bubbleRows, aes({ x: "x", y: "y", size: "vol" }))
      .geomPoint()
      .labs({ title: "Bubble volume", x: "X", y: "Y", size: "Volume" })
      .spec();

    const model = runPipeline(spec, { width: 600, height: 400 });
    const legend = model.scene.legends.find((l) => l.scale === "size");
    expect(legend?.type).toBe("discrete");
    if (legend?.type !== "discrete") throw new Error("expected discrete circle key legend");
    expect(legend.interactive).toBe(false);

    const svg = renderToSVGString(spec, { width: 600, height: 400 });
    const legendStart = svg.indexOf('<g class="gg-legend gg-legend-size');
    expect(legendStart).toBeGreaterThan(-1);
    const legendSvg = svg.slice(legendStart);
    expect(legendSvg).not.toContain("linearGradient");
    expect(legendSvg).not.toContain("gg-legend-ramp");

    const radii = [...legendSvg.matchAll(/<circle[^>]*\br="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(radii.length).toBeGreaterThanOrEqual(3);
    expect(new Set(radii).size).toBe(radii.length);
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]!).toBeGreaterThan(radii[i - 1]!);
    }
  });

  it("preserves distinct circle radii for large ranges and bottom horizontal placement", () => {
    const spec = gg(bubbleRows, aes({ x: "x", y: "y", size: "vol" }))
      .geomPoint()
      .scales({ size: { type: "sequential", range: [2, 16], breaks: [10, 50, 100] } })
      .guides({ size: guideLegend({ position: "bottom", direction: "horizontal" }) })
      .labs({ title: "Horizontal size key", x: "X", y: "Y", size: "Volume" })
      .spec();

    const svg = renderToSVGString(spec, { width: 600, height: 400 });
    expect(svg).not.toContain("linearGradient");
    const legendIdx = svg.indexOf('class="gg-legend gg-legend-size');
    expect(legendIdx).toBeGreaterThan(-1);
    const legendSvg = svg.slice(legendIdx);
    const radii = [...legendSvg.matchAll(/<circle[^>]*\br="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(radii).toHaveLength(3);
    expect(radii[0]).toBeCloseTo(2, 1);
    expect(radii[2]).toBeCloseTo(16, 1);
    expect(radii[1]!).toBeGreaterThan(radii[0]!);
    expect(radii[1]!).toBeLessThan(radii[2]!);
  });
});

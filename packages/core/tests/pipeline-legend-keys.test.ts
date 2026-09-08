import { describe, expect, it } from "bun:test";

import {
  aes,
  gg,
  guideNone,
  scaleColorDiscrete,
  scaleFillDiscrete,
  scaleShapeDiscrete,
} from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.js";

import { renderToSVGString } from "../src/render-svg-full.js";

import type { SceneDiscreteLegend } from "../src/scene.js";

const rows = [
  { x: 1, y: 2, region: "North" },
  { x: 2, y: 4, region: "South" },
  { x: 3, y: 3, region: "North" },
];

function discrete(width: number, build: ReturnType<typeof gg>): SceneDiscreteLegend[] {
  return runPipeline(build.spec(), { width, height: 360 }).scene.legends.filter(
    (legend): legend is SceneDiscreteLegend => legend.type === "discrete",
  );
}

describe("responsive guide planning", () => {
  it("merges semantically equivalent discrete guides into composite keys", () => {
    const legends = discrete(
      720,
      gg(rows, aes({ x: "x", y: "y", color: "region", shape: "region" }))
        .geomPoint()
        .scales({ ...scaleColorDiscrete(), ...scaleShapeDiscrete() })
        .labs({ color: "Region", shape: "Region" }),
    );
    expect(legends).toHaveLength(1);
    expect(legends[0]?.aesthetics).toEqual(["color", "shape"]);
    expect(legends[0]?.entries.every((entry) => entry.shape !== undefined)).toBe(true);
  });

  it("puts the layer's constant point shape on color legend keys", () => {
    // Color scale alone used to draw filled squares for every key. A point
    // layer with shape:"cross" must show crosses so colorblind readers can
    // match legend to marks.
    const legends = discrete(
      720,
      gg(rows, aes({ x: "x", y: "y", color: "region" })).geomPoint({ shape: "cross" }),
    );
    expect(legends).toHaveLength(1);
    expect(legends[0]?.entries.map((entry) => entry.shape)).toEqual(["cross", "cross"]);
    const svg = renderToSVGString(
      gg(rows, aes({ x: "x", y: "y", color: "region" }))
        .geomPoint({ shape: "cross" })
        .spec(),
      { width: 720, height: 360 },
    );
    expect(svg).toContain("gg-shape-cross");
    expect(svg).not.toContain("gg-legend-swatch");
  });

  it("uses per-layer shapes when scaled color constants share one color scale", () => {
    // Snow cholera pattern: deaths = grey circles, pumps = red crosses.
    const legends = discrete(
      720,
      gg([{ x: 1, y: 1 }], aes({ x: "x", y: "y" }))
        .geomPoint({
          aes: aes({ color: { value: "Deaths", scale: true } }),
          size: 1.6,
        })
        .geomPoint({
          data: [{ x: 2, y: 2 }],
          aes: aes({ x: "x", y: "y", color: { value: "Pumps", scale: true } }),
          size: 4,
          shape: "cross",
        })
        .scales({
          color: {
            type: "manual",
            domain: ["Deaths", "Pumps"],
            range: ["#1e293b", "#b91c1c"],
          },
        }),
    );
    expect(legends).toHaveLength(1);
    const byValue = Object.fromEntries(
      legends[0]!.entries.map((entry) => [String(entry.value), entry.shape]),
    );
    expect(byValue).toEqual({ Deaths: "circle", Pumps: "cross" });
  });

  it("keeps fill legend keys as squares for non-point geoms", () => {
    const legends = discrete(720, gg(rows, aes({ x: "region", y: "y", fill: "region" })).geomCol());
    expect(legends).toHaveLength(1);
    expect(legends[0]?.entries.every((entry) => entry.shape === undefined)).toBe(true);
  });

  it("puts a solid stroke on colour legend keys for geomLine", () => {
    // Colour scale alone used to draw filled squares. A line layer must show
    // stroke segments so colourblind readers can match keys to marks.
    const spec = gg(rows, aes({ x: "x", y: "y", color: "region" })).geomLine();
    const legends = discrete(720, spec);
    expect(legends).toHaveLength(1);
    expect(legends[0]?.entries.map((entry) => entry.linetype)).toEqual(["solid", "solid"]);
    const svg = renderToSVGString(spec.spec(), { width: 720, height: 360 });
    expect(svg).toContain('<line class="gg-legend-key"');
    expect(svg).not.toContain("gg-legend-swatch");
  });

  it("puts a constant aes linetype on colour legend keys for geomLine", () => {
    const spec = gg(rows, aes({ x: "x", y: "y", color: "region" })).geomLine({
      aes: aes({ linetype: { value: "dashed" } }),
    });
    const legends = discrete(720, spec);
    expect(legends).toHaveLength(1);
    expect(legends[0]?.entries.map((entry) => entry.linetype)).toEqual(["dashed", "dashed"]);
    const svg = renderToSVGString(spec.spec(), { width: 720, height: 360 });
    expect(svg).toContain('<line class="gg-legend-key"');
    expect(svg).toContain('stroke-dasharray="6 4"');
    expect(svg).not.toContain("gg-legend-swatch");
  });

  it("uses per-layer linetypes when scaled colour constants share one colour scale", () => {
    // Two line layers, each a scaled colour constant with its own stroke
    // pattern — same shape as Deaths circle / Pumps cross for points.
    const legends = discrete(
      720,
      gg([{ x: 1, y: 1 }], aes({ x: "x", y: "y" }))
        .geomLine({
          aes: aes({ color: { value: "Observed", scale: true } }),
        })
        .geomLine({
          data: [{ x: 2, y: 2 }],
          aes: aes({
            x: "x",
            y: "y",
            color: { value: "Forecast", scale: true },
            linetype: { value: "dashed" },
          }),
        })
        .scales({
          color: {
            type: "manual",
            domain: ["Observed", "Forecast"],
            range: ["#1e293b", "#b91c1c"],
          },
        }),
    );
    expect(legends).toHaveLength(1);
    const byValue = Object.fromEntries(
      legends[0]!.entries.map((entry) => [String(entry.value), entry.linetype]),
    );
    expect(byValue).toEqual({ Observed: "solid", Forecast: "dashed" });
  });

  it("puts stroke keys on colour legends for geomPath and geomStep", () => {
    for (const layer of [
      (plot: ReturnType<typeof gg>) => plot.geomPath(),
      (plot: ReturnType<typeof gg>) => plot.geomStep(),
    ]) {
      const spec = layer(gg(rows, aes({ x: "x", y: "y", color: "region" })));
      const legends = discrete(720, spec);
      expect(legends[0]?.entries.map((entry) => entry.linetype)).toEqual(["solid", "solid"]);
      const svg = renderToSVGString(spec.spec(), { width: 720, height: 360 });
      expect(svg).toContain('<line class="gg-legend-key"');
      expect(svg).not.toContain("gg-legend-swatch");
    }
  });

  it("keeps point shapes on mixed point+line colour keys", () => {
    // mergeDiscrete deletes shape when a key also has linetype and no shape
    // scale is merged. A colour-only point+line plot must keep the point key.
    const spec = gg(rows, aes({ x: "x", y: "y", color: "region" }))
      .geomPoint({ shape: "square" })
      .geomLine();
    const legends = discrete(720, spec);
    expect(legends).toHaveLength(1);
    expect(legends[0]?.entries.map((entry) => entry.shape)).toEqual(["square", "square"]);
    expect(legends[0]?.entries.every((entry) => entry.linetype === undefined)).toBe(true);
    const svg = renderToSVGString(spec.spec(), { width: 720, height: 360 });
    expect(svg).toContain("gg-shape-square");
    expect(svg).not.toContain('<line class="gg-legend-key"');
  });

  it("keeps scaled linetype on a merged colour+linetype legend", () => {
    const spec = gg(rows, aes({ x: "x", y: "y", color: "region", linetype: "region" }))
      .geomLine()
      .labs({ color: "Region", linetype: "Region" });
    const legends = discrete(720, spec);
    expect(legends).toHaveLength(1);
    expect(legends[0]?.aesthetics).toEqual(["color", "linetype"]);
    const patterns = legends[0]!.entries.map((entry) => entry.linetype);
    expect(patterns.every((pattern) => pattern !== undefined)).toBe(true);
    expect(new Set(patterns).size).toBeGreaterThan(1);
    const svg = renderToSVGString(spec.spec(), { width: 720, height: 360 });
    expect(svg).toContain('<line class="gg-legend-key"');
    expect(svg).not.toContain("gg-legend-swatch");
  });

  it("puts a solid stroke on colour keys when the linetype guide is hidden", () => {
    const styled = [
      { x: 1, y: 2, region: "North", style: "A" },
      { x: 2, y: 4, region: "South", style: "B" },
      { x: 3, y: 3, region: "North", style: "A" },
    ];
    const spec = gg(styled, aes({ x: "x", y: "y", color: "region", linetype: "style" }))
      .geomLine()
      .guides({ linetype: guideNone() });
    const legends = discrete(720, spec);
    expect(legends).toHaveLength(1);
    expect(legends[0]?.aesthetics).toEqual(["color"]);
    expect(legends[0]?.entries.map((entry) => entry.linetype)).toEqual(["solid", "solid"]);
    const svg = renderToSVGString(spec.spec(), { width: 720, height: 360 });
    expect(svg).toContain('<line class="gg-legend-key"');
    expect(svg).not.toContain("gg-legend-swatch");
  });

  it("puts a solid stroke on colour keys when linetype has its own guide", () => {
    const styled = [
      { x: 1, y: 2, region: "North", style: "A" },
      { x: 2, y: 4, region: "South", style: "B" },
      { x: 3, y: 3, region: "North", style: "A" },
    ];
    const spec = gg(styled, aes({ x: "x", y: "y", color: "region", linetype: "style" })).geomLine();
    const legends = discrete(720, spec);
    expect(legends.map((legend) => legend.aesthetics)).toEqual([["color"], ["linetype"]]);
    const colorLegend = legends.find((legend) => legend.aesthetics.includes("color"));
    expect(colorLegend?.entries.map((entry) => entry.linetype)).toEqual(["solid", "solid"]);
    const svg = renderToSVGString(spec.spec(), { width: 720, height: 360 });
    const colorStart = svg.indexOf("gg-legend-color");
    const linetypeStart = svg.indexOf("gg-legend-linetype");
    expect(colorStart).toBeGreaterThan(-1);
    expect(linetypeStart).toBeGreaterThan(-1);
    const colorChunk =
      colorStart < linetypeStart ? svg.slice(colorStart, linetypeStart) : svg.slice(colorStart);
    expect(colorChunk).toContain('<line class="gg-legend-key"');
    expect(colorChunk).not.toContain("gg-legend-swatch");
  });

  it("falls back to a solid stroke when constant linetypes conflict", () => {
    const spec = gg(rows, aes({ x: "x", y: "y", color: "region" }))
      .geomLine({ aes: aes({ linetype: { value: "dashed" } }) })
      .geomLine({ aes: aes({ linetype: { value: "dotted" } }) });
    const legends = discrete(720, spec);
    expect(legends).toHaveLength(1);
    expect(legends[0]?.entries.map((entry) => entry.linetype)).toEqual(["solid", "solid"]);
  });

  it("does not put a stroke fallback on colour keys when a point layer also maps colour", () => {
    const styled = [
      { x: 1, y: 2, region: "North", style: "A" },
      { x: 2, y: 4, region: "South", style: "B" },
      { x: 3, y: 3, region: "North", style: "A" },
    ];
    const spec = gg(styled, aes({ x: "x", y: "y", color: "region" }))
      .geomPoint({ aes: aes({ shape: "style" }) })
      .geomLine({ aes: aes({ linetype: "style" }) });
    const colorLegend = discrete(720, spec).find((legend) => legend.aesthetics.includes("color"));
    expect(colorLegend).toBeDefined();
    expect(colorLegend!.entries.every((entry) => entry.linetype === undefined)).toBe(true);
  });

  it("puts a solid stroke on colour keys when linetype is a hidden scaled constant", () => {
    const spec = gg(rows, aes({ x: "x", y: "y", color: "region" }))
      .geomLine({
        aes: aes({ linetype: { value: "dashed", scale: true } }),
      })
      .guides({ linetype: guideNone() });
    const legends = discrete(720, spec);
    expect(legends).toHaveLength(1);
    expect(legends[0]?.aesthetics).toEqual(["color"]);
    expect(legends[0]?.entries.map((entry) => entry.linetype)).toEqual(["solid", "solid"]);
  });

  it("keeps colour keys as squares when a non-line layer shares the colour scale", () => {
    // col/bar/area clear aes.color (fill-only geoms). text maps colour and is
    // not a LINE_MARK_GEOM, so it must suppress the stroke fallback.
    const spec = gg(rows, aes({ x: "x", y: "y", color: "region", label: "region" }))
      .geomText()
      .geomLine();
    const colorLegend = discrete(720, spec).find((legend) => legend.aesthetics.includes("color"));
    expect(colorLegend).toBeDefined();
    expect(colorLegend!.entries.every((entry) => entry.linetype === undefined)).toBe(true);
    expect(colorLegend!.entries.every((entry) => entry.shape === undefined)).toBe(true);
  });

  it("keeps swapped per-layer aesthetic sources in separate guides", () => {
    const swappedRows = [
      { x: 1, y: 1, a: "North", b: "North" },
      { x: 2, y: 2, a: "South", b: "South" },
      { x: 3, y: 3, a: "North", b: "South" },
      { x: 4, y: 4, a: "South", b: "North" },
    ];
    const legends = discrete(
      720,
      gg(swappedRows, aes({ x: "x", y: "y" }))
        .geomPoint({ aes: aes({ color: "a", shape: "b" }) })
        .geomPoint({ aes: aes({ color: "b", shape: "a" }) })
        .scales({ ...scaleColorDiscrete(), ...scaleShapeDiscrete() })
        .labs({ color: "Group", shape: "Group" }),
    );
    expect(legends).toHaveLength(2);
    expect(legends.map((legend) => legend.aesthetics)).toEqual([["color"], ["shape"]]);
  });

  it("preserves an authored gray paint in a merged style key", () => {
    const spec = gg(rows, aes({ x: "x", y: "y", color: "region", shape: "region" }))
      .geomPoint()
      .scales({
        ...scaleColorDiscrete({ range: ["#999999", "#ff0000"] }),
        ...scaleShapeDiscrete(),
      })
      .labs({ color: "Region", shape: "Region" })
      .spec();
    const result = runPipeline(spec, { width: 720, height: 360 });
    const legend = result.scene.legends[0];
    expect(legend?.type).toBe("discrete");
    if (legend?.type !== "discrete") return;
    expect(legend.entries[0]?.color).toBe("#999999");
    expect(legend.entries[0]?.hasPaint).toBe(true);
    const svg = renderToSVGString(spec, { width: 720, height: 360 });
    const legendSvg = svg.slice(svg.indexOf('<g class="gg-legend '));
    expect(legendSvg).toContain('fill="#999999"');
  });

  it("keeps guides separate when strict title identity differs", () => {
    const legends = discrete(
      720,
      gg(rows, aes({ x: "x", y: "y", color: "region", shape: "region" }))
        .geomPoint()
        .scales({ ...scaleColorDiscrete(), ...scaleShapeDiscrete() })
        .labs({ color: "Color region", shape: "Shape region" }),
    );
    expect(legends).toHaveLength(2);
  });

  it("keeps guides separate when mapped color and fill palettes differ", () => {
    const legends = discrete(
      720,
      gg(rows, aes({ x: "x", y: "y", color: "region", fill: "region" }))
        .geomPoint()
        .scales({
          ...scaleColorDiscrete({ range: ["#ff0000", "#00ff00"] }),
          ...scaleFillDiscrete({ range: ["#0000ff", "#ffff00"] }),
        })
        .labs({ color: "Region", fill: "Region" }),
    );
    expect(legends).toHaveLength(2);
    expect(legends.map((legend) => legend.entries.map((entry) => entry.color))).toEqual([
      ["#ff0000", "#00ff00"],
      ["#0000ff", "#ffff00"],
    ]);
  });
});

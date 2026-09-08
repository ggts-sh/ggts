import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { PIPELINE_ERROR_CATALOG, PIPELINE_WARNING_CATALOG } from "../src/diagnostics.ts";
import { resolveTheme, sceneToSVGString } from "../src/index.ts";
import { runPipeline } from "../src/pipeline.ts";
import { applyFixedAspectLayout } from "../src/pipeline/panel-layout-fixed.ts";

const rows = [
  { x: 0, y: 0 },
  { x: 10, y: 10 },
];

function ratioOf(panel: { width: number; height: number }): number {
  return panel.height / panel.width;
}

function fixedModel(width: number, height: number, ratio = 1) {
  return runPipeline(
    gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .coordFixed({ ratio })
      .spec(),
    { width, height },
  );
}

describe("coord_fixed pipeline", () => {
  it("derives the built-in letterbox role from each theme paper", () => {
    for (const name of ["default", "dark", "ggplot2"] as const) {
      const theme = resolveTheme(name);
      expect(theme.letterboxFill).toBe(theme.paper);
    }
    expect(resolveTheme({ paper: "#abcdef" }).letterboxFill).toBe("#abcdef");
    expect(resolveTheme({ paper: "#abcdef", letterboxFill: "#123456" }).letterboxFill).toBe(
      "#123456",
    );
  });

  it("fits the largest centered data rectangle at the requested physical unit ratio", () => {
    const model = fixedModel(640, 400);
    const panel = model.scene.panels[0]!;
    expect(ratioOf(panel)).toBeCloseTo(1, 10);
    expect(panel.allocation).toBeDefined();
    const allocation = panel.allocation!;
    expect(panel.x).toBeCloseTo(allocation.x + (allocation.width - panel.width) / 2, 10);
    expect(panel.y).toBeCloseTo(allocation.y + (allocation.height - panel.height) / 2, 10);
    expect(panel.x).toBeGreaterThanOrEqual(allocation.x);
    expect(panel.y).toBeGreaterThanOrEqual(allocation.y);
    expect(panel.x + panel.width).toBeLessThanOrEqual(allocation.x + allocation.width);
    expect(panel.y + panel.height).toBeLessThanOrEqual(allocation.y + allocation.height);
  });

  it("applies ratio as y-unit length / x-unit length", () => {
    const model = fixedModel(640, 640, 2);
    expect(ratioOf(model.scene.panels[0]!)).toBeCloseTo(2, 10);
  });

  it("uses trained scale-space spans, including pre-stat scale transforms", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 0 },
          { x: 1000, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scaleXLog10({ expand: { mult: 0 } })
        .scaleYContinuous({ expand: { mult: 0 } })
        .coordFixed()
        .spec(),
      { width: 640, height: 480 },
    );
    expect(ratioOf(model.scene.panels[0]!)).toBeCloseTo(1, 10);
  });

  it("keeps fixed-scale facet data rectangles equal", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0, g: "a" },
          { x: 10, y: 10, g: "a" },
          { x: 2, y: 8, g: "b" },
          { x: 9, y: 1, g: "b" },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .facet({ wrap: "g", ncol: 2 })
        .coordFixed()
        .spec(),
      { width: 800, height: 400 },
    );
    const dimensions = model.scene.panels.map((panel) => [panel.width, panel.height]);
    expect(dimensions[0]).toEqual(dimensions[1]);
    for (const panel of model.scene.panels) expect(ratioOf(panel)).toBeCloseTo(1, 10);
  });

  it("preserves the ratio under responsive width and height changes", () => {
    for (const size of [
      { width: 320, height: 600 },
      { width: 640, height: 320 },
      { width: 1200, height: 700 },
    ]) {
      const panel = fixedModel(size.width, size.height, 0.75).scene.panels[0]!;
      expect(ratioOf(panel)).toBeCloseTo(0.75, 10);
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.y).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(size.width);
      expect(panel.y + panel.height).toBeLessThanOrEqual(size.height);
    }
  });

  it("defensively rejects free scales in the runtime layout pass", () => {
    const model = fixedModel(640, 400);
    const panel = model.scene.panels[0]!;
    expect(() =>
      applyFixedAspectLayout({
        placements: [
          {
            x: panel.x,
            y: panel.y,
            width: panel.width,
            height: panel.height,
            ticksH: [],
            ticksV: [],
            showAxisX: true,
            showAxisY: true,
          },
        ],
        panelScales: model.scales.panels,
        coord: { type: "fixed" },
        faceted: true,
        freeX: true,
        freeY: false,
        scalesConfig: {},
        warnings: [],
      }),
    ).toThrow(expect.objectContaining({ code: "coord-fixed-free-scales", path: "/facet/scales" }));
  });

  it("keeps a tall right guide inside the root after vertical letterboxing", () => {
    const data = Array.from({ length: 10 }, (_, index) => ({
      x: index,
      y: index,
      group: `group-${index}`,
    }));
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", color: "group" }))
        .geomPoint()
        .coordFixed({ ratio: 0.1 })
        .spec(),
      { width: 800, height: 400 },
    );
    const right = model.scene.legends.filter((legend) => legend.position === "right");
    expect(right.length).toBeGreaterThan(0);
    for (const legend of right) {
      expect(legend.y).toBeGreaterThanOrEqual(0);
      expect(legend.y + legend.height).toBeLessThanOrEqual(model.scene.height);
    }
  });

  it("preserves ratio but declares one degraded layout below the readable minimum", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scaleXContinuous({ minorBreaks: [2.5, 7.5] })
        .scaleYContinuous({ minorBreaks: [2.5, 7.5] })
        .coordFixed({ ratio: 100 })
        .spec(),
      { width: 320, height: 240 },
    );
    const panel = model.scene.panels[0]!;
    expect(ratioOf(panel)).toBeCloseTo(100, 8);
    expect(model.scene.layout).toBe("degraded");
    expect(panel.grid.minorX).toEqual([]);
    expect(panel.grid.minorY).toEqual([]);
    expect(panel.axisX?.filter((tick) => tick.kind === "major").length).toBeLessThanOrEqual(3);
    expect(
      model.warnings.filter((warning) => warning.code === "coord-fixed-degraded"),
    ).toHaveLength(1);
    expect(sceneToSVGString(model.scene)).toContain('data-gg-layout="degraded"');
  });

  it("renders explicit theme-owned letterbox gutters without grid or panel chrome", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .coordFixed()
        .theme({ letterboxFill: "#123456" })
        .spec(),
      { width: 640, height: 400 },
    );
    const svg = sceneToSVGString(model.scene);
    expect(svg).toContain('class="gg-letterbox"');
    expect(svg).toContain("var(--gg-letterboxFill, #123456)");
    const letterboxIndex = svg.indexOf('class="gg-letterbox"');
    const panelIndex = svg.indexOf('class="gg-panel"');
    expect(letterboxIndex).toBeGreaterThan(-1);
    expect(letterboxIndex).toBeLessThan(panelIndex);
  });

  it("paints letterbox fill only on gutters when the panel role is none", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .coordFixed()
        .theme({ letterboxFill: "#123456", panel: "none" })
        .spec(),
      { width: 640, height: 400 },
    );
    const panel = model.scene.panels[0]!;
    const allocation = panel.allocation!;
    const svg = sceneToSVGString(model.scene);
    const gutterRects = [...svg.matchAll(/class="gg-letterbox"[^>]*>/g)].map((match) => match[0]);
    expect(gutterRects.length).toBeGreaterThan(0);
    // No single letterbox covers the full pre-fit allocation (would leak under panel:none).
    expect(
      gutterRects.some(
        (rect) =>
          rect.includes(`x="${allocation.x}"`) &&
          rect.includes(`y="${allocation.y}"`) &&
          rect.includes(`width="${allocation.width}"`) &&
          rect.includes(`height="${allocation.height}"`),
      ),
    ).toBe(false);
    expect(svg).not.toContain('class="gg-panel-background"');
  });

  it("catalogs degraded fixed-aspect as a warning, not a pipeline error", () => {
    expect(PIPELINE_WARNING_CATALOG["coord-fixed-degraded"]).toBeDefined();
    expect(
      (PIPELINE_ERROR_CATALOG as Record<string, unknown>)["coord-fixed-degraded"],
    ).toBeUndefined();
  });

  it("rejects non-finite fitted fixed-aspect rectangles instead of sizing to zero", () => {
    const model = fixedModel(640, 400);
    const panel = model.scene.panels[0]!;
    const tinySpan = {
      type: "linear" as const,
      transform: "identity" as const,
      domain: [0, 1e-320] as const,
      transformedDomain: [0, 1e-320] as const,
      range: [0, 1] as const,
    };
    const unitSpan = {
      type: "linear" as const,
      transform: "identity" as const,
      domain: [0, 1] as const,
      transformedDomain: [0, 1] as const,
      range: [0, 1] as const,
    };
    expect(() =>
      applyFixedAspectLayout({
        placements: [
          {
            x: panel.x,
            y: panel.y,
            width: panel.width,
            height: panel.height,
            ticksH: [],
            ticksV: [],
            showAxisX: true,
            showAxisY: true,
          },
        ],
        panelScales: [{ x: tinySpan as never, y: unitSpan as never }],
        coord: { type: "fixed", ratio: 1 },
        faceted: false,
        freeX: false,
        freeY: false,
        scalesConfig: {},
        warnings: [],
      }),
    ).toThrow(
      expect.objectContaining({ code: "coord-fixed-invalid-aspect", path: "/coord/ratio" }),
    );
  });

  it("keeps guidePlans aligned with thinned ticks under degraded fixed aspect", () => {
    const start = Date.UTC(2020, 0, 1);
    const temporalRows = Array.from({ length: 24 }, (_, index) => ({
      t: new Date(start + index * 30 * 24 * 3600 * 1000),
      y: index,
    }));
    const model = runPipeline(
      gg(temporalRows, aes({ x: "t", y: "y" }))
        .geomPoint()
        .coordFixed({ ratio: 100 })
        .spec(),
      { width: 200, height: 120 },
    );
    expect(model.scene.layout).toBe("degraded");
    const axisLabels =
      model.scene.panels[0]?.axisX
        ?.filter((tick) => tick.kind === "major" || tick.kind === undefined)
        .map((tick) => tick.label) ?? [];
    const guide = model.guidePlans.find((plan) => plan.type === "axis" && plan.aesthetic === "x");
    expect(guide).toBeDefined();
    if (guide?.type !== "axis") throw new Error("expected axis guide");
    expect(guide.ticks.map((tick) => tick.label)).toEqual(axisLabels);
    expect(guide.ticks.length).toBeLessThanOrEqual(3);
    expect(guide.interval).not.toBeNull();
  });
});

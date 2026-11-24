/**
 * Final-layout panel diagnostics (#1965): tall multi-row facet grids
 * (`facet-grid-too-tall`), including `theme.panelAspect: "free"` non-suppression,
 * `coordFixed`, `facet.grid`, rotated/wrapped band-label x-axis title offset,
 * boundary checks, and degenerate-input guards.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { collectPanelLayoutWarnings } from "../src/pipeline/panel-diagnostics.ts";
import type { PanelLayoutResult } from "../src/pipeline/panel-layout-types.ts";
import type { RenderModel } from "../src/pipeline/types.ts";
import { sceneToSVGString } from "../src/render-svg.ts";

const rows = [
  { x: 1, y: 2, region: "North", g: "a" },
  { x: 2, y: 4, region: "South", g: "b" },
  { x: 3, y: 3, region: "North", g: "c" },
  { x: 4, y: 5, region: "South", g: "d" },
];

const sixteenFacetRows = Array.from({ length: 48 }, (_, index) => ({
  scope: `S${Math.floor(index / 3) + 1}`,
  period: `P${(index % 3) + 1}`,
  n: ((index * 7 + 4) % 9) + 1,
}));

const codesOf = (model: RenderModel) => model.warnings.map((warning) => warning.code);

const tallFacetWarnings = (model: RenderModel) =>
  model.warnings.filter((warning) => warning.code === "facet-grid-too-tall");

function facetUnionHeight(model: RenderModel): number {
  const panels = model.scene.panels;
  const top = Math.min(...panels.map((panel) => panel.y));
  const bottom = Math.max(...panels.map((panel) => panel.y + panel.height));
  return bottom - top;
}

describe("facet grid too tall diagnostics (#1965)", () => {
  const tallColSpec = (extra?: {
    theme?: { name: "minimal"; panelAspect: "free" };
    coordFixed?: boolean;
    facet?: { wrap: "scope"; ncol: number } | { rows: "scope" };
  }) => {
    let builder = gg(sixteenFacetRows, aes({ x: "period", y: "n" }))
      .geomCol()
      .scales({ x: { type: "band" }, y: { type: "linear" } })
      .facet(extra?.facet ?? { wrap: "scope", ncol: 2 })
      .labs({ title: "Citas por consejería y periodo", x: "Periodo", y: "Citas" });
    if (extra?.theme !== undefined) builder = builder.theme(extra.theme);
    if (extra?.coordFixed === true) builder = builder.coordFixed({ ratio: 0.2 });
    return builder.spec();
  };

  it("warns on the 16-panel 8-row repro at 1464×2350 with exact grid height and x-axis title y", () => {
    const model = runPipeline(tallColSpec(), { width: 1464, height: 2350 });
    expect(tallFacetWarnings(model)).toEqual([
      {
        code: "facet-grid-too-tall",
        message:
          "The facet grid is 2259 px tall across 8 rows; the x axis sits at y=2342, below the first 1200 px viewport. Repeat the x axis on each row, reduce the rows, or split the chart.",
      },
    ]);

    const svg = sceneToSVGString(model.scene);
    const titleYMatch = /<text class="gg-axis-title"[^>]*\sy="([^"]+)"[^>]*>Periodo<\/text>/.exec(
      svg,
    );
    expect(titleYMatch).not.toBeNull();
    expect(Math.round(Number(titleYMatch![1]))).toBe(2342);
  });

  it("scales grid height and x-axis title y at 1464×3190", () => {
    const model = runPipeline(tallColSpec(), { width: 1464, height: 3190 });
    expect(tallFacetWarnings(model)).toEqual([
      {
        code: "facet-grid-too-tall",
        message:
          "The facet grid is 3099 px tall across 8 rows; the x axis sits at y=3182, below the first 1200 px viewport. Repeat the x axis on each row, reduce the rows, or split the chart.",
      },
    ]);
  });

  it("is not suppressed by theme.panelAspect: free (which still suppresses aspect/share)", () => {
    const model = runPipeline(tallColSpec({ theme: { name: "minimal", panelAspect: "free" } }), {
      width: 4000,
      height: 2350,
    });
    expect(codesOf(model)).toContain("facet-grid-too-tall");
    expect(codesOf(model)).not.toContain("panel-aspect-extreme");
    expect(codesOf(model)).not.toContain("panel-height-share-low");
  });

  it("warns for coordFixed multi-row facet grids taller than 1200 px", () => {
    const model = runPipeline(tallColSpec({ coordFixed: true }), { width: 1464, height: 2350 });
    expect(codesOf(model)).toContain("facet-grid-too-tall");
    expect(codesOf(model)).not.toContain("panel-aspect-extreme");
    expect(codesOf(model)).not.toContain("panel-height-share-low");
  });

  it("warns for facet.grid (rows) taller than 1200 px", () => {
    const model = runPipeline(tallColSpec({ facet: { rows: "scope" } }), {
      width: 1464,
      height: 2350,
    });
    const warnings = tallFacetWarnings(model);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("across 16 rows");
  });

  it("stays silent for a 2×2 facet grid at 800×800", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({ wrap: "g", ncol: 2 })
        .spec(),
      { width: 800, height: 800 },
    );
    expect(tallFacetWarnings(model)).toEqual([]);
  });

  it("stays silent when a tall facet grid has only a single row", () => {
    const model = runPipeline(tallColSpec({ facet: { wrap: "scope", ncol: 16 } }), {
      width: 2400,
      height: 2000,
    });
    expect(facetUnionHeight(model)).toBeGreaterThan(1200);
    expect(new Set(model.scene.panels.map((p) => p.y)).size).toBe(1);
    expect(tallFacetWarnings(model)).toEqual([]);
  });

  it("stays silent at exactly 1200 px grid height and warns above it", () => {
    const atBound = runPipeline(tallColSpec(), { width: 1464, height: 1291.5 });
    expect(facetUnionHeight(atBound)).toBe(1200);
    expect(tallFacetWarnings(atBound)).toEqual([]);

    const beyond = runPipeline(tallColSpec(), { width: 1464, height: 1292 });
    expect(facetUnionHeight(beyond)).toBeGreaterThan(1200);
    expect(tallFacetWarnings(beyond)).toHaveLength(1);
  });

  it("reports at least 1201 px tall when gridHeight is between 1200 and 1200.5", () => {
    const fractionalModel = runPipeline(tallColSpec(), { width: 1464, height: 1291.6 });
    const gridHeight = facetUnionHeight(fractionalModel);
    expect(gridHeight).toBeGreaterThan(1200);
    expect(gridHeight).toBeLessThan(1200.5);
    const warnings = tallFacetWarnings(fractionalModel);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain("The facet grid is 1201 px tall across 8 rows");

    const unitWarnings = collectPanelLayoutWarnings({
      panelLayout: {
        placements: [
          { x: 0, y: 0, width: 400, height: 600, showAxisX: false },
          { x: 0, y: 600.01, width: 400, height: 600, showAxisX: true },
        ],
        guides: { h: { showTicks: true }, v: { showTicks: true } },
        topBand: 0,
        bottomBand: 0,
        stripBand: 0,
        strip: { show: false, position: "top" },
        legendBlock: { bottomHeight: 0 },
      } as unknown as PanelLayoutResult,
      viewport: { width: 800, height: 1400 },
      coordConstrained: false,
      suppressed: false,
    });
    expect(unitWarnings).toHaveLength(1);
    expect(unitWarnings[0]!.code).toBe("facet-grid-too-tall");
    expect(unitWarnings[0]!.message).toContain("The facet grid is 1201 px tall across 2 rows");
  });

  it("matches SVG px() 2-decimal rounding for x-axis title y on sparse facet.grid", () => {
    const sparseRows = [
      { r: "R1", c: "C1", x: 1, y: 2 },
      { r: "R2", c: "C2", x: 2, y: 3 },
      { r: "R3", c: "C1", x: 3, y: 4 },
      { r: "R4", c: "C2", x: 4, y: 5 },
      { r: "R5", c: "C1", x: 5, y: 6 },
      { r: "R6", c: "C2", x: 6, y: 7 },
    ];
    const model = runPipeline(
      gg(sparseRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({ rows: "r", cols: "c" })
        .labs({ x: "XSparse", y: "YSparse" })
        .spec(),
      { width: 1000, height: 2000 },
    );
    const svg = sceneToSVGString(model.scene);
    const titleYMatch = /<text class="gg-axis-title"[^>]*\sy="([^"]+)"[^>]*>XSparse<\/text>/.exec(
      svg,
    );
    expect(titleYMatch).not.toBeNull();
    const expectedY = Math.round(Number(titleYMatch![1]));
    expect(expectedY).toBe(1992);

    const warnings = tallFacetWarnings(model);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain(`the x axis sits at y=${expectedY}`);
  });

  it("accounts for rotated/wrapped band-label x-axis title offset matching rendered SVG y", () => {
    const longBandRows = Array.from({ length: 48 }, (_, index) => ({
      scope: `S${Math.floor(index / 3) + 1}`,
      period: `Very long period label ${(index % 3) + 1} with extra detail`,
      n: ((index * 7 + 4) % 9) + 1,
    }));
    const model = runPipeline(
      gg(longBandRows, aes({ x: "period", y: "n" }))
        .geomCol()
        .scales({ x: { type: "band" }, y: { type: "linear" } })
        .facet({ wrap: "scope", ncol: 2 })
        .labs({ title: "Title", x: "Periodo", y: "Citas" })
        .spec(),
      { width: 600, height: 2350 },
    );
    const xPlan = model.guidePlans.find((plan) => plan.type === "axis" && plan.aesthetic === "x");
    expect(xPlan?.type).toBe("axis");
    if (xPlan?.type === "axis") {
      expect(xPlan.bandLabelMode).not.toBe("single-line");
    }
    expect(model.scene.axes.x.titleOffset).toBeGreaterThan(32);

    const svg = sceneToSVGString(model.scene);
    const titleYMatch = /<text class="gg-axis-title"[^>]*\sy="([^"]+)"[^>]*>Periodo<\/text>/.exec(
      svg,
    );
    expect(titleYMatch).not.toBeNull();
    const expectedY = Math.round(Number(titleYMatch![1]));

    const warnings = tallFacetWarnings(model);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain(`the x axis sits at y=${expectedY}`);

    const customTicksModel = runPipeline(
      gg(longBandRows, aes({ x: "period", y: "n" }))
        .geomCol()
        .scales({ x: { type: "band" }, y: { type: "linear" } })
        .facet({ wrap: "scope", ncol: 2 })
        .labs({ title: "Title", x: "Periodo", y: "Citas" })
        .theme({ name: "minimal", tickLength: 18 })
        .spec(),
      { width: 600, height: 2350 },
    );
    const customTicksSvg = sceneToSVGString(customTicksModel.scene);
    const customTicksY = /<text class="gg-axis-title"[^>]*\sy="([^"]+)"[^>]*>Periodo<\/text>/.exec(
      customTicksSvg,
    );
    expect(customTicksY).not.toBeNull();
    expect(tallFacetWarnings(customTicksModel)[0]!.message).toContain(
      `the x axis sits at y=${Math.round(Number(customTicksY![1]))}`,
    );
  });

  it("emits no warnings for degenerate viewports or placements", () => {
    const spec = tallColSpec();
    for (const [width, height] of [
      [0, 2350],
      [1464, 0],
      [Number.NaN, 2350],
    ] as const) {
      expect(tallFacetWarnings(runPipeline(spec, { width, height }))).toEqual([]);
    }

    const baseLayout = {
      guides: { h: { showTicks: true }, v: { showTicks: true } },
      topBand: 0,
      bottomBand: 0,
      stripBand: 0,
      strip: { show: false, position: "top" },
      legendBlock: { bottomHeight: 0 },
    } as unknown as PanelLayoutResult;

    const degenerateCases = [
      [
        { x: 0, y: 0, width: 100, height: 700, showAxisX: false },
        { x: 0, y: 750, width: 0, height: 700, showAxisX: true },
      ],
      [
        { x: 0, y: 0, width: 100, height: 700, showAxisX: false },
        { x: 0, y: Number.NaN, width: 100, height: 700, showAxisX: true },
      ],
    ] as unknown as PanelLayoutResult["placements"][];

    for (const placements of degenerateCases) {
      const warnings = collectPanelLayoutWarnings({
        panelLayout: { ...baseLayout, placements },
        viewport: { width: 1464, height: 2350 },
        coordConstrained: false,
        suppressed: false,
      });
      expect(warnings).toEqual([]);
    }
  });
});

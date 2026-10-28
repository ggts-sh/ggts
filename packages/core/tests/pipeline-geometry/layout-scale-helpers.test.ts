/**
 * Geometry characterization — layout-scale-helpers.
 */
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "bun:test";

describe("buildRenderModelScaleState", () => {
  it("includes only non-null color/fill state entries", async () => {
    const { buildRenderModelScaleState } =
      await import("../../src/pipeline/assemble-render-model-scales.ts");
    const colorState = fromAny({ domain: ["a"], assigned: { a: 0 } });
    expect(buildRenderModelScaleState(colorState, null)).toEqual({ color: colorState });
    expect(buildRenderModelScaleState(null, null)).toEqual({});
  });
});

describe("placeSceneLegends", () => {
  it("offsets legend x by scene width minus block width and edge pad", async () => {
    const { placeSceneLegends } = await import("../../src/pipeline/assemble-scene-legends.ts");
    const { LEGEND_EDGE_PAD } = await import("../../src/pipeline/layout-helpers.ts");
    const legends = placeSceneLegends({
      legends: [fromAny({ x: 0, y: 5, width: 10, height: 10, title: "", items: [] })],
      legendWidth: 40,
      sceneWidth: 200,
      panelY: 12,
    });
    expect(legends[0]!.x).toBe(200 - 40 - LEGEND_EDGE_PAD);
    expect(legends[0]!.y).toBe(5 + 12);
  });
});

describe("computeFacetPanelSize", () => {
  it("divides remaining grid width across columns", async () => {
    const { computeFacetPanelSize } = await import("../../src/pipeline/panel-layout-facet.ts");
    const panels = computeFacetPanelSize({
      nrow: 1,
      ncol: 2,
      freeH: false,
      freeV: false,
      mMax: { top: 0, right: 0, bottom: 0, left: 10 },
      spacing: 0,
      strip: 0,
      gridW: 210,
      gridH: 100,
    });
    // leftCount=1 so left margin once: (210 - 10) / 2 = 100
    expect(panels.panelW).toBe(100);
    expect(panels.panelH).toBe(100);
  });
});

describe("geometryPanelFrame", () => {
  it("swaps extents under coord flip", async () => {
    const { geometryPanelFrame } =
      await import("../../src/pipeline/assemble-geometry-panel-frame.ts");
    const placement = {
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      ticksH: [],
      ticksV: [],
      showAxisX: true,
      showAxisY: true,
    };
    const xScale = {
      type: "linear" as const,
      domain: [0, 1] as [number, number],
      range: [0, 1] as [number, number],
      normalize: (v: number) => v,
    };
    const yScale = {
      type: "linear" as const,
      domain: [0, 1] as [number, number],
      range: [0, 1] as [number, number],
      normalize: (v: number) => v,
    };
    const flipped = geometryPanelFrame(placement, { x: xScale, y: yScale }, true);
    expect(flipped.innerWidth).toBe(40);
    expect(flipped.innerHeight).toBe(80);
    expect(flipped.xScale).toBe(xScale);
  });
});

describe("packFacetPanelPlacement", () => {
  it("shows y-axis only for column 0 when freeV is false", async () => {
    const { packFacetPanelPlacement } = await import("../../src/pipeline/panel-layout-facet.ts");
    const placement = packFacetPanelPlacement({
      def: fromAny({ col: 1, row: 0 }),
      colX: 20,
      rowY: 10,
      panelW: 100,
      panelH: 50,
      freeH: false,
      freeV: false,
      bottomMostRow: 0,
      ticksRun: fromAny({ x: { ticks: [1] }, y: { ticks: [2] } }),
    });
    expect(placement.showAxisX).toBe(true);
    expect(placement.showAxisY).toBe(false);
    expect(placement.x).toBe(20);
  });
});

describe("placeFacetPanelsFromChrome", () => {
  it("places a 1x2 grid with shared y-axis only on col 0", async () => {
    const { placeFacetPanelsFromChrome } = await import("../../src/pipeline/panel-layout-facet.ts");
    const { DEFAULT_FACET_STRIP } = await import("../../src/pipeline/facets-types.ts");
    const { DEFAULT_LAYOUT_THEME } = await import("../../src/layout/layout-types.ts");
    const { FONT_METRICS } = await import("../../src/layout/font-metrics.ts");
    const { MetricsTableMeasurer } = await import("../../src/layout/measure.ts");

    const linearScale = {
      type: "linear" as const,
      domain: [0, 10] as [number, number],
      range: [0, 1] as [number, number],
      normalize: (v: number) => v / 10,
    };
    const axis = {
      x: {
        visible: true,
        showTicks: true,
        showLabels: true,
        collision: "auto" as const,
      },
      y: {
        visible: true,
        showTicks: true,
        showLabels: true,
        collision: "auto" as const,
      },
    };
    const chrome = fromAny({
      freeH: false,
      freeV: false,
      vTitle: "",
      hTitle: "",
      axisTitleBand: 0,
      legendBlock: { width: 0, bottomHeight: 0 },
      layoutHeight: 200,
      topBand: 0,
      displayScales: () => ({ h: linearScale, v: linearScale }),
      displayTemporal: () => ({}),
      displayBand: () => ({}),
      hBreaks: undefined,
      vBreaks: undefined,
      formatH: undefined,
      formatV: undefined,
      measurer: new MetricsTableMeasurer(FONT_METRICS),
      layoutTheme: DEFAULT_LAYOUT_THEME,
    });
    const placements = placeFacetPanelsFromChrome({
      nrow: 1,
      ncol: 2,
      facetPanels: [fromAny({ row: 0, col: 0 }), fromAny({ row: 0, col: 1 })],
      strip: DEFAULT_FACET_STRIP,
      stripBand: 0,
      chrome,
      space: { x: false, y: false },
      axis,
      options: { width: 400 },
    });
    expect(placements).toHaveLength(2);
    expect(placements[0]!.showAxisY).toBe(true);
    expect(placements[1]!.showAxisY).toBe(false);
    expect(placements[0]!.showAxisX).toBe(true);
    expect(placements[1]!.showAxisX).toBe(true);
    expect(placements[0]!.width).toBeGreaterThan(0);
    expect(placements[1]!.x).toBeGreaterThan(placements[0]!.x);
  });
});

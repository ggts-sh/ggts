/**
 * Two-pass panel layout: facet grids and single-panel plots, including
 * axis-title/legend chrome and free-scale edge axes.
 *
 * Public entry: `layoutPanels` (also re-exported from `layout/panels.ts`).
 * Owns placement, chrome, and the resolved axis guides for the run so scene
 * assembly does not re-resolve them (ADR-0003 two-pass layout stands).
 */
import type { PortableSpec, TemporalPrecision, TemporalScaleKind } from "@ggts-sh/spec";

import { planBasicAxis } from "../layout/basic-axis.js";
import {
  assertLegendBlockFitsPlacedArea,
  LegendLayoutError,
  type LegendInput,
  type LegendOrder,
} from "../legend.js";
import type { PositionScale } from "../scales/train.js";
import type { ThemeTokens } from "../theme.js";

import type { FacetPanelDef, FacetStripConfig } from "./facets.js";
import { DEFAULT_FACET_STRIP } from "./facets.js";
import { measureFacetStripBand } from "./facets-strip.js";
import type { AxisGuideAppearance } from "./guide-config.js";
import { LEGEND_EDGE_PAD } from "./layout-helpers.js";
import { containedRightLegendY } from "./legend-right-y.js";
import { resolvePanelLayoutChrome, type PanelLayoutChrome } from "./panel-layout-chrome.js";
import { applyFixedAspectLayout, type FixedAspectCoordSpec } from "./panel-layout-fixed.js";
import { buildPanelPlacements } from "./panel-layout-placements.js";
import type { FacetScaleFreedom, PanelLayoutResult, PanelPlacement } from "./panel-layout-types.js";
import { PipelineError, type LayerFrame, type PipelineWarning, type RunOptions } from "./types.js";

export type { FacetScaleFreedom, PanelLayoutResult, PanelPlacement } from "./panel-layout-types.js";

/** Input to the panel-layout owner. Freedom is one value, not freeX/freeY per hop. */
export interface PanelLayoutInput {
  flip: boolean;
  faceted: boolean;
  freedom: FacetScaleFreedom;
  coordFixed?: FixedAspectCoordSpec | undefined;
  nrow: number;
  ncol: number;
  facetPanels: readonly FacetPanelDef[];
  strip?: FacetStripConfig;
  panelScales: readonly { x: PositionScale; y: PositionScale }[];
  allFrames: readonly LayerFrame[];
  hGuide: AxisGuideAppearance;
  vGuide: AxisGuideAppearance;
  labs: NonNullable<PortableSpec["labs"]>;
  scalesConfig: NonNullable<PortableSpec["scales"]>;
  xScale: PositionScale;
  yScale: PositionScale;
  xTemporalKind: TemporalScaleKind | null;
  yTemporalKind: TemporalScaleKind | null;
  xTemporalPrecision: TemporalPrecision | null;
  yTemporalPrecision: TemporalPrecision | null;
  legendInputs: readonly LegendInput[];
  legendOrder: LegendOrder;
  theme: ThemeTokens;
  layoutAxisTitleSize: number;
  layoutAxisTextSize: number;
  options: Pick<RunOptions, "width" | "height" | "measureText">;
  warnings: PipelineWarning[];
}

function panelLayoutResultFromChrome(
  chrome: PanelLayoutChrome,
  placements: PanelPlacement[],
  strip: import("./facets-types.js").FacetStripConfig,
  stripBand: number,
  guides: { readonly h: AxisGuideAppearance; readonly v: AxisGuideAppearance },
  degraded = false,
): PanelLayoutResult {
  const guidePlans = placements.flatMap((placement, panelIndex) => {
    const { h, v } = chrome.displayScales(panelIndex);
    const hAesthetic = chrome.flip ? "y" : "x";
    const vAesthetic = chrome.flip ? "x" : "y";
    return [
      ...(placement.showAxisX
        ? [
            placement.hGuidePlan ??
              planBasicAxis({
                aesthetic: hAesthetic,
                panelIndex,
                scale: h,
                ticks: placement.ticksH,
                config: chrome.scalesConfig[hAesthetic],
              }),
          ]
        : []),
      ...(placement.showAxisY
        ? [
            placement.vGuidePlan ??
              planBasicAxis({
                aesthetic: vAesthetic,
                panelIndex,
                scale: v,
                ticks: placement.ticksV,
                config: chrome.scalesConfig[vAesthetic],
              }),
          ]
        : []),
    ];
  });
  return {
    placements,
    title: chrome.title,
    subtitle: chrome.subtitle,
    caption: chrome.caption,
    hTitle: chrome.hTitle,
    vTitle: chrome.vTitle,
    xTitle: chrome.xTitle,
    yTitle: chrome.yTitle,
    topBand: chrome.topBand,
    bottomBand: chrome.bottomBand,
    formatX: chrome.formatX,
    formatY: chrome.formatY,
    formatters: { h: chrome.formatH, v: chrome.formatV },
    freeH: chrome.freeH,
    freeV: chrome.freeV,
    guides,
    displayScales: chrome.displayScales,
    legendBlock: chrome.legendBlock,
    guidePlans: Object.freeze(guidePlans),
    strip,
    stripBand,
    degraded,
  };
}

/**
 * Panel placement, chrome, and resolved axis guides.
 * Owns the two-pass layout (ADR-0003) end to end for this plot run.
 */
export function layoutPanels(input: PanelLayoutInput): PanelLayoutResult {
  const { faceted, nrow, ncol, facetPanels, options, freedom } = input;
  const strip = input.strip ?? DEFAULT_FACET_STRIP;
  const freeX = freedom.freeX;
  const freeY = freedom.freeY;

  const chrome = resolvePanelLayoutChrome({
    flip: input.flip,
    freeX,
    freeY,
    panelScales: input.panelScales,
    allFrames: input.allFrames,
    labs: input.labs,
    scalesConfig: input.scalesConfig,
    xScale: input.xScale,
    yScale: input.yScale,
    xTemporalKind: input.xTemporalKind,
    yTemporalKind: input.yTemporalKind,
    xTemporalPrecision: input.xTemporalPrecision,
    yTemporalPrecision: input.yTemporalPrecision,
    legendInputs: input.legendInputs,
    legendOrder: input.legendOrder,
    theme: input.theme,
    layoutAxisTitleSize: input.layoutAxisTitleSize,
    layoutAxisTextSize: input.layoutAxisTextSize,
    options: input.options,
    warnings: input.warnings,
  });
  let stripBand = measureFacetStripBand({
    faceted,
    strip,
    panels: facetPanels,
    measurer: chrome.measurer,
    stripSize: input.theme.stripSize,
  });
  if (chrome.legendBlock.autoMovedBottom) {
    input.warnings.push({
      code: "guide-auto-bottom",
      message:
        "Auto-positioned guides moved below the panel to preserve at least 320 px of readable width.",
    });
  }
  let placements = buildPanelPlacements({
    faceted,
    nrow,
    ncol,
    facetPanels,
    strip,
    stripBand,
    chrome,
    axis: { x: input.hGuide, y: input.vGuide },
    options,
  });
  // Side strips rotate labels: advance becomes vertical. Remeasure the band
  // against the shortest panel height so reserved width matches the capped
  // rotated labels (#611). Left/right strip height does not feed approxH, so
  // one remeasure converges.
  if (
    faceted &&
    strip.show &&
    (strip.position === "left" || strip.position === "right") &&
    placements.length > 0
  ) {
    const sideMaxAdvance = Math.min(...placements.map((placement) => placement.height));
    const cappedBand = measureFacetStripBand({
      faceted,
      strip,
      panels: facetPanels,
      measurer: chrome.measurer,
      stripSize: input.theme.stripSize,
      sideMaxAdvance,
    });
    if (cappedBand !== stripBand) {
      stripBand = cappedBand;
      placements = buildPanelPlacements({
        faceted,
        nrow,
        ncol,
        facetPanels,
        strip,
        stripBand,
        chrome,
        axis: { x: input.hGuide, y: input.vGuide },
        options,
      });
    }
  }
  let degraded = false;
  if (input.coordFixed !== undefined) {
    const fitted = applyFixedAspectLayout({
      placements,
      panelScales: input.panelScales,
      coord: input.coordFixed,
      faceted,
      freeX,
      freeY,
      scalesConfig: input.scalesConfig,
      warnings: input.warnings,
    });
    placements = fitted.placements;
    degraded = fitted.degraded;
  }
  try {
    const bottomInset = chrome.bottomBand + LEGEND_EDGE_PAD;
    const panelY = Math.min(...placements.map((placement) => placement.y));
    const minimumY = Math.min(
      ...placements.map((placement) => placement.allocation?.y ?? placement.y),
    );
    assertLegendBlockFitsPlacedArea({
      block: chrome.legendBlock,
      inputs: input.legendInputs,
      viewportHeight: options.height,
      rightTop: containedRightLegendY({
        legends: chrome.legendBlock.legends,
        panelY,
        minimumY,
        sceneHeight: options.height,
        bottomInset,
      }),
      bottomInset,
    });
  } catch (error) {
    if (!(error instanceof LegendLayoutError)) throw error;
    throw new PipelineError(
      "guide-layout-overflow",
      `/guides/${error.scale}`,
      `${error.message} ${error.recovery}`,
    );
  }

  return panelLayoutResultFromChrome(
    chrome,
    placements,
    strip,
    stripBand,
    { h: input.hGuide, v: input.vGuide },
    degraded,
  );
}

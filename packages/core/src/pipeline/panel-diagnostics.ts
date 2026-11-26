/**
 * Final-layout panel diagnostics: extreme panel aspect (#1884), low
 * vertical panel share (#1885), and tall multi-row facet grids (#1965).
 *
 * All read the committed placements after fixed-aspect fitting, so the
 * numbers match what the scene renders. Each kind is aggregated to at most
 * one warning per run.
 */
import { contrastRatio, isTransparentToken } from "../color-contrast.js";
import type { ThemeTokens } from "../theme.js";
import {
  DEFAULT_AXIS_TITLE_OFFSET,
  LEGEND_EDGE_PAD,
  legendGapFor,
  xAxisBandTitleOffset,
  xTickChromePx,
} from "./layout-helpers.js";
import type { PanelLayoutResult, PanelPlacement } from "./panel-layout-types.js";
import type { PipelineWarning } from "./types.js";

/** Aspect ratios outside `[1/EXTREME_PANEL_ASPECT, EXTREME_PANEL_ASPECT]` warn. */
const EXTREME_PANEL_ASPECT = 4;
/** The panel grid must cover at least this fraction of the plot height. */
const MIN_PANEL_HEIGHT_SHARE = 0.5;
/** Multi-row facet grids taller than one desktop viewport warn. */
const MAX_FACET_GRID_HEIGHT_PX = 1200;
/** WCAG AA minimum contrast ratio for normal-sized facet strip text. */
const MIN_STRIP_CONTRAST_RATIO = 4.5;

export interface PanelDiagnosticsInput {
  panelLayout: PanelLayoutResult;
  viewport: { readonly width: number; readonly height: number };
  /** fixed / sf / radial: the panel ratio is authored, not layout-driven. */
  coordConstrained: boolean;
  /** `theme.panelAspect: "free"` suppresses both panel-shape warnings. */
  suppressed: boolean;
  theme?: Pick<ThemeTokens, "ticksX" | "tickLength"> &
    Partial<Pick<ThemeTokens, "stripFill" | "stripText" | "paper">>;
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Share of the panel grid's variable extent owned by the target's row/column.
 * Extra viewport height/width is distributed by these shares, so unequal
 * `space: "free_y"` rows need more plot growth than equal rows (#1885 audit).
 */
function allocationFraction(
  placements: readonly PanelPlacement[],
  axis: "x" | "y",
  target: PanelPlacement,
): number {
  const size = axis === "x" ? "width" : "height";
  const bands = new Map<number, number>();
  for (const placement of placements) bands.set(placement[axis], placement[size]);
  let total = 0;
  for (const extent of bands.values()) total += extent;
  return target[size] / total;
}

function aspectWarning({ panelLayout, viewport }: PanelDiagnosticsInput): PipelineWarning | null {
  const { placements } = panelLayout;
  let worst: PanelPlacement | null = null;
  let worstDeviation = 0;
  let extremeCount = 0;

  for (const placement of placements) {
    const ratio = placement.width / placement.height;
    const deviation = Math.max(ratio, 1 / ratio);
    if (deviation <= EXTREME_PANEL_ASPECT) continue;
    extremeCount++;
    if (deviation > worstDeviation) {
      worstDeviation = deviation;
      worst = placement;
    }
  }
  if (worst === null) return null;

  const ratio = worst.width / worst.height;
  const aspect = ratio >= 1 ? `${ratio.toFixed(1)}:1` : `1:${(1 / ratio).toFixed(1)}`;
  const count =
    placements.length > 1 ? ` ${extremeCount} of ${placements.length} panels affected;` : "";
  const widen = ratio < 1;
  const target = Math.ceil(
    (widen ? viewport.width : viewport.height) +
      ((widen ? worst.height * 2 : worst.width / 2) - (widen ? worst.width : worst.height)) /
        allocationFraction(placements, widen ? "x" : "y", worst),
  );
  return {
    code: "panel-aspect-extreme",
    message: `Panel aspect is ${aspect} (${Math.round(worst.width)}×${Math.round(worst.height)} px);${count} target about 2:1. ${widen ? "Widen the plot" : "Raise the plot height"} to about ${target} px.`,
  };
}

function gridVerticalBounds(placements: readonly PanelPlacement[]): {
  gridTop: number;
  gridBottom: number;
  gridHeight: number;
} {
  let gridTop = Infinity;
  let gridBottom = -Infinity;
  for (const placement of placements) {
    gridTop = Math.min(gridTop, placement.y);
    gridBottom = Math.max(gridBottom, placement.y + placement.height);
  }
  return { gridTop, gridBottom, gridHeight: gridBottom - gridTop };
}

function shareWarning({ panelLayout, viewport }: PanelDiagnosticsInput): PipelineWarning | null {
  const { placements, topBand, bottomBand, stripBand, strip, legendBlock } = panelLayout;
  const { gridBottom, gridHeight } = gridVerticalBounds(placements);
  if (!isFinitePositive(gridHeight)) return null;
  const share = gridHeight / viewport.height;
  if (share >= MIN_PANEL_HEIGHT_SHARE) return null;

  const verticalStrip =
    strip.show &&
    (strip.position === "top" || strip.position === "bottom") &&
    isFinitePositive(stripBand)
      ? stripBand * Math.max(1, new Set(placements.map((p) => p.y)).size)
      : 0;
  const guideGap =
    legendBlock.bottomHeight > 0
      ? legendGapFor(Math.max(40, viewport.height - topBand - bottomBand)) + LEGEND_EDGE_PAD
      : 0;
  const bottomAxis = Math.max(
    0,
    viewport.height -
      gridBottom -
      bottomBand -
      legendBlock.bottomHeight -
      guideGap -
      (strip.position === "bottom" ? stripBand : 0),
  );

  const blocks = (
    [
      ["title/subtitle", topBand],
      ["facet strips", verticalStrip],
      ["axis", bottomAxis],
      ["guide", legendBlock.bottomHeight],
      ["gaps", guideGap],
      ["caption", bottomBand],
    ] as const
  )
    .filter(([, px]) => Number.isFinite(px) && px >= 1)
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 4);

  const target = Math.ceil((viewport.height - gridHeight) * 2);
  const chrome =
    blocks.length > 0
      ? ` Largest chrome: ${blocks.map(([label, px]) => `${label} ${Math.round(px)} px`).join(", ")}.`
      : "";

  return {
    code: "panel-height-share-low",
    message: `The panel gets ${Math.round(gridHeight)} of ${Math.round(viewport.height)} px (${Math.floor(share * 100)}%).${chrome} Raise the plot height to about ${target} px.`,
  };
}

function tallFacetGridWarning({
  panelLayout,
  theme,
}: PanelDiagnosticsInput): PipelineWarning | null {
  const { placements, guides } = panelLayout;
  const rowCount = new Set(placements.map((p) => p.y)).size;
  if (rowCount <= 1) return null;

  const { gridBottom, gridHeight } = gridVerticalBounds(placements);
  if (!isFinitePositive(gridHeight) || gridHeight <= MAX_FACET_GRID_HEIGHT_PX) return null;

  const tickChromePx =
    theme === undefined ? 9 : xTickChromePx(theme.tickLength, theme.ticksX && guides.h.showTicks);
  const bandOffset = xAxisBandTitleOffset(placements, tickChromePx);
  const titleOffset = bandOffset > 0 ? bandOffset : DEFAULT_AXIS_TITLE_OFFSET;
  const xTitleY = gridBottom + titleOffset;
  const reportedGridHeight = Math.max(MAX_FACET_GRID_HEIGHT_PX + 1, Math.round(gridHeight));
  // Match render-svg-format.ts `px()` 2-decimal rounding before integer rounding.
  const reportedXTitleY = Math.round(Math.round(xTitleY * 100) / 100);

  return {
    code: "facet-grid-too-tall",
    message:
      `The facet grid is ${reportedGridHeight} px tall across ${rowCount} rows; ` +
      `the x axis sits at y=${reportedXTitleY}, below the first ${MAX_FACET_GRID_HEIGHT_PX} px viewport. ` +
      "Repeat the x axis on each row, reduce the rows, or split the chart.",
  };
}

function stripContrastWarning({
  panelLayout,
  theme,
}: PanelDiagnosticsInput): PipelineWarning | null {
  if (!panelLayout.strip.show || panelLayout.stripBand <= 0) return null;
  const stripFill = theme?.stripFill;
  const stripText = theme?.stripText;
  if (stripFill === undefined || stripText === undefined) return null;

  // Facet strips paint outside .gg-panel over .gg-paper (not .gg-panel-background).
  // When both stripFill and paper are transparent, the host page provides the surface.
  const paper = theme?.paper;
  const backdrop = paper !== undefined && !isTransparentToken(paper) ? paper : undefined;
  let effectiveBg = stripFill;
  if (isTransparentToken(stripFill)) {
    if (backdrop === undefined) return null;
    effectiveBg = backdrop;
  }

  const ratio = contrastRatio(
    stripText,
    effectiveBg,
    backdrop === undefined ? undefined : { backdrop },
  );
  if (ratio === null || ratio >= MIN_STRIP_CONTRAST_RATIO) return null;

  return {
    code: "strip-contrast-low",
    message:
      `Facet strip text (${stripText}) on strip background (${effectiveBg}) has WCAG contrast ${ratio.toFixed(2)}:1, below the 4.5:1 AA minimum. ` +
      "Set theme.stripText and theme.stripFill to a higher-contrast pair.",
  };
}

/**
 * Collect final-layout panel warnings. Invalid/degenerate viewports and
 * placements produce nothing; coordinate-constrained proportions and
 * `theme.panelAspect: "free"` escape aspect/share checks, while multi-row
 * facet-grid height and facet-strip contrast still warn.
 */
export function collectPanelLayoutWarnings(input: PanelDiagnosticsInput): PipelineWarning[] {
  const { viewport } = input;
  const { placements } = input.panelLayout;
  if (!isFinitePositive(viewport.width) || !isFinitePositive(viewport.height)) return [];
  for (const placement of placements) {
    if (!isFinitePositive(placement.width) || !isFinitePositive(placement.height)) return [];
    if (!Number.isFinite(placement.x) || !Number.isFinite(placement.y)) return [];
  }

  const candidates: (PipelineWarning | null)[] = [
    ...(input.suppressed || input.coordConstrained
      ? []
      : [aspectWarning(input), shareWarning(input)]),
    tallFacetGridWarning(input),
    stripContrastWarning(input),
  ];
  return candidates.filter((warning): warning is PipelineWarning => warning !== null);
}

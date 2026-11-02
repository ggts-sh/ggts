/**
 * Single-panel layout placement with axis-title and legend reserves.
 */
import type {
  BandLayoutDomainContext,
  LayoutAxisPresentation,
  LayoutResult,
  LayoutTheme,
  Margins,
  TemporalLayoutDomainContext,
  TickFormatter,
} from "../layout/layout.js";
import { layout } from "../layout/layout.js";
import type { TextMeasurer } from "../layout/measure.js";
import type { PositionScale } from "../scales/train.js";

import { LEGEND_EDGE_PAD, LEGEND_GAP, layoutDomain, legendGapFor } from "./layout-helpers.js";
import type { PanelLayoutChrome } from "./panel-layout-chrome.js";
import type { PanelPlacement } from "./panel-layout-types.js";
import type { RunOptions } from "./types.js";

export function singlePanelMarginReserve(
  hTitle: string,
  vTitle: string,
  axisTitleBand: number,
  legendWidth: number,
  legendBottomHeight: number,
  layoutHeight = 800,
): Partial<Margins> {
  return {
    ...((hTitle !== "" || legendBottomHeight > 0) && {
      bottom:
        (hTitle === "" ? 0 : axisTitleBand) +
        (legendBottomHeight > 0
          ? legendBottomHeight + legendGapFor(layoutHeight) + LEGEND_EDGE_PAD
          : 0),
    }),
    ...(vTitle !== "" && { left: axisTitleBand }),
    ...(legendWidth > 0 && { right: legendWidth + LEGEND_GAP + LEGEND_EDGE_PAD }),
  };
}

function singlePanelPlacementFromLayout(
  layoutResult: LayoutResult,
  optionsWidth: number,
  layoutHeight: number,
  topBand: number,
): PanelPlacement {
  const margins = layoutResult.margins;
  return {
    x: margins.left,
    y: topBand + margins.top,
    width: Math.max(1, optionsWidth - margins.left - margins.right),
    height: Math.max(1, layoutHeight - margins.top - margins.bottom),
    ticksH: layoutResult.x.ticks,
    ticksV: layoutResult.y.ticks,
    ...(layoutResult.x.guidePlan !== undefined && { hGuidePlan: layoutResult.x.guidePlan }),
    ...(layoutResult.y.guidePlan !== undefined && { vGuidePlan: layoutResult.y.guidePlan }),
    showAxisX: true,
    showAxisY: true,
  };
}

function placeSinglePanel(input: {
  h: PositionScale;
  v: PositionScale;
  hTemporal?: TemporalLayoutDomainContext;
  vTemporal?: TemporalLayoutDomainContext;
  hBand?: BandLayoutDomainContext;
  vBand?: BandLayoutDomainContext;
  hTitle: string;
  vTitle: string;
  axisTitleBand: number;
  legendWidth: number;
  legendBottomHeight: number;
  optionsWidth: number;
  layoutHeight: number;
  topBand: number;
  hBreaks: readonly (number | string)[] | undefined;
  vBreaks: readonly (number | string)[] | undefined;
  formatH: TickFormatter | undefined;
  formatV: TickFormatter | undefined;
  measurer: TextMeasurer;
  layoutTheme: LayoutTheme;
  axis: Readonly<{ x: LayoutAxisPresentation; y: LayoutAxisPresentation }>;
}): PanelPlacement {
  const {
    h,
    v,
    hTemporal,
    vTemporal,
    hBand,
    vBand,
    hTitle,
    vTitle,
    axisTitleBand,
    legendWidth,
    legendBottomHeight,
    optionsWidth,
    layoutHeight,
    topBand,
    hBreaks,
    vBreaks,
    formatH,
    formatV,
    measurer,
    layoutTheme,
    axis,
  } = input;

  const layoutResult = layout({
    width: optionsWidth,
    height: layoutHeight,
    x: layoutDomain(h, hBreaks, hTemporal, hBand),
    y: layoutDomain(v, vBreaks, vTemporal, vBand),
    ...(formatH !== undefined && { formatX: formatH }),
    ...(formatV !== undefined && { formatY: formatV }),
    measurer,
    axis,
    reserve: singlePanelMarginReserve(
      hTitle,
      vTitle,
      axisTitleBand,
      legendWidth,
      legendBottomHeight,
      layoutHeight,
    ),
    theme: layoutTheme,
  });
  return singlePanelPlacementFromLayout(layoutResult, optionsWidth, layoutHeight, topBand);
}

export function placeSinglePanelFromChrome(
  chrome: PanelLayoutChrome,
  axis: Readonly<{ x: LayoutAxisPresentation; y: LayoutAxisPresentation }>,
  options: Pick<RunOptions, "width">,
): PanelPlacement {
  const { h, v } = chrome.displayScales(0);
  const temporal = chrome.displayTemporal(0);
  const band = chrome.displayBand(0);
  return placeSinglePanel({
    h,
    v,
    ...(temporal.h !== undefined && { hTemporal: temporal.h }),
    ...(temporal.v !== undefined && { vTemporal: temporal.v }),
    ...(band.h !== undefined && { hBand: band.h }),
    ...(band.v !== undefined && { vBand: band.v }),
    hTitle: chrome.hTitle,
    vTitle: chrome.vTitle,
    axisTitleBand: chrome.axisTitleBand,
    legendWidth: chrome.legendBlock.width,
    legendBottomHeight: chrome.legendBlock.bottomHeight,
    optionsWidth: options.width,
    layoutHeight: chrome.layoutHeight,
    topBand: chrome.topBand,
    hBreaks: chrome.hBreaks,
    vBreaks: chrome.vBreaks,
    formatH: chrome.formatH,
    formatV: chrome.formatV,
    measurer: chrome.measurer,
    layoutTheme: chrome.layoutTheme,
    axis,
  });
}

/**
 * Facet-grid placement: pack panel placements from ticks and chrome entrypoint.
 */
import type {
  BandLayoutDomainContext,
  LayoutAxisPresentation,
  LayoutTheme,
  Margins,
  PassResult,
  TemporalLayoutDomainContext,
  TickFormatter,
} from "../layout/layout.js";
import { layoutPass } from "../layout/layout.js";
import type { TextMeasurer } from "../layout/measure.js";
import type { AxisGuidePlan } from "../layout/temporal-guide.js";
import type { PositionScale } from "../scales/train.js";

import type { FacetPanelDef } from "./facets.js";
import type { FacetStripConfig } from "./facets-types.js";
import { layoutDomain } from "./layout-helpers.js";
import type { PanelLayoutChrome } from "./panel-layout-chrome.js";
import { computeFacetGridGeometry } from "./panel-layout-facet-geometry.js";
import type { FacetGridLayoutInput } from "./panel-layout-facet-types.js";
import type { FacetSpaceFlags } from "./panel-layout-types.js";
import type {
  DisplayBandFn,
  DisplayScalesFn,
  DisplayTemporalFn,
  PanelPlacement,
} from "./panel-layout-types.js";
import type { RunOptions } from "./types.js";

export function packFacetPanelPlacement(input: {
  def: FacetPanelDef;
  colX: number;
  rowY: number;
  panelW: number;
  panelH: number;
  freeH: boolean;
  freeV: boolean;
  bottomMostRow: number;
  ticksRun: PassResult;
}): PanelPlacement {
  const { def, colX, rowY, panelW, panelH, freeH, freeV, bottomMostRow, ticksRun } = input;
  return {
    x: colX,
    y: rowY,
    width: panelW,
    height: panelH,
    ticksH: ticksRun.x.ticks,
    ticksV: ticksRun.y.ticks,
    ...(ticksRun.x.guidePlan !== undefined && { hGuidePlan: ticksRun.x.guidePlan }),
    ...(ticksRun.y.guidePlan !== undefined && { vGuidePlan: ticksRun.y.guidePlan }),
    showAxisX: freeH || def.row === bottomMostRow,
    showAxisY: freeV || def.col === 0,
  };
}

function placeFacetPanelFromTicks(input: {
  def: FacetPanelDef;
  h: PositionScale;
  v: PositionScale;
  hTemporal?: TemporalLayoutDomainContext;
  vTemporal?: TemporalLayoutDomainContext;
  hBand?: BandLayoutDomainContext;
  vBand?: BandLayoutDomainContext;
  mMax: Margins;
  previousGuidePlans?: Readonly<{ x?: AxisGuidePlan; y?: AxisGuidePlan }>;
  panelW: number;
  panelH: number;
  colX: number;
  rowY: number;
  freeH: boolean;
  freeV: boolean;
  bottomMostRow: number;
  hBreaks: readonly (number | string)[] | undefined;
  vBreaks: readonly (number | string)[] | undefined;
  formatH: TickFormatter | undefined;
  formatV: TickFormatter | undefined;
  measurer: TextMeasurer;
  layoutTheme: LayoutTheme;
  axis: Readonly<{ x: LayoutAxisPresentation; y: LayoutAxisPresentation }>;
}): PanelPlacement {
  const {
    def,
    h,
    v,
    hTemporal,
    vTemporal,
    hBand,
    vBand,
    mMax,
    previousGuidePlans,
    panelW,
    panelH,
    colX,
    rowY,
    freeH,
    freeV,
    bottomMostRow,
    hBreaks,
    vBreaks,
    formatH,
    formatV,
    measurer,
    layoutTheme,
    axis,
  } = input;

  const ticksRun = layoutPass(
    mMax,
    {
      width: panelW + mMax.left + mMax.right,
      height: panelH + mMax.top + mMax.bottom,
      x: layoutDomain(h, hBreaks, hTemporal, hBand),
      y: layoutDomain(v, vBreaks, vTemporal, vBand),
      ...(formatH !== undefined && { formatX: formatH }),
      ...(formatV !== undefined && { formatY: formatV }),
      ...(previousGuidePlans !== undefined && { previousGuidePlans }),
      measurer,
      axis,
    },
    layoutTheme,
  );
  return packFacetPanelPlacement({
    def,
    colX,
    rowY,
    panelW,
    panelH,
    freeH,
    freeV,
    bottomMostRow,
    ticksRun,
  });
}

function mapFacetPanelPlacements(input: {
  facetPanels: readonly FacetPanelDef[];
  freeH: boolean;
  freeV: boolean;
  displayScales: DisplayScalesFn;
  displayTemporal: DisplayTemporalFn;
  displayBand: DisplayBandFn;
  mMax: Margins;
  previousGuidePlans: readonly Readonly<{ x?: AxisGuidePlan; y?: AxisGuidePlan }>[];
  colW: number[];
  rowH: number[];
  colX: number[];
  rowY: number[];
  bottomMostRow: number[];
  hBreaks: readonly (number | string)[] | undefined;
  vBreaks: readonly (number | string)[] | undefined;
  formatH: TickFormatter | undefined;
  formatV: TickFormatter | undefined;
  measurer: TextMeasurer;
  layoutTheme: LayoutTheme;
  axis: Readonly<{ x: LayoutAxisPresentation; y: LayoutAxisPresentation }>;
}): PanelPlacement[] {
  const {
    facetPanels,
    freeH,
    freeV,
    displayScales,
    displayTemporal,
    displayBand,
    mMax,
    previousGuidePlans,
    colW,
    rowH,
    colX,
    rowY,
    bottomMostRow,
    hBreaks,
    vBreaks,
    formatH,
    formatV,
    measurer,
    layoutTheme,
    axis,
  } = input;

  return facetPanels.map((def, p) => {
    const { h, v } = displayScales(p);
    const temporal = displayTemporal(p);
    const band = displayBand(p);
    return placeFacetPanelFromTicks({
      def,
      h,
      v,
      ...(temporal.h !== undefined && { hTemporal: temporal.h }),
      ...(temporal.v !== undefined && { vTemporal: temporal.v }),
      ...(band.h !== undefined && { hBand: band.h }),
      ...(band.v !== undefined && { vBand: band.v }),
      mMax,
      ...(previousGuidePlans[p] !== undefined && {
        previousGuidePlans: previousGuidePlans[p],
      }),
      panelW: colW[def.col]!,
      panelH: rowH[def.row]!,
      colX: colX[def.col]!,
      rowY: rowY[def.row]!,
      freeH,
      freeV,
      bottomMostRow: bottomMostRow[def.col]!,
      hBreaks,
      vBreaks,
      formatH,
      formatV,
      measurer,
      layoutTheme,
      axis,
    });
  });
}

function placeFacetPanels(input: FacetGridLayoutInput): PanelPlacement[] {
  const geometry = computeFacetGridGeometry(input);
  return mapFacetPanelPlacements({
    facetPanels: input.facetPanels,
    freeH: input.freeH,
    freeV: input.freeV,
    displayScales: input.displayScales,
    displayTemporal: input.displayTemporal,
    displayBand: input.displayBand,
    mMax: geometry.mMax,
    previousGuidePlans: geometry.previousGuidePlans,
    colW: geometry.colW,
    rowH: geometry.rowH,
    colX: geometry.colX,
    rowY: geometry.rowY,
    bottomMostRow: geometry.bottomMostRow,
    hBreaks: input.hBreaks,
    vBreaks: input.vBreaks,
    formatH: input.formatH,
    formatV: input.formatV,
    measurer: input.measurer,
    layoutTheme: input.layoutTheme,
    axis: input.axis,
  });
}

export function placeFacetPanelsFromChrome(input: {
  nrow: number;
  ncol: number;
  facetPanels: readonly FacetPanelDef[];
  strip: FacetStripConfig;
  stripBand: number;
  chrome: PanelLayoutChrome;
  space: FacetSpaceFlags;
  axis: Readonly<{ x: LayoutAxisPresentation; y: LayoutAxisPresentation }>;
  options: Pick<RunOptions, "width">;
}): PanelPlacement[] {
  const { nrow, ncol, facetPanels, strip, stripBand, chrome, space, axis, options } = input;
  return placeFacetPanels({
    facetPanels,
    nrow,
    ncol,
    freeH: chrome.freeH,
    freeV: chrome.freeV,
    spaceH: chrome.flip ? space.y : space.x,
    spaceV: chrome.flip ? space.x : space.y,
    outerLeftTitle: chrome.vTitle,
    outerBottomTitle: chrome.hTitle,
    axisTitleBand: chrome.axisTitleBand,
    legendWidth: chrome.legendBlock.width,
    legendBottomHeight: chrome.legendBlock.bottomHeight,
    optionsWidth: options.width,
    layoutHeight: chrome.layoutHeight,
    topBand: chrome.topBand,
    stripBand,
    stripConfig: strip,
    displayScales: chrome.displayScales,
    displayTemporal: chrome.displayTemporal,
    displayBand: chrome.displayBand,
    hBreaks: chrome.hBreaks,
    vBreaks: chrome.vBreaks,
    formatH: chrome.formatH,
    formatV: chrome.formatV,
    measurer: chrome.measurer,
    layoutTheme: chrome.layoutTheme,
    axis,
  });
}

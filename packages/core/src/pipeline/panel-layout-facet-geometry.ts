/**
 * Facet-grid geometry: outer chrome, shared margins, panel sizes (facet_grid
 * `space`), col/row origins.
 */
import type {
  LayoutAxisPresentation,
  LayoutTheme,
  Margins,
  TickFormatter,
} from "../layout/layout.js";
import { layout } from "../layout/layout.js";
import type { TextMeasurer } from "../layout/measure.js";
import type { AxisGuidePlan } from "../layout/temporal-guide.js";
import { PANEL_SPACING } from "../scene.js";
import type { PositionScale } from "../scales/train.js";

import type { FacetPanelDef } from "./facets.js";
import { DEFAULT_FACET_STRIP, type FacetStripConfig } from "./facets-types.js";
import { isVerticalStrip } from "./facets-strip.js";
import {
  elementwiseMaxMargins,
  LEGEND_EDGE_PAD,
  LEGEND_GAP,
  layoutDomain,
} from "./layout-helpers.js";
import type { FacetGridLayoutInput } from "./panel-layout-facet-types.js";
import type { DisplayBandFn, DisplayScalesFn, DisplayTemporalFn } from "./panel-layout-types.js";

interface FacetOuterChrome {
  spacing: number;
  strip: number;
  stripConfig: FacetStripConfig;
  outerLeft: number;
  outerBottom: number;
  outerRight: number;
  gridW: number;
  gridH: number;
  approxW: number;
  approxH: number;
}

interface FacetSharedMarginsResult {
  margins: Margins;
  previousGuidePlans: readonly Readonly<{ x?: AxisGuidePlan; y?: AxisGuidePlan }>[];
}

interface FacetCellGeometry {
  colW: number[];
  rowH: number[];
  colX: number[];
  rowY: number[];
  bottomMostRow: number[];
}

export interface FacetGridGeometry {
  mMax: Margins;
  previousGuidePlans: readonly Readonly<{ x?: AxisGuidePlan; y?: AxisGuidePlan }>[];
  colW: number[];
  rowH: number[];
  colX: number[];
  rowY: number[];
  bottomMostRow: number[];
}

/** Display-axis length of a panel scale: band category count, or the expanded continuous span. */
function scaleLength(scale: PositionScale): number {
  return scale.type === "band"
    ? scale.domain.length
    : Math.abs(scale.transformedDomain[1] - scale.transformedDomain[0]);
}

/**
 * facet_grid(space = "free_*") size multipliers for each column (or row). They
 * average 1 and follow the longest panel scale in that column, so one data unit
 * has the same physical size in every panel. Fixed space, or no measurable
 * length, gives every column the same size.
 */
function spaceShares(input: {
  free: boolean;
  count: number;
  facetPanels: readonly FacetPanelDef[];
  slotOf: (def: FacetPanelDef) => number;
  lengthOf: (panelIndex: number) => number;
}): number[] {
  const lengths = Array.from({ length: input.count }, () => 0);
  if (input.free) {
    input.facetPanels.forEach((def, p) => {
      const slot = input.slotOf(def);
      lengths[slot] = Math.max(lengths[slot]!, input.lengthOf(p));
    });
  }
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!(total > 0)) return lengths.map(() => 1);
  return lengths.map((length) => (length * input.count) / total);
}

function computeFacetOuterChrome(input: {
  nrow: number;
  ncol: number;
  outerLeftTitle: string;
  outerBottomTitle: string;
  axisTitleBand: number;
  legendWidth: number;
  legendBottomHeight: number;
  optionsWidth: number;
  layoutHeight: number;
  stripBand: number;
  stripConfig: FacetStripConfig;
}): FacetOuterChrome {
  const {
    nrow,
    ncol,
    outerLeftTitle,
    outerBottomTitle,
    axisTitleBand,
    legendWidth,
    legendBottomHeight,
    optionsWidth,
    layoutHeight,
    stripBand,
    stripConfig,
  } = input;

  const spacing = PANEL_SPACING;
  const outerLeft = outerLeftTitle === "" ? 0 : axisTitleBand;
  const outerBottom =
    (outerBottomTitle === "" ? 0 : axisTitleBand) +
    (legendBottomHeight > 0 ? legendBottomHeight + LEGEND_GAP + LEGEND_EDGE_PAD : 0);
  const outerRight = legendWidth > 0 ? legendWidth + LEGEND_GAP + LEGEND_EDGE_PAD : 0;
  const gridW = Math.max(40, optionsWidth - outerLeft - outerRight);
  const gridH = Math.max(40, layoutHeight - outerBottom);
  const vertical = isVerticalStrip(stripConfig.position);
  const stripH = vertical ? nrow * stripBand : 0;
  const stripW = vertical ? 0 : ncol * stripBand;
  const approxW = Math.max(40, (gridW - stripW - (ncol - 1) * spacing) / ncol);
  const approxH = Math.max(40, (gridH - stripH - (nrow - 1) * spacing) / nrow);

  return {
    spacing,
    strip: stripBand,
    stripConfig,
    outerLeft,
    outerBottom,
    outerRight,
    gridW,
    gridH,
    approxW,
    approxH,
  };
}

function computeFacetSharedMargins(input: {
  facetPanels: readonly FacetPanelDef[];
  sizeOf: (def: FacetPanelDef) => { width: number; height: number };
  displayScales: DisplayScalesFn;
  displayTemporal: DisplayTemporalFn;
  displayBand: DisplayBandFn;
  hBreaks: readonly (number | string)[] | undefined;
  vBreaks: readonly (number | string)[] | undefined;
  formatH: TickFormatter | undefined;
  formatV: TickFormatter | undefined;
  measurer: TextMeasurer;
  layoutTheme: LayoutTheme;
  axis: Readonly<{ x: LayoutAxisPresentation; y: LayoutAxisPresentation }>;
}): FacetSharedMarginsResult {
  const {
    facetPanels,
    sizeOf,
    displayScales,
    displayTemporal,
    displayBand,
    hBreaks,
    vBreaks,
    formatH,
    formatV,
    measurer,
    layoutTheme,
    axis,
  } = input;

  let mMax: Margins = { top: 0, right: 0, bottom: 0, left: 0 };
  const previousGuidePlans: Readonly<{ x?: AxisGuidePlan; y?: AxisGuidePlan }>[] = [];
  for (let p = 0; p < facetPanels.length; p++) {
    const { h, v } = displayScales(p);
    const temporal = displayTemporal(p);
    const band = displayBand(p);
    const run = layout({
      ...sizeOf(facetPanels[p]!),
      x: layoutDomain(h, hBreaks, temporal.h, band.h),
      y: layoutDomain(v, vBreaks, temporal.v, band.v),
      ...(formatH !== undefined && { formatX: formatH }),
      ...(formatV !== undefined && { formatY: formatV }),
      measurer,
      axis,
      theme: layoutTheme,
    });
    mMax = elementwiseMaxMargins(mMax, run.margins);
    previousGuidePlans.push(
      Object.freeze({
        ...(run.x.guidePlan !== undefined && { x: run.x.guidePlan }),
        ...(run.y.guidePlan !== undefined && { y: run.y.guidePlan }),
      }),
    );
  }
  return {
    margins: mMax,
    previousGuidePlans: Object.freeze(previousGuidePlans),
  };
}

export function computeFacetPanelSize(input: {
  nrow: number;
  ncol: number;
  freeH: boolean;
  freeV: boolean;
  mMax: Margins;
  spacing: number;
  strip: number;
  stripConfig?: FacetStripConfig;
  gridW: number;
  gridH: number;
}): { panelW: number; panelH: number } {
  const {
    nrow,
    ncol,
    freeH,
    freeV,
    mMax,
    spacing,
    strip,
    stripConfig = DEFAULT_FACET_STRIP,
    gridW,
    gridH,
  } = input;
  const leftCount = freeV ? ncol : 1;
  const bottomCount = freeH ? nrow : 1;
  const vertical = isVerticalStrip(stripConfig.position);
  const stripW = vertical ? 0 : ncol * strip;
  const stripH = vertical ? nrow * strip : 0;
  const panelW = Math.max(
    1,
    (gridW - leftCount * mMax.left - mMax.right - stripW - (ncol - 1) * spacing) / ncol,
  );
  const panelH = Math.max(
    1,
    (gridH - mMax.top - bottomCount * mMax.bottom - stripH - (nrow - 1) * spacing) / nrow,
  );
  return { panelW, panelH };
}

function computeFacetColRowPlacements(input: {
  facetPanels: readonly FacetPanelDef[];
  nrow: number;
  ncol: number;
  freeH: boolean;
  freeV: boolean;
  mMax: Margins;
  outerLeft: number;
  topBand: number;
  spacing: number;
  strip: number;
  stripConfig?: FacetStripConfig;
  colW: readonly number[];
  rowH: readonly number[];
}): { colX: number[]; rowY: number[]; bottomMostRow: number[] } {
  const {
    facetPanels,
    nrow,
    ncol,
    freeH,
    freeV,
    mMax,
    outerLeft,
    topBand,
    spacing,
    strip,
    stripConfig = DEFAULT_FACET_STRIP,
    colW,
    rowH,
  } = input;

  const colX: number[] = [];
  let xCursor = outerLeft;
  for (let c = 0; c < ncol; c++) {
    if (stripConfig.position === "left") xCursor += strip;
    if (c === 0 || freeV) xCursor += mMax.left;
    colX.push(xCursor);
    xCursor += colW[c]!;
    if (stripConfig.position === "right") xCursor += strip;
    xCursor += spacing;
  }

  const rowY: number[] = [];
  let yCursor = topBand + mMax.top;
  for (let r = 0; r < nrow; r++) {
    if (stripConfig.position === "top") yCursor += strip;
    rowY.push(yCursor);
    yCursor += rowH[r]!;
    if (r === nrow - 1 || freeH) yCursor += mMax.bottom;
    if (stripConfig.position === "bottom") yCursor += strip;
    yCursor += spacing;
  }

  const bottomMostRow: number[] = Array.from({ length: ncol }, () => 0);
  for (const def of facetPanels) {
    if (def.row > bottomMostRow[def.col]!) bottomMostRow[def.col] = def.row;
  }

  return { colX, rowY, bottomMostRow };
}

function computeFacetCellGeometry(input: {
  facetPanels: readonly FacetPanelDef[];
  nrow: number;
  ncol: number;
  freeH: boolean;
  freeV: boolean;
  mMax: Margins;
  outerLeft: number;
  topBand: number;
  spacing: number;
  strip: number;
  stripConfig: FacetStripConfig;
  gridW: number;
  gridH: number;
  colShare: readonly number[];
  rowShare: readonly number[];
}): FacetCellGeometry {
  const { panelW, panelH } = computeFacetPanelSize(input);
  const colW = input.colShare.map((share) => Math.max(1, panelW * share));
  const rowH = input.rowShare.map((share) => Math.max(1, panelH * share));
  const { colX, rowY, bottomMostRow } = computeFacetColRowPlacements({ ...input, colW, rowH });
  return { colW, rowH, colX, rowY, bottomMostRow };
}

function hasBandPlan(shared: FacetSharedMarginsResult): boolean {
  return shared.previousGuidePlans.some(
    (g) => g.x?.scaleType === "band" || g.y?.scaleType === "band",
  );
}

export function computeFacetGridGeometry(input: FacetGridLayoutInput): FacetGridGeometry {
  const outer = computeFacetOuterChrome({
    nrow: input.nrow,
    ncol: input.ncol,
    outerLeftTitle: input.outerLeftTitle,
    outerBottomTitle: input.outerBottomTitle,
    axisTitleBand: input.axisTitleBand,
    legendWidth: input.legendWidth,
    legendBottomHeight: input.legendBottomHeight,
    optionsWidth: input.optionsWidth,
    layoutHeight: input.layoutHeight,
    stripBand: input.stripBand,
    stripConfig: input.stripConfig,
  });

  const sharedInput = {
    facetPanels: input.facetPanels,
    displayScales: input.displayScales,
    displayTemporal: input.displayTemporal,
    displayBand: input.displayBand,
    hBreaks: input.hBreaks,
    vBreaks: input.vBreaks,
    formatH: input.formatH,
    formatV: input.formatV,
    measurer: input.measurer,
    layoutTheme: input.layoutTheme,
    axis: input.axis,
  };

  const colShare = spaceShares({
    free: input.spaceH,
    count: input.ncol,
    facetPanels: input.facetPanels,
    slotOf: (def) => def.col,
    lengthOf: (p) => scaleLength(input.displayScales(p).h),
  });
  const rowShare = spaceShares({
    free: input.spaceV,
    count: input.nrow,
    facetPanels: input.facetPanels,
    slotOf: (def) => def.row,
    lengthOf: (p) => scaleLength(input.displayScales(p).v),
  });

  const cellInput = {
    facetPanels: input.facetPanels,
    nrow: input.nrow,
    ncol: input.ncol,
    freeH: input.freeH,
    freeV: input.freeV,
    outerLeft: outer.outerLeft,
    topBand: input.topBand,
    spacing: outer.spacing,
    strip: outer.strip,
    stripConfig: outer.stripConfig,
    gridW: outer.gridW,
    gridH: outer.gridH,
    colShare,
    rowShare,
  };

  const shared = computeFacetSharedMargins({
    ...sharedInput,
    sizeOf: (def) => ({
      width: outer.approxW * colShare[def.col]!,
      height: outer.approxH * rowShare[def.row]!,
    }),
  });
  const cells = computeFacetCellGeometry({ ...cellInput, mMax: shared.margins });

  if (hasBandPlan(shared)) {
    const shared2 = computeFacetSharedMargins({
      ...sharedInput,
      sizeOf: (def) => ({
        width: cells.colW[def.col]! + shared.margins.left + shared.margins.right,
        height: cells.rowH[def.row]! + shared.margins.top + shared.margins.bottom,
      }),
    });
    const mMax = elementwiseMaxMargins(shared.margins, shared2.margins);
    const cells2 = computeFacetCellGeometry({ ...cellInput, mMax });
    return {
      mMax,
      previousGuidePlans: shared2.previousGuidePlans,
      ...cells2,
    };
  }

  return {
    mMax: shared.margins,
    previousGuidePlans: shared.previousGuidePlans,
    ...cells,
  };
}

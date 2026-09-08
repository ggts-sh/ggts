/**
 * Boxplot box body: hinge rects, whisker segments, and fattened median.
 */
import type { BoxplotParams } from "@ggts-sh/spec";

import type { GeometryBatch, RectsBatch } from "../scene.js";

import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";

import type { Frame } from "./geometry-shared.js";
import {
  DEFAULT_BOXPLOT_WIDTH,
  MAX_BOXPLOT_PANEL_FRAC,
  removedWarning,
} from "./geometry-shared.js";
import { constantStyle, mappedPaintVector } from "./geometry-style.js";

/** Median line draws at 2× the box linewidth (ggplot2's fatten = 2). */
const BOX_MEDIAN_FATTEN = 2;
const DEFAULT_BOX_LINEWIDTH = 1;

export interface BoxplotBodyResult {
  batches: GeometryBatch[];
  /** Panel-local x centers per box row (NaN when the row was dropped). */
  centerPx: number[];
  linewidth: number;
  alpha: number;
  keptRows: number[];
  params: BoxplotParams;
}

interface BoxplotRowGeometry {
  centerPx: number;
  rect: readonly [number, number, number, number];
  whiskers: readonly [number, number, number, number, number, number, number, number];
  median: readonly [number, number, number, number];
  sourceRow: number;
}

interface BoxplotBodyLayout {
  centerPx: number[];
  rects: number[];
  rectRows: number[];
  keptRows: number[];
  whiskers: number[];
  whiskerRows: number[];
  medians: number[];
  medianRows: number[];
  linewidth: number;
  alpha: number;
  params: BoxplotParams;
}

function layoutBoxplotBodyRow(input: {
  frame: LayerFrame;
  fx: Frame;
  row: number;
  widthFrac: number;
  yPx: (v: number) => number;
}): BoxplotRowGeometry | null {
  const { frame, fx, row, widthFrac, yPx } = input;
  const box = frame.box!;
  if (fx.xScale.type !== "band") return null;
  const tc = fx.xScale.normalize(frame.xValues?.[row] ?? null);
  const lo = frame.ymin![row]!;
  const q1 = box.lower[row]!;
  const q2 = box.middle[row]!;
  const q3 = box.upper[row]!;
  const hi = frame.ymax![row]!;
  const yLo = yPx(lo);
  const yQ1 = yPx(q1);
  const yQ2 = yPx(q2);
  const yQ3 = yPx(q3);
  const yHi = yPx(hi);
  if (tc === undefined || ![yLo, yQ1, yQ2, yQ3, yHi].every((v) => Number.isFinite(v))) {
    return null;
  }
  let center = tc;
  let w = widthFrac;
  if (frame.dodge !== null) {
    const slotCount = Math.max(1, frame.dodge.slotCounts[row]!);
    w = widthFrac / slotCount;
    center = tc + widthFrac * ((frame.dodge.slot[row]! + 0.5) / slotCount - 0.5);
  }
  const cx = center * fx.innerWidth;
  const half = (w / 2) * fx.innerWidth;
  return {
    centerPx: cx,
    rect: [cx - half, Math.min(yQ3, yQ1), half * 2, Math.abs(yQ1 - yQ3)],
    whiskers: [cx, yQ3, cx, yHi, cx, yQ1, cx, yLo],
    median: [cx - half, yQ2, cx + half, yQ2],
    sourceRow: frame.rowIndex[row]!,
  };
}

function layoutBoxplotBody(
  frame: LayerFrame,
  fx: Frame,
  warnings: PipelineWarning[],
): BoxplotBodyLayout | null {
  const { binding, n } = frame;
  const box = frame.box;
  if (
    box === null ||
    frame.ymin === null ||
    frame.ymax === null ||
    fx.xScale.type !== "band" ||
    fx.yScale.type === "band"
  ) {
    return null;
  }
  const params = (binding.layer.params ?? {}) as BoxplotParams;
  const widthParam = params.width ?? DEFAULT_BOXPLOT_WIDTH;
  let widthFrac = widthParam * fx.xScale.step;
  // Few categories make band.step large; cap the default so boxes stay
  // distribution-shaped. Authors who set `width` keep the uncapped fraction.
  if (params.width === undefined) {
    widthFrac = Math.min(widthFrac, MAX_BOXPLOT_PANEL_FRAC);
  }
  const linewidth = constantStyle(binding, params, "linewidth", DEFAULT_BOX_LINEWIDTH);
  const alpha = constantStyle(binding, params, "alpha", 1);
  const yScale = fx.yScale;

  const centerPx: number[] = [];
  const rects: number[] = [];
  const rectRows: number[] = [];
  const keptRows: number[] = [];
  const whiskers: number[] = [];
  const whiskerRows: number[] = [];
  const medians: number[] = [];
  const medianRows: number[] = [];
  let removed = 0;
  // box.lower/middle/upper and frame.ymin/ymax are stat_boxplot's aggregate
  // output over already-transformed y (scale-space); normalizeTransformed
  // skips the forward so they are never transformed twice.
  const yPx = (v: number) => fx.innerHeight - yScale.normalizeTransformed(v) * fx.innerHeight;

  for (let row = 0; row < n; row++) {
    const geom = layoutBoxplotBodyRow({ frame, fx, row, widthFrac, yPx });
    if (geom === null) {
      removed++;
      centerPx.push(NaN);
      continue;
    }
    centerPx.push(geom.centerPx);
    rects.push(...geom.rect);
    rectRows.push(geom.sourceRow);
    keptRows.push(row);
    whiskers.push(...geom.whiskers);
    whiskerRows.push(geom.sourceRow, geom.sourceRow);
    medians.push(...geom.median);
    medianRows.push(geom.sourceRow);
  }
  removedWarning(removed, binding.index, warnings);
  if (keptRows.length === 0) return null;
  return {
    centerPx,
    rects,
    rectRows,
    keptRows,
    whiskers,
    whiskerRows,
    medians,
    medianRows,
    linewidth,
    alpha,
    params,
  };
}

function makeBoxplotRectsBatch(
  frame: LayerFrame,
  layout: BoxplotBodyLayout,
  fill: ResolvedColorScale | null,
): RectsBatch {
  const { binding } = frame;
  const { linewidth, alpha } = layout;
  const rectsBatchOut: RectsBatch = {
    kind: "rects",
    layerIndex: binding.index,
    panelIndex: 0,
    rects: Float32Array.from(layout.rects),
    rowIndex: Uint32Array.from(layout.rectRows),
    fill: binding.fill.constant,
    fillRole: "paper",
    stroke: null,
    strokeWidth: linewidth,
    alpha,
  };
  if (fill !== null && (frame.fillValues !== null || binding.fill.scaledConstant !== null)) {
    rectsBatchOut.fills = mappedPaintVector(frame, "fill", fill, layout.keptRows);
  }
  return rectsBatchOut;
}

function batchesFromLayout(
  frame: LayerFrame,
  layout: BoxplotBodyLayout,
  fill: ResolvedColorScale | null,
): BoxplotBodyResult {
  const { binding } = frame;
  const { linewidth, alpha, params } = layout;
  const whiskers: GeometryBatch = {
    kind: "segments",
    layerIndex: binding.index,
    panelIndex: 0,
    segments: Float32Array.from(layout.whiskers),
    rowIndex: Uint32Array.from(layout.whiskerRows),
    stroke: null,
    linewidth,
    alpha,
  };
  const medians: GeometryBatch = {
    kind: "segments",
    layerIndex: binding.index,
    panelIndex: 0,
    segments: Float32Array.from(layout.medians),
    rowIndex: Uint32Array.from(layout.medianRows),
    stroke: null,
    linewidth: linewidth * BOX_MEDIAN_FATTEN,
    alpha,
  };
  const rects = makeBoxplotRectsBatch(frame, layout, fill);
  return {
    batches: [whiskers, rects, medians],
    centerPx: layout.centerPx,
    linewidth,
    alpha,
    keptRows: layout.keptRows,
    params,
  };
}

export function buildBoxplotBody(
  frame: LayerFrame,
  fx: Frame,
  fill: ResolvedColorScale | null,
  warnings: PipelineWarning[],
): BoxplotBodyResult | null {
  const layout = layoutBoxplotBody(frame, fx, warnings);
  if (layout === null) return null;
  return batchesFromLayout(frame, layout, fill);
}

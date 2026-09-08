/**
 * Interval family beyond errorbar: linerange (stem only), pointrange (stem +
 * mid point), crossbar (vertical box + mid line). Clean-room #793.
 *
 * Width for crossbar reuses makeErrorbarXSpan (resolution-based continuous x).
 */
import type { CrossbarParams, ErrorbarParams, PointrangeParams } from "@ggts-sh/spec";

import type { GeometryBatch, PointsBatch, RectsBatch, SegmentsBatch } from "../scene.js";
import { linetypeIndex, pointShapeIndex, type Linetype, type PointShape } from "../scales/style.js";
import type { ContinuousScale } from "../scales/train.js";

import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import {
  DEFAULT_POINT_SIZE,
  DEFAULT_RULE_LINEWIDTH,
  positionOf,
  removedWarning,
} from "./geometry-shared.js";
import {
  constantStyle,
  indexedStyleVector,
  mappedPaintVector,
  numericStyleVector,
  type ResolvedStyleScales,
} from "./geometry-style.js";
import { makeErrorbarXSpan } from "./geometry-errorbar-width.js";

const DEFAULT_WIDTH = 0.9;
const DEFAULT_CROSSBAR_FATTEN = 2.5;

function packStrokeBatch(
  frame: LayerFrame,
  styles: ResolvedStyleScales,
  segments: Float32Array,
  rowIndex: Uint32Array,
  styleRows: Uint32Array,
  strokes: string[] | null,
  params: { linewidth?: number; alpha?: number; linetype?: string },
  linewidthScale = 1,
): SegmentsBatch {
  const { binding } = frame;
  const baseLw = constantStyle(binding, params, "linewidth", DEFAULT_RULE_LINEWIDTH);
  const batch: SegmentsBatch = {
    kind: "segments",
    layerIndex: binding.index,
    panelIndex: 0,
    segments,
    rowIndex,
    stroke: binding.color.constant,
    linewidth: baseLw * linewidthScale,
    alpha: constantStyle(binding, params, "alpha", 1),
    ...(typeof binding.linetype?.constant === "string" && {
      linetype: binding.linetype.constant as Linetype,
    }),
  };
  const linewidths = numericStyleVector(frame, "linewidth", styleRows, styles);
  const alphas = numericStyleVector(frame, "alpha", styleRows, styles);
  const linetypeIndexes = indexedStyleVector(frame, "linetype", styleRows, styles, (value) =>
    linetypeIndex(value as Linetype),
  );
  if (linewidths !== undefined) {
    const scaled = new Float32Array(linewidths.length);
    for (let i = 0; i < linewidths.length; i++) scaled[i] = linewidths[i]! * linewidthScale;
    batch.linewidths = scaled;
  }
  if (alphas !== undefined) {
    batch.alpha = 1;
    batch.alphas = alphas;
  }
  if (linetypeIndexes !== undefined) batch.linetypeIndexes = linetypeIndexes;
  if (strokes !== null) batch.strokes = strokes;
  return batch;
}

function collectMidPoints(
  frame: LayerFrame,
  fx: Frame,
): { positions: Float32Array; rowIndex: Uint32Array; styleRows: Uint32Array; kept: number } {
  const { n } = frame;
  const positions = new Float32Array(n * 2);
  const rowIndex = new Uint32Array(n);
  const styleRows = new Uint32Array(n);
  let kept = 0;
  for (let row = 0; row < n; row++) {
    const tx = positionOf(fx.xScale, frame.xNumeric, frame.xValues, row);
    const ty =
      frame.yNumeric !== null || frame.yValues !== null
        ? positionOf(fx.yScale, frame.yNumeric, frame.yValues, row)
        : NaN;
    const t0 = fx.yScale.type === "band" ? NaN : fx.yScale.normalizeTransformed(frame.ymin![row]!);
    const t1 = fx.yScale.type === "band" ? NaN : fx.yScale.normalizeTransformed(frame.ymax![row]!);
    if (
      Number.isNaN(tx) ||
      Number.isNaN(ty) ||
      t0 === undefined ||
      t1 === undefined ||
      Number.isNaN(t0) ||
      Number.isNaN(t1)
    ) {
      continue;
    }
    const offset = kept * 2;
    positions[offset] = tx * fx.innerWidth;
    positions[offset + 1] = fx.innerHeight - ty * fx.innerHeight;
    rowIndex[kept] = frame.rowIndex[row]!;
    styleRows[kept] = row;
    kept++;
  }
  return { positions, rowIndex, styleRows, kept };
}

type SegmentBuffers = {
  segments: Float32Array;
  rowIndex: Uint32Array;
  styleRows: Uint32Array;
  kept: number;
  removed: number;
};

function collectLineRange(frame: LayerFrame, fx: Frame, yScale: ContinuousScale): SegmentBuffers {
  const { n } = frame;
  const segments = new Float32Array(n * 4);
  const rowIndex = new Uint32Array(n);
  const styleRows = new Uint32Array(n);
  let kept = 0;
  let removed = 0;
  for (let row = 0; row < n; row++) {
    const tx = positionOf(fx.xScale, frame.xNumeric, frame.xValues, row);
    const t0 = yScale.normalizeTransformed(frame.ymin![row]!);
    const t1 = yScale.normalizeTransformed(frame.ymax![row]!);
    if (
      Number.isNaN(tx) ||
      t0 === undefined ||
      t1 === undefined ||
      Number.isNaN(t0) ||
      Number.isNaN(t1)
    ) {
      removed++;
      continue;
    }
    const offset = kept * 4;
    const cx = tx * fx.innerWidth;
    segments[offset] = cx;
    segments[offset + 1] = fx.innerHeight - t0 * fx.innerHeight;
    segments[offset + 2] = cx;
    segments[offset + 3] = fx.innerHeight - t1 * fx.innerHeight;
    rowIndex[kept] = frame.rowIndex[row]!;
    styleRows[kept] = row;
    kept++;
  }
  return { segments, rowIndex, styleRows, kept, removed };
}

type CrossbarBuffers = {
  rects: Float32Array;
  rectRows: Uint32Array;
  rectStyle: Uint32Array;
  segs: Float32Array;
  segRows: Uint32Array;
  segStyle: Uint32Array;
  kept: number;
  removed: number;
};

function collectCrossbar(
  frame: LayerFrame,
  fx: Frame,
  yScale: ContinuousScale,
  xSpanOf: (row: number, tx: number) => readonly [number, number],
): CrossbarBuffers {
  const { n } = frame;
  const rects = new Float32Array(n * 4);
  const rectRows = new Uint32Array(n);
  const rectStyle = new Uint32Array(n);
  const segs = new Float32Array(n * 4);
  const segRows = new Uint32Array(n);
  const segStyle = new Uint32Array(n);
  let kept = 0;
  let removed = 0;
  for (let row = 0; row < n; row++) {
    const tx = positionOf(fx.xScale, frame.xNumeric, frame.xValues, row);
    const t0 = yScale.normalizeTransformed(frame.ymin![row]!);
    const t1 = yScale.normalizeTransformed(frame.ymax![row]!);
    const ty = positionOf(fx.yScale, frame.yNumeric, frame.yValues, row);
    if (
      Number.isNaN(tx) ||
      t0 === undefined ||
      t1 === undefined ||
      Number.isNaN(t0) ||
      Number.isNaN(t1) ||
      Number.isNaN(ty)
    ) {
      removed++;
      continue;
    }
    const [x0n, x1n] = xSpanOf(row, tx);
    if (!Number.isFinite(x0n) || !Number.isFinite(x1n)) {
      removed++;
      continue;
    }
    const px0 = Math.min(x0n, x1n) * fx.innerWidth;
    const px1 = Math.max(x0n, x1n) * fx.innerWidth;
    const yTop = fx.innerHeight - Math.max(t0, t1) * fx.innerHeight;
    const yBot = fx.innerHeight - Math.min(t0, t1) * fx.innerHeight;
    const midY = fx.innerHeight - ty * fx.innerHeight;
    const offset = kept * 4;
    rects[offset] = px0;
    rects[offset + 1] = yTop;
    rects[offset + 2] = Math.max(px1 - px0, 0);
    rects[offset + 3] = Math.max(yBot - yTop, 0);
    rectRows[kept] = frame.rowIndex[row]!;
    rectStyle[kept] = row;
    segs[offset] = px0;
    segs[offset + 1] = midY;
    segs[offset + 2] = px1;
    segs[offset + 3] = midY;
    segRows[kept] = frame.rowIndex[row]!;
    segStyle[kept] = row;
    kept++;
  }
  return { rects, rectRows, rectStyle, segs, segRows, segStyle, kept, removed };
}

function buildCrossbarRectBatch(input: {
  frame: LayerFrame;
  styles: ResolvedStyleScales;
  rects: Float32Array;
  rowIndex: Uint32Array;
  styleRows: Uint32Array;
  params: CrossbarParams;
  fills: string[] | null;
  strokes: string[] | null;
}): RectsBatch {
  const { frame, styles, rects, rowIndex, styleRows, params, fills, strokes } = input;
  const { binding } = frame;
  const strokeWidth = constantStyle(binding, params, "linewidth", DEFAULT_RULE_LINEWIDTH);
  const hasFill =
    binding.fill.constant !== null ||
    binding.fill.field !== null ||
    binding.fill.scaledConstant !== null ||
    fills !== null;
  const batch: RectsBatch = {
    kind: "rects",
    layerIndex: binding.index,
    panelIndex: 0,
    rects,
    rowIndex,
    fill: binding.fill.constant,
    ...(hasFill ? {} : { fillRole: "paper" as const }),
    alpha: constantStyle(binding, params, "alpha", 1),
    stroke: binding.color.constant,
    strokeWidth,
    anchor: "center",
  };
  const alphas = numericStyleVector(frame, "alpha", styleRows, styles);
  if (alphas !== undefined) {
    batch.alpha = 1;
    batch.alphas = alphas;
  }
  if (fills !== null) batch.fills = fills;
  if (strokes !== null) batch.strokes = strokes;
  const linewidths = numericStyleVector(frame, "linewidth", styleRows, styles);
  if (linewidths !== undefined) batch.strokeWidths = linewidths;
  if (typeof binding.linetype?.constant === "string") {
    batch.linetype = binding.linetype.constant as Linetype;
  }
  const linetypeIndexes = indexedStyleVector(frame, "linetype", styleRows, styles, (value) =>
    linetypeIndex(value as Linetype),
  );
  if (linetypeIndexes !== undefined) batch.linetypeIndexes = linetypeIndexes;
  return batch;
}

function buildMidPointBatch(input: {
  frame: LayerFrame;
  styles: ResolvedStyleScales;
  positions: Float32Array;
  rowIndex: Uint32Array;
  styleRows: Uint32Array;
  params: PointrangeParams;
  colors: string[] | null;
}): PointsBatch {
  const { frame, styles, positions, rowIndex, styleRows, params, colors } = input;
  const { binding } = frame;
  const batch: PointsBatch = {
    kind: "points",
    layerIndex: binding.index,
    panelIndex: 0,
    positions,
    rowIndex,
    size:
      typeof binding.size?.constant === "number"
        ? binding.size.constant
        : (params.size ?? DEFAULT_POINT_SIZE),
    alpha: constantStyle(binding, params, "alpha", 1),
    shape:
      typeof binding.shape?.constant === "string"
        ? (binding.shape.constant as PointShape)
        : (params.shape ?? "circle"),
    fill: binding.color.constant,
  };
  const sizes = numericStyleVector(frame, "size", styleRows, styles);
  const alphas = numericStyleVector(frame, "alpha", styleRows, styles);
  const shapeIndexes = indexedStyleVector(frame, "shape", styleRows, styles, (value) =>
    pointShapeIndex(value as PointShape),
  );
  if (sizes !== undefined) batch.sizes = sizes;
  if (alphas !== undefined) {
    batch.alpha = 1;
    batch.alphas = alphas;
  }
  if (shapeIndexes !== undefined) batch.shapeIndexes = shapeIndexes;
  if (colors !== null) batch.colors = colors;
  return batch;
}

function buildCrossbarBatches(input: {
  frame: LayerFrame;
  styles: ResolvedStyleScales;
  params: CrossbarParams;
  color: ResolvedColorScale | null;
  fill: ResolvedColorScale | null;
  fatten: number;
  wantsStroke: boolean;
  wantsFill: boolean;
  buffers: CrossbarBuffers;
}): GeometryBatch[] {
  const { frame, styles, params, color, fill, fatten, wantsStroke, wantsFill, buffers } = input;
  const { n } = frame;
  const { rects, rectRows, rectStyle, segs, segRows, segStyle, kept } = buffers;
  const outRects = kept === n ? rects : rects.subarray(0, kept * 4).slice();
  const outRectRows = kept === n ? rectRows : rectRows.subarray(0, kept).slice();
  const outRectStyle = kept === n ? rectStyle : rectStyle.subarray(0, kept).slice();
  const outSegs = kept === n ? segs : segs.subarray(0, kept * 4).slice();
  const outSegRows = kept === n ? segRows : segRows.subarray(0, kept).slice();
  const outSegStyle = kept === n ? segStyle : segStyle.subarray(0, kept).slice();
  const outFills =
    wantsFill && fill !== null ? mappedPaintVector(frame, "fill", fill, outRectStyle) : null;
  const outStrokes =
    wantsStroke && color !== null ? mappedPaintVector(frame, "color", color, outRectStyle) : null;
  const rectBatch = buildCrossbarRectBatch({
    frame,
    styles,
    rects: outRects,
    rowIndex: outRectRows,
    styleRows: outRectStyle,
    params,
    fills: outFills,
    strokes: outStrokes,
  });
  const mid = packStrokeBatch(
    frame,
    styles,
    outSegs,
    outSegRows,
    outSegStyle,
    outStrokes,
    params,
    fatten,
  );
  return [rectBatch, mid];
}

/** Vertical stem only — one segment per kept row. */
export function linerangeBatch(
  frame: LayerFrame,
  fx: Frame,
  color: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): SegmentsBatch | null {
  if (frame.ymin === null || frame.ymax === null || fx.yScale.type === "band") return null;
  const { binding, n } = frame;
  const params = (binding.layer.params ?? {}) as ErrorbarParams;
  const wantsColors =
    color !== null && (frame.colorValues !== null || binding.color.scaledConstant !== null);

  const collected = collectLineRange(frame, fx, fx.yScale);
  const { segments, rowIndex, styleRows, kept, removed } = collected;

  removedWarning(removed, binding.index, warnings);
  if (kept === 0) return null;
  const outSeg = kept === n ? segments : segments.subarray(0, kept * 4).slice();
  const outRows = kept === n ? rowIndex : rowIndex.subarray(0, kept).slice();
  const outStyle = kept === n ? styleRows : styleRows.subarray(0, kept).slice();
  const outStrokes =
    wantsColors && color !== null ? mappedPaintVector(frame, "color", color, outStyle) : null;
  return packStrokeBatch(frame, styles, outSeg, outRows, outStyle, outStrokes, params);
}

/** Stem segments + mid points (y required for identity; summary provides y). */
export function pointrangeBatches(
  frame: LayerFrame,
  fx: Frame,
  color: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): GeometryBatch[] {
  const stem = linerangeBatch(frame, fx, color, styles, warnings);
  const points = midPointsBatch(frame, fx, color, styles);
  const out: GeometryBatch[] = [];
  if (stem !== null) out.push(stem);
  if (points !== null) out.push(points);
  return out;
}

function midPointsBatch(
  frame: LayerFrame,
  fx: Frame,
  color: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
): PointsBatch | null {
  if (frame.yNumeric === null && frame.yValues === null) return null;
  // Same band/ymin/ymax gate as linerangeBatch — continuous interval only.
  if (frame.ymin === null || frame.ymax === null || fx.yScale.type === "band") return null;
  const { binding, n } = frame;
  const params = (binding.layer.params ?? {}) as PointrangeParams;
  const wantsColors =
    color !== null && (frame.colorValues !== null || binding.color.scaledConstant !== null);

  // Match linerangeBatch: drop missing interval bounds so a pointrange never
  // draws a floating mid point without a stem.
  const collected = collectMidPoints(frame, fx);
  const { positions, rowIndex, styleRows, kept } = collected;
  if (kept === 0) return null;

  const outPos = kept === n ? positions : positions.subarray(0, kept * 2).slice();
  const outRows = kept === n ? rowIndex : rowIndex.subarray(0, kept).slice();
  const outStyle = kept === n ? styleRows : styleRows.subarray(0, kept).slice();
  const colors =
    wantsColors && color !== null ? mappedPaintVector(frame, "color", color, outStyle) : null;
  return buildMidPointBatch({
    frame,
    styles,
    positions: outPos,
    rowIndex: outRows,
    styleRows: outStyle,
    params,
    colors,
  });
}

/** Crossbar: vertical box (ymin–ymax × width) + mid horizontal line at y. */
export function crossbarBatches(
  frame: LayerFrame,
  fx: Frame,
  color: ResolvedColorScale | null,
  fill: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): GeometryBatch[] {
  if (frame.ymin === null || frame.ymax === null || fx.yScale.type === "band") return [];
  const { binding } = frame;
  const params = (binding.layer.params ?? {}) as CrossbarParams;
  const widthParam = params.width ?? DEFAULT_WIDTH;
  const fatten =
    typeof params.fatten === "number" && params.fatten > 0
      ? params.fatten
      : DEFAULT_CROSSBAR_FATTEN;
  const xSpanOf = makeErrorbarXSpan(frame, fx, widthParam);
  const wantsStroke =
    color !== null && (frame.colorValues !== null || binding.color.scaledConstant !== null);
  const wantsFill =
    fill !== null && (frame.fillValues !== null || binding.fill.scaledConstant !== null);

  const collected = collectCrossbar(frame, fx, fx.yScale, xSpanOf);
  const { kept, removed } = collected;

  removedWarning(removed, binding.index, warnings);
  if (kept === 0) return [];

  return buildCrossbarBatches({
    frame,
    styles,
    params,
    color,
    fill,
    fatten,
    wantsStroke,
    wantsFill,
    buffers: collected,
  });
}

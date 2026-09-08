/**
 * Edge-based rectangle geometry for geom rect / tile / raster.
 *
 * Separate from bar/col rectsBatch (geometry-rects.ts): these geoms consume
 * transformed xmin/xmax/ymin/ymax edges (or band-centered tile slots) and
 * support optional per-rect stroke outlines.
 */
import type { RasterParams, TileParams } from "@ggts-sh/spec";

import type { RectsBatch } from "../scene.js";
import { linetypeIndex, type Linetype } from "../scales/style.js";
import { resolution as resolutionOf } from "../stats/numeric.js";

import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";
import { PipelineError } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import {
  indexedStyleVector,
  constantStyle,
  mappedPaintVector,
  numericStyleVector,
  type ResolvedStyleScales,
} from "./geometry-style.js";
import { DEFAULT_RULE_LINEWIDTH, removedWarning } from "./geometry-shared.js";

function sizeAt(
  frame: LayerFrame,
  field: string | null,
  param: number | undefined,
  defaultSize: number,
  row: number,
): number {
  if (field !== null) {
    // Frame tables are panel-local after faceting; use the panel row index.
    const raw = frame.table.column(field)[row]!;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }
  if (param !== undefined) return param;
  return defaultSize;
}

function defaultResolution(values: Float64Array | null): number {
  if (values === null || values.length === 0) return 1;
  const gap = resolutionOf(values);
  return gap > 0 ? gap : 1;
}

function emitEdges(input: {
  frame: LayerFrame;
  fx: Frame;
  left: Float64Array;
  right: Float64Array;
  bottom: Float64Array;
  top: Float64Array;
}): {
  rects: Float32Array;
  rowIndex: Uint32Array;
  keptRows: Uint32Array;
  kept: number;
  removed: number;
} {
  const { frame, fx, left, right, bottom, top } = input;
  const n = frame.n;
  const rects = new Float32Array(n * 4);
  const rowIndex = new Uint32Array(n);
  const keptRows = new Uint32Array(n);
  let kept = 0;
  let removed = 0;
  for (let row = 0; row < n; row++) {
    const x0t = fx.xScale.type === "band" ? NaN : fx.xScale.normalizeTransformed(left[row]!);
    const x1t = fx.xScale.type === "band" ? NaN : fx.xScale.normalizeTransformed(right[row]!);
    const y0t = fx.yScale.type === "band" ? NaN : fx.yScale.normalizeTransformed(bottom[row]!);
    const y1t = fx.yScale.type === "band" ? NaN : fx.yScale.normalizeTransformed(top[row]!);
    if (
      !Number.isFinite(x0t) ||
      !Number.isFinite(x1t) ||
      !Number.isFinite(y0t) ||
      !Number.isFinite(y1t)
    ) {
      removed++;
      continue;
    }
    const xPx0 = Math.min(x0t, x1t) * fx.innerWidth;
    const xPx1 = Math.max(x0t, x1t) * fx.innerWidth;
    const y0 = fx.innerHeight - Math.min(y0t, y1t) * fx.innerHeight;
    const y1 = fx.innerHeight - Math.max(y0t, y1t) * fx.innerHeight;
    const o = kept * 4;
    rects[o] = xPx0;
    rects[o + 1] = Math.min(y0, y1);
    rects[o + 2] = Math.abs(xPx1 - xPx0);
    rects[o + 3] = Math.abs(y1 - y0);
    rowIndex[kept] = frame.rowIndex[row]!;
    keptRows[kept] = row;
    kept++;
  }
  if (kept === n) return { rects, rowIndex, keptRows, kept, removed };
  if (kept === 0) {
    return {
      rects: new Float32Array(0),
      rowIndex: new Uint32Array(0),
      keptRows: new Uint32Array(0),
      kept: 0,
      removed,
    };
  }
  return {
    rects: rects.subarray(0, kept * 4).slice(),
    rowIndex: rowIndex.subarray(0, kept).slice(),
    keptRows: keptRows.subarray(0, kept),
    kept,
    removed,
  };
}

function tileAxis(
  frame: LayerFrame,
  fx: Frame,
  row: number,
  axis: "x" | "y",
  param: number | undefined,
  defaultSize: number,
): { center: number; size: number } | null {
  const scale = axis === "x" ? fx.xScale : fx.yScale;
  const values = axis === "x" ? frame.xValues : frame.yValues;
  const numeric = axis === "x" ? frame.xNumeric : frame.yNumeric;
  const field = axis === "x" ? frame.binding.widthField : frame.binding.heightField;
  if (scale.type === "band") {
    const center = scale.normalize(values?.[row] ?? null);
    if (center === undefined || Number.isNaN(center)) return null;
    const size = sizeAt(frame, field, param, 1, row) * scale.step;
    return { center, size };
  }
  const value = numeric?.[row];
  if (value === undefined || !Number.isFinite(value)) return null;
  const size = sizeAt(frame, field, param, defaultSize, row);
  if (!(size > 0) || !Number.isFinite(size)) return null;
  const half = size / 2;
  const lower = scale.normalizeTransformed(value - half);
  const upper = scale.normalizeTransformed(value + half);
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null;
  return { center: (lower + upper) / 2, size: Math.abs(upper - lower) };
}

function emitBandTiles(input: {
  frame: LayerFrame;
  fx: Frame;
  widthParam: number | undefined;
  heightParam: number | undefined;
}): {
  rects: Float32Array;
  rowIndex: Uint32Array;
  keptRows: Uint32Array;
  kept: number;
  removed: number;
} {
  const { frame, fx, widthParam, heightParam } = input;
  const n = frame.n;
  const rects = new Float32Array(n * 4);
  const rowIndex = new Uint32Array(n);
  const keptRows = new Uint32Array(n);
  let kept = 0;
  let removed = 0;
  // Safe to hoist because the loop never writes xNumeric/yNumeric. Only the
  // continuous branches read these; the band arms size from scale.step, so the
  // guard exists to keep them from paying for a scan they never consult.
  const defaultW = fx.xScale.type === "band" ? 1 : defaultResolution(frame.xNumeric);
  const defaultH = fx.yScale.type === "band" ? 1 : defaultResolution(frame.yNumeric);
  for (let row = 0; row < n; row++) {
    const x = tileAxis(frame, fx, row, "x", widthParam, defaultW);
    const y = tileAxis(frame, fx, row, "y", heightParam, defaultH);
    if (x === null || y === null || x.size === 0 || y.size === 0) {
      removed++;
      continue;
    }
    const xPx = (x.center - x.size / 2) * fx.innerWidth;
    const wPx = x.size * fx.innerWidth;
    const yTop = (1 - (y.center + y.size / 2)) * fx.innerHeight;
    const hPx = y.size * fx.innerHeight;
    const o = kept * 4;
    rects[o] = xPx;
    rects[o + 1] = yTop;
    rects[o + 2] = wPx;
    rects[o + 3] = hPx;
    rowIndex[kept] = frame.rowIndex[row]!;
    keptRows[kept] = row;
    kept++;
  }
  if (kept === n) return { rects, rowIndex, keptRows, kept, removed };
  if (kept === 0) {
    return {
      rects: new Float32Array(0),
      rowIndex: new Uint32Array(0),
      keptRows: new Uint32Array(0),
      kept: 0,
      removed,
    };
  }
  return {
    rects: rects.subarray(0, kept * 4).slice(),
    rowIndex: rowIndex.subarray(0, kept).slice(),
    keptRows: keptRows.subarray(0, kept),
    kept,
    removed,
  };
}

function edgeStrokePaint(
  frame: LayerFrame,
  color: ResolvedColorScale | null,
  emitted: { keptRows: Uint32Array },
  params: { linewidth?: number },
): { stroke?: string | null; strokes?: string[] } | null {
  const { binding } = frame;
  const wantsMappedStroke =
    color !== null && (frame.colorValues !== null || binding.color.scaledConstant !== null);
  if (wantsMappedStroke && color !== null) {
    return { stroke: null, strokes: mappedPaintVector(frame, "color", color, emitted.keptRows) };
  }
  if (binding.color.constant !== null) return { stroke: binding.color.constant };
  const hasStrokeStyle =
    typeof binding.linewidth?.constant === "number" ||
    binding.linewidth?.field !== null ||
    binding.linewidth?.scaledConstant !== null ||
    typeof binding.linetype?.constant === "string" ||
    binding.linetype?.field !== null ||
    binding.linetype?.scaledConstant !== null ||
    typeof params.linewidth === "number";
  return hasStrokeStyle ? { stroke: null } : null;
}

function applyEdgeStroke(
  batch: RectsBatch,
  frame: LayerFrame,
  styles: ResolvedStyleScales,
  color: ResolvedColorScale | null,
  emitted: { keptRows: Uint32Array },
  params: { alpha?: number; linewidth?: number },
): void {
  const paint = edgeStrokePaint(frame, color, emitted, params);
  if (paint === null) return;
  Object.assign(batch, paint);
  const { binding } = frame;
  batch.strokeWidth = constantStyle(binding, params, "linewidth", DEFAULT_RULE_LINEWIDTH);
  const linewidths = numericStyleVector(frame, "linewidth", emitted.keptRows, styles);
  if (linewidths !== undefined) batch.strokeWidths = linewidths;
  if (typeof binding.linetype?.constant === "string") {
    batch.linetype = binding.linetype.constant as Linetype;
  }
  const linetypeIndexes = indexedStyleVector(frame, "linetype", emitted.keptRows, styles, (value) =>
    linetypeIndex(value as Linetype),
  );
  if (linetypeIndexes !== undefined) batch.linetypeIndexes = linetypeIndexes;
}

function styleEdgeBatch(
  frame: LayerFrame,
  styles: ResolvedStyleScales,
  fill: ResolvedColorScale | null,
  color: ResolvedColorScale | null,
  emitted: {
    rects: Float32Array;
    rowIndex: Uint32Array;
    keptRows: Uint32Array;
    kept: number;
  },
  params: { alpha?: number; linewidth?: number },
  withStroke: boolean,
): RectsBatch {
  const { binding } = frame;
  const batch: RectsBatch = {
    kind: "rects",
    layerIndex: binding.index,
    panelIndex: 0,
    rects: emitted.rects,
    rowIndex: emitted.rowIndex,
    fill: binding.fill.constant,
    alpha: constantStyle(binding, params, "alpha", 1),
    anchor: "center",
  };
  const alphas = numericStyleVector(frame, "alpha", emitted.keptRows, styles);
  if (alphas !== undefined) {
    batch.alpha = 1;
    batch.alphas = alphas;
  }
  if (fill !== null && (frame.fillValues !== null || binding.fill.scaledConstant !== null)) {
    batch.fills = mappedPaintVector(frame, "fill", fill, emitted.keptRows);
  }
  if (withStroke) applyEdgeStroke(batch, frame, styles, color, emitted, params);
  return batch;
}

/** geom rect: xmin/xmax/ymin/ymax edges already on the frame. */
export function edgeRectsBatch(
  frame: LayerFrame,
  fx: Frame,
  fill: ResolvedColorScale | null,
  color: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): RectsBatch | null {
  if (frame.xmin === null || frame.xmax === null || frame.ymin === null || frame.ymax === null) {
    return null;
  }
  const params = (frame.binding.layer.params ?? {}) as { alpha?: number; linewidth?: number };
  const emitted = emitEdges({
    frame,
    fx,
    left: frame.xmin,
    right: frame.xmax,
    bottom: frame.ymin,
    top: frame.ymax,
  });
  removedWarning(emitted.removed, frame.binding.index, warnings);
  if (emitted.kept === 0) return null;
  return styleEdgeBatch(frame, styles, fill, color, emitted, params, true);
}

/** geom tile: center + size (band or continuous). */
export function tileRectsBatch(
  frame: LayerFrame,
  fx: Frame,
  fill: ResolvedColorScale | null,
  color: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): RectsBatch | null {
  const params = (frame.binding.layer.params ?? {}) as TileParams;
  // Validate non-positive mapped/constant sizes once with a sample.
  for (let row = 0; row < frame.n; row++) {
    for (const [field, param, axis] of [
      [frame.binding.widthField, params.width, "width"],
      [frame.binding.heightField, params.height, "height"],
    ] as const) {
      if (field === null && param === undefined) continue;
      const v = sizeAt(frame, field, param, 1, row);
      if (!(v > 0) || !Number.isFinite(v)) {
        throw new PipelineError(
          "tile-nonpositive-size",
          `/layers/${frame.binding.index}/aes/${axis}`,
          `The tile geom requires positive finite ${axis}; got ${String(v)}. Map a positive ${axis} or set params.${axis}.`,
        );
      }
    }
  }
  const emitted = emitBandTiles({
    frame,
    fx,
    widthParam: params.width,
    heightParam: params.height,
  });
  removedWarning(emitted.removed, frame.binding.index, warnings);
  if (emitted.kept === 0) return null;
  return styleEdgeBatch(frame, styles, fill, color, emitted, params, true);
}

/** geom raster: equal cells from edges prepared in expandEdgeFrame; no stroke. */
export function rasterRectsBatch(
  frame: LayerFrame,
  fx: Frame,
  fill: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): RectsBatch | null {
  if (fx.xScale.type === "band" || fx.yScale.type === "band") {
    throw new PipelineError(
      "channel-type-mismatch",
      `/layers/${frame.binding.index}`,
      'The raster geom needs continuous x and y. Use geom "tile" for discrete axes.',
    );
  }
  if (frame.xmin === null || frame.xmax === null || frame.ymin === null || frame.ymax === null) {
    return null;
  }
  const params = (frame.binding.layer.params ?? {}) as RasterParams;
  const emitted = emitEdges({
    frame,
    fx,
    left: frame.xmin,
    right: frame.xmax,
    bottom: frame.ymin,
    top: frame.ymax,
  });
  removedWarning(emitted.removed, frame.binding.index, warnings);
  if (emitted.kept === 0) return null;
  return styleEdgeBatch(frame, styles, fill, null, emitted, params, false);
}

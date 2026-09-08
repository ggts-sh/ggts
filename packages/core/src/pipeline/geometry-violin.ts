/**
 * Violin path geometry: mirrored density polygons per (x, group).
 */
import type { ViolinParams } from "@ggts-sh/spec";

import { layerPaintFromParams, resolveGlow, resolveGradientPaint } from "../mark-paint.js";
import type { PathsBatch } from "../scene.js";

import { encodeKey } from "../scales/state.js";

import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import {
  DEFAULT_BOXPLOT_WIDTH,
  MAX_BOXPLOT_PANEL_FRAC,
  positionOf,
  removedWarning,
} from "./geometry-shared.js";
import {
  constantStyle,
  numericStyleVector,
  paintVector,
  type ResolvedStyleScales,
} from "./geometry-style.js";
import { areaGroupFillsOf } from "./geometry-paths-area-fill.js";

function sortRowsByY(rows: number[], y: Float64Array): number[] {
  return rows.toSorted((a, b) => y[a]! - y[b]!);
}

function sortedViolinGroups(
  groupRows: readonly number[][],
  y: Float64Array,
): {
  groups: number[][];
  totalVertices: number;
} {
  const groups: number[][] = [];
  let totalVertices = 0;
  for (const rows of groupRows) {
    const sorted = sortRowsByY(rows, y);
    if (sorted.length < 2) continue;
    groups.push(sorted);
    totalVertices += sorted.length * 2;
  }
  return { groups, totalVertices };
}

function violinWidthFraction(fx: Frame, params: ViolinParams): number {
  const width = params.width ?? DEFAULT_BOXPLOT_WIDTH;
  const widthFraction = width * (fx.xScale.type === "band" ? fx.xScale.step : 1);
  return params.width === undefined && fx.xScale.type === "band"
    ? Math.min(widthFraction, MAX_BOXPLOT_PANEL_FRAC)
    : widthFraction;
}

/** Bucket by (x category, group) so each violin is a separate closed path. */
function bucketViolinRows(
  frame: LayerFrame,
  fx: Frame,
  y: Float64Array,
  warnings: PipelineWarning[],
): number[][] {
  const map = new Map<string, number[]>();
  const order: string[] = [];
  let removed = 0;
  for (let row = 0; row < frame.n; row++) {
    const tx = positionOf(fx.xScale, frame.xNumeric, frame.xValues, row);
    const ty = positionOf(fx.yScale, y, frame.yValues, row);
    if (Number.isNaN(tx) || Number.isNaN(ty)) {
      removed++;
      continue;
    }
    const key = `${encodeKey(frame.xValues?.[row] ?? null)}\0${frame.groups[row]!}`;
    let rows = map.get(key);
    if (rows === undefined) {
      rows = [];
      map.set(key, rows);
      order.push(key);
    }
    rows.push(row);
  }
  removedWarning(removed, frame.binding.index, warnings);
  return order.map((k) => map.get(k)!);
}

function writeViolinBuffers(input: {
  frame: LayerFrame;
  fx: Frame;
  violinwidth: Float64Array;
  groups: readonly number[][];
  totalVertices: number;
  widthFraction: number;
  fillPaints: readonly (string | null)[];
  strokePaints: readonly (string | null)[];
  fillFallback: string | undefined;
  strokeFallback: string | undefined;
}): {
  positions: Float32Array;
  rowIndex: Uint32Array;
  closedFrameRows: Uint32Array;
  pathOffsets: Uint32Array;
  fills: (string | null)[];
  strokes: (string | null)[];
} {
  const {
    frame,
    fx,
    violinwidth,
    groups,
    totalVertices,
    widthFraction,
    fillPaints,
    strokePaints,
    fillFallback,
    strokeFallback,
  } = input;
  const positions = new Float32Array(totalVertices * 2);
  const rowIndex = new Uint32Array(totalVertices);
  const closedFrameRows = new Uint32Array(totalVertices);
  const pathOffsets = new Uint32Array(groups.length + 1);
  const fills: (string | null)[] = [];
  const strokes: (string | null)[] = [];
  let cursor = 0;
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    pathOffsets[groupIndex] = cursor;
    const rows = groups[groupIndex]!;
    const first = rows[0]!;
    let center = positionOf(fx.xScale, frame.xNumeric, frame.xValues, first);
    let width = widthFraction;
    if (frame.dodge !== null) {
      const slotCount = Math.max(1, frame.dodge.slotCounts[first]!);
      const slot = frame.dodge.slot[first]!;
      width = widthFraction / slotCount;
      center += widthFraction * ((slot + 0.5) / slotCount - 0.5);
    }
    const centerPx = center * fx.innerWidth;
    const halfMaxPx = (width / 2) * fx.innerWidth;
    for (const row of rows) {
      const y = positionOf(fx.yScale, frame.yNumeric, frame.yValues, row);
      const half = halfMaxPx * Math.max(0, violinwidth[row]!);
      positions[cursor * 2] = centerPx + half;
      positions[cursor * 2 + 1] = fx.innerHeight - y * fx.innerHeight;
      rowIndex[cursor] = frame.rowIndex[row]!;
      closedFrameRows[cursor] = row;
      cursor++;
    }
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]!;
      const y = positionOf(fx.yScale, frame.yNumeric, frame.yValues, row);
      const half = halfMaxPx * Math.max(0, violinwidth[row]!);
      positions[cursor * 2] = centerPx - half;
      positions[cursor * 2 + 1] = fx.innerHeight - y * fx.innerHeight;
      rowIndex[cursor] = frame.rowIndex[row]!;
      closedFrameRows[cursor] = row;
      cursor++;
    }
    fills.push(fillPaints[groupIndex] ?? fillFallback ?? null);
    let stroke = strokePaints[groupIndex]!;
    if (stroke === null && strokeFallback !== undefined) stroke = strokeFallback;
    strokes.push(stroke);
  }
  pathOffsets[groups.length] = cursor;
  return { positions, rowIndex, closedFrameRows, pathOffsets, fills, strokes };
}

export function violinBatch(
  frame: LayerFrame,
  fx: Frame,
  fill: ResolvedColorScale | null,
  color: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): PathsBatch | null {
  const { binding } = frame;
  if (frame.yNumeric === null || frame.ymin === null) return null;
  // ymin carries unitless violinwidth (0–1 × scale factor) from ydensity frame.
  const violinwidth = frame.ymin;
  const y = frame.yNumeric;

  const groupRows = bucketViolinRows(frame, fx, y, warnings);
  if (groupRows.length === 0) return null;

  const params = (binding.layer.params ?? {}) as ViolinParams;
  // Same band-fraction model as boxplot (normalized units, not px yet).
  const widthFraction = violinWidthFraction(fx, params);

  const paint = layerPaintFromParams(binding.layer.params);
  const fillPaintResolved =
    paint.fillPaint === null
      ? undefined
      : resolveGradientPaint(paint.fillPaint, binding.index, "fill");
  const strokePaintResolved =
    paint.strokePaint === null
      ? undefined
      : resolveGradientPaint(paint.strokePaint, binding.index, "stroke");
  const glowResolved = paint.glow === null ? undefined : resolveGlow(paint.glow, binding.index);

  const { groups: sortedGroups, totalVertices } = sortedViolinGroups(groupRows, y);
  if (sortedGroups.length === 0) return null;

  // One fill/stroke paint vector for all violins (#1309).
  const styleRows = sortedGroups.map((rows) => rows[0]!);
  const fillPaints = areaGroupFillsOf(frame, fill, styleRows);
  const strokePaints = paintVector(frame, "color", color, styleRows);
  const { positions, rowIndex, closedFrameRows, pathOffsets, fills, strokes } = writeViolinBuffers({
    frame,
    fx,
    violinwidth,
    groups: sortedGroups,
    totalVertices,
    widthFraction,
    fillPaints,
    strokePaints,
    fillFallback: fillPaintResolved?.fallback,
    strokeFallback: strokePaintResolved?.fallback,
  });

  const mappedAlphas = numericStyleVector(frame, "alpha", styleRows, styles);
  const subpathCount = pathOffsets.length - 1;
  const constantAlpha = constantStyle(binding, params, "alpha", 1);
  const alphas =
    mappedAlphas ??
    (subpathCount > 1 && constantAlpha !== 1
      ? Float32Array.from({ length: subpathCount }, () => constantAlpha)
      : undefined);
  const linewidth = constantStyle(binding, params, "linewidth", 0.5);

  return {
    kind: "paths",
    layerIndex: binding.index,
    panelIndex: 0,
    positions,
    rowIndex,
    closedFrameRows,
    pathOffsets,
    strokes,
    fills,
    closed: true,
    linewidth,
    alpha: alphas === undefined ? constantAlpha : 1,
    ...(alphas !== undefined && { alphas }),
    curve: "linear",
    ...(fillPaintResolved !== undefined && { fillPaint: fillPaintResolved }),
    ...(strokePaintResolved !== undefined && { strokePaint: strokePaintResolved }),
    ...(glowResolved !== undefined && { glow: glowResolved }),
  };
}

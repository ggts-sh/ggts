/**
 * Curve geometry batch: one tessellated path subpath per data row from
 * (x,y)→(xend,yend) with curvature/angle/ncp (#794).
 *
 * Tessellation is in **panel px** after independent axis scaling so curvature
 * is not aspect-skewed. Only the two true endpoints are semantic anchors.
 */
import type { CurveParams } from "@ggts-sh/spec";

import { layerPaintFromParams, resolveGlow, resolveGradientPaint } from "../mark-paint.js";
import type { PathsBatch } from "../scene.js";
import { linetypeIndex, type Linetype } from "../scales/style.js";
import { tessellateCurve } from "../stats/curve.js";

import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import { DEFAULT_RULE_LINEWIDTH, positionOf, removedWarning } from "./geometry-shared.js";
import {
  constantStyle,
  indexedStyleVector,
  numericStyleVector,
  paintVector,
  type ResolvedStyleScales,
} from "./geometry-style.js";

type SampledCurve = {
  row: number;
  positions: Float64Array;
  count: number;
};

function sampleCurves(
  frame: LayerFrame,
  fx: Frame,
  params: Pick<CurveParams, "curvature" | "angle" | "ncp">,
): { sampled: SampledCurve[]; removed: number; totalVerts: number } {
  const curvature = params.curvature ?? 0.5;
  const angle = params.angle ?? 90;
  const ncp = params.ncp ?? 5;
  const sampled: SampledCurve[] = [];
  let removed = 0;
  let totalVerts = 0;
  for (let row = 0; row < frame.n; row++) {
    const t0x = positionOf(fx.xScale, frame.xNumeric, frame.xValues, row);
    const t0y = positionOf(fx.yScale, frame.yNumeric, frame.yValues, row);
    const t1x = positionOf(fx.xScale, frame.xend, frame.xendValues, row);
    const t1y = positionOf(fx.yScale, frame.yend, frame.yendValues, row);
    if (Number.isNaN(t0x) || Number.isNaN(t0y) || Number.isNaN(t1x) || Number.isNaN(t1y)) {
      removed++;
      continue;
    }
    const curve = tessellateCurve({
      x0: t0x * fx.innerWidth,
      y0: fx.innerHeight - t0y * fx.innerHeight,
      x1: t1x * fx.innerWidth,
      y1: fx.innerHeight - t1y * fx.innerHeight,
      curvature,
      angle,
      ncp,
    });
    sampled.push({ row, positions: curve.positions, count: curve.count });
    totalVerts += curve.count;
  }
  return { sampled, removed, totalVerts };
}

function writeSampledCurves(
  frame: LayerFrame,
  sampled: readonly SampledCurve[],
  totalVerts: number,
): {
  positions: Float32Array;
  rowIndex: Uint32Array;
  semanticAnchors: Uint8Array;
  semanticIndex: Uint32Array;
  pathOffsets: Uint32Array;
  styleRows: number[];
} {
  const positions = new Float32Array(totalVerts * 2);
  const rowIndex = new Uint32Array(totalVerts);
  const semanticAnchors = new Uint8Array(totalVerts);
  const semanticIndex = new Uint32Array(totalVerts);
  const pathOffsets = new Uint32Array(sampled.length + 1);
  const styleRows: number[] = [];
  let cursor = 0;
  for (let s = 0; s < sampled.length; s++) {
    pathOffsets[s] = cursor;
    const { row, positions: points, count } = sampled[s]!;
    styleRows.push(row);
    const sourceRow = frame.rowIndex[row]!;
    for (let i = 0; i < count; i++) {
      positions[cursor * 2] = points[i * 2]!;
      positions[cursor * 2 + 1] = points[i * 2 + 1]!;
      rowIndex[cursor] = sourceRow;
      semanticIndex[cursor] = row;
      // One semantic candidate per curve; tessellated samples are synthetic.
      semanticAnchors[cursor] = i === 0 ? 1 : 0;
      cursor++;
    }
  }
  pathOffsets[sampled.length] = cursor;
  return { positions, rowIndex, semanticAnchors, semanticIndex, pathOffsets, styleRows };
}

function applyStrokeFallback(strokes: (string | null)[], fallback: string | undefined): void {
  if (fallback === undefined) return;
  for (let i = 0; i < strokes.length; i++) strokes[i] ??= fallback;
}

export function curveBatch(
  frame: LayerFrame,
  fx: Frame,
  color: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): PathsBatch | null {
  const { binding } = frame;
  if (frame.xend === null || frame.yend === null) return null;

  const params = (binding.layer.params ?? {}) as CurveParams;
  // Convert to panel px before tessellation so curvature stays aspect-safe.
  const { sampled, removed, totalVerts } = sampleCurves(frame, fx, params);
  removedWarning(removed, binding.index, warnings);
  if (sampled.length === 0) return null;

  const { positions, rowIndex, semanticAnchors, semanticIndex, pathOffsets, styleRows } =
    writeSampledCurves(frame, sampled, totalVerts);

  // One paint vector for all kept curve rows (#1309).
  const strokes = paintVector(frame, "color", color, styleRows);

  const paint = layerPaintFromParams(binding.layer.params);
  const strokePaintResolved =
    paint.strokePaint === null
      ? undefined
      : resolveGradientPaint(paint.strokePaint, binding.index, "stroke");
  const glowResolved = paint.glow === null ? undefined : resolveGlow(paint.glow, binding.index);
  applyStrokeFallback(strokes, strokePaintResolved?.fallback);

  const linewidths = numericStyleVector(frame, "linewidth", styleRows, styles);
  const alphas = numericStyleVector(frame, "alpha", styleRows, styles);
  const linetypeIndexes = indexedStyleVector(frame, "linetype", styleRows, styles, (value) =>
    linetypeIndex(value as Linetype),
  );
  const literalLinetype = binding.linetype.constant;
  // Match segment: map documented `lineend` → PathsBatch.linecap (default butt).
  const linecap = params.lineend ?? "butt";

  return {
    kind: "paths",
    layerIndex: binding.index,
    panelIndex: 0,
    positions,
    rowIndex,
    pathOffsets,
    strokes,
    semanticAnchors,
    semanticIndex,
    linewidth: constantStyle(binding, params, "linewidth", DEFAULT_RULE_LINEWIDTH),
    ...(linewidths !== undefined && { linewidths }),
    alpha: alphas === undefined ? constantStyle(binding, params, "alpha", 1) : 1,
    ...(alphas !== undefined && { alphas }),
    ...(typeof literalLinetype === "string" && { linetype: literalLinetype as Linetype }),
    ...(linetypeIndexes !== undefined && { linetypeIndexes }),
    linecap,
    curve: "linear",
    ...(strokePaintResolved !== undefined && { strokePaint: strokePaintResolved }),
    ...(glowResolved !== undefined && { glow: glowResolved }),
  };
}

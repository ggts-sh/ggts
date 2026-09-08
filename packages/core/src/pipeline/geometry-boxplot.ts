/**
 * Boxplot composite geometry from rects, segments, and outlier points.
 */
import type { BoxplotParams } from "@ggts-sh/spec";

import type { GeometryBatch, PointsBatch, RectsBatch, SegmentsBatch } from "../scene.js";
import { linetypeIndex, type Linetype } from "../scales/style.js";

import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";
import { NO_ROW } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import {
  indexedStyleVector,
  numericStyleVector,
  type ResolvedStyleScales,
} from "./geometry-style.js";
import { buildBoxplotBody } from "./geometry-boxplot-body.js";

const DEFAULT_OUTLIER_SIZE = 1.5;

function buildBoxplotOutliers(input: {
  frame: LayerFrame;
  fx: Frame;
  centerPx: readonly number[];
  alpha: number;
  params: BoxplotParams;
  styles: ResolvedStyleScales;
}): GeometryBatch | null {
  const { frame, fx, centerPx, alpha, params, styles } = input;
  const box = frame.box;
  if (box === null || box.outlierY.length === 0) return null;
  if (fx.yScale.type === "band") return null;
  const yScale = fx.yScale;

  const positions: number[] = [];
  const rowIndex: number[] = [];
  const styleRows: number[] = [];
  for (let i = 0; i < box.outlierY.length; i++) {
    const boxRow = box.outlierBox[i]!;
    const cx = centerPx[boxRow];
    const ty = yScale.normalizeTransformed(box.outlierY[i]!);
    if (cx === undefined || Number.isNaN(cx) || Number.isNaN(ty)) continue;
    positions.push(cx, fx.innerHeight - ty * fx.innerHeight);
    rowIndex.push(NO_ROW);
    styleRows.push(boxRow);
  }
  if (rowIndex.length === 0) return null;

  const batch: PointsBatch = {
    kind: "points",
    layerIndex: frame.binding.index,
    panelIndex: 0,
    positions: Float32Array.from(positions),
    rowIndex: Uint32Array.from(rowIndex),
    size: params.outlierSize ?? DEFAULT_OUTLIER_SIZE,
    alpha,
    shape: "circle",
    fill: null,
  };
  const alphas = numericStyleVector(frame, "alpha", styleRows, styles);
  if (alphas !== undefined) {
    batch.alpha = 1;
    batch.alphas = alphas;
  }
  return batch;
}

export function boxplotBatches(
  frame: LayerFrame,
  fx: Frame,
  fill: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): GeometryBatch[] {
  const body = buildBoxplotBody(frame, fx, fill, warnings);
  if (body === null) return [];

  const [whiskers, rects, medians] = body.batches as [SegmentsBatch, RectsBatch, SegmentsBatch];
  const whiskerRows = body.keptRows.flatMap((row) => [row, row]);
  const linewidths = numericStyleVector(frame, "linewidth", body.keptRows, styles);
  const whiskerLinewidths = numericStyleVector(frame, "linewidth", whiskerRows, styles);
  const alphas = numericStyleVector(frame, "alpha", body.keptRows, styles);
  const whiskerAlphas = numericStyleVector(frame, "alpha", whiskerRows, styles);
  const linetypes = indexedStyleVector(frame, "linetype", body.keptRows, styles, (value) =>
    linetypeIndex(value as Linetype),
  );
  const whiskerLinetypes = indexedStyleVector(frame, "linetype", whiskerRows, styles, (value) =>
    linetypeIndex(value as Linetype),
  );
  if (linewidths !== undefined) {
    rects.strokeWidths = linewidths;
    medians.linewidths = Float32Array.from(linewidths, (value) => value * 2);
  }
  if (whiskerLinewidths !== undefined) whiskers.linewidths = whiskerLinewidths;
  if (alphas !== undefined) {
    rects.alpha = 1;
    rects.alphas = alphas;
    medians.alpha = 1;
    medians.alphas = alphas;
  }
  if (whiskerAlphas !== undefined) {
    whiskers.alpha = 1;
    whiskers.alphas = whiskerAlphas;
  }
  if (linetypes !== undefined) {
    medians.linetypeIndexes = linetypes;
    rects.linetypeIndexes = linetypes;
  }
  if (whiskerLinetypes !== undefined) whiskers.linetypeIndexes = whiskerLinetypes;
  // Literal (non-scaled) linetype constants apply to every box stroke surface.
  if (typeof frame.binding.linetype.constant === "string") {
    const literal = frame.binding.linetype.constant as Linetype;
    whiskers.linetype = literal;
    medians.linetype = literal;
    rects.linetype = literal;
  }

  const out: GeometryBatch[] = [whiskers, rects, medians];
  const outliers = buildBoxplotOutliers({
    frame,
    fx,
    centerPx: body.centerPx,
    alpha: body.alpha,
    params: body.params,
    styles,
  });
  if (outliers !== null) out.push(outliers);
  return out;
}

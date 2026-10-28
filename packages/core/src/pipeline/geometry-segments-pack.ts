/**
 * Pack preallocated segment buffers into a SegmentsBatch.
 *
 * Callers pass already-compact typed arrays (dense as-is or sparse-sliced).
 * strokePaint/glow come from layer params via layerPaintFromParams (#1112).
 */
import { layerPaintFromParams, resolveGlow, resolveGradientPaint } from "../mark-paint.js";
import type { SegmentsBatch } from "../scene.js";
import { linetypeIndex, type Linetype } from "../scales/style.js";

import {
  indexedStyleVector,
  constantStyle,
  numericStyleVector,
  type ResolvedStyleScales,
} from "./geometry-style.js";
import type { LayerFrame } from "./types.js";
import { DEFAULT_RULE_LINEWIDTH } from "./geometry-shared.js";

function applyMappedSegmentStyles(
  batch: SegmentsBatch,
  frame: LayerFrame,
  styleRows: ArrayLike<number>,
  styles: ResolvedStyleScales,
): void {
  const linewidths = numericStyleVector(frame, "linewidth", styleRows, styles);
  const alphas = numericStyleVector(frame, "alpha", styleRows, styles);
  const linetypeIndexes = indexedStyleVector(frame, "linetype", styleRows, styles, (value) =>
    linetypeIndex(value as Linetype),
  );
  if (linewidths !== undefined) batch.linewidths = linewidths;
  if (alphas !== undefined) {
    batch.alpha = 1;
    batch.alphas = alphas;
  }
  if (linetypeIndexes !== undefined) batch.linetypeIndexes = linetypeIndexes;
}

/** A constant aes.linetype wins over the rule `params.linetype` (#1825). */
function constantLinetype(
  binding: LayerFrame["binding"],
  params: { linetype?: Linetype },
): { linetype?: Linetype } {
  const linetype =
    typeof binding.linetype?.constant === "string"
      ? (binding.linetype.constant as Linetype)
      : params.linetype;
  return linetype === undefined ? {} : { linetype };
}

export function packSegmentsBatch(input: {
  frame: LayerFrame;
  segments: Float32Array;
  rowIndex: Uint32Array;
  styleRows?: ArrayLike<number>;
  strokes: string[] | null;
  wantsColors: boolean;
  styles?: ResolvedStyleScales;
}): SegmentsBatch | null {
  const { frame, segments, rowIndex, strokes, wantsColors } = input;
  const styleRows = input.styleRows ?? rowIndex;
  const styles = input.styles ?? ({} as ResolvedStyleScales);
  if (rowIndex.length === 0) return null;
  const { binding } = frame;
  const params = (binding.layer.params ?? {}) as {
    linewidth?: number;
    alpha?: number;
    linetype?: Linetype;
  };
  const paint = layerPaintFromParams(binding.layer.params);
  const strokePaintResolved =
    paint.strokePaint === null
      ? undefined
      : resolveGradientPaint(paint.strokePaint, binding.index, "stroke");
  const glowResolved = paint.glow === null ? undefined : resolveGlow(paint.glow, binding.index);

  let stroke = binding.color.constant;
  // strokePaint solid fallback when stroke is still null/theme-default.
  if (stroke === null && strokePaintResolved !== undefined) {
    stroke = strokePaintResolved.fallback;
  }
  if (strokePaintResolved !== undefined && strokes !== null) {
    for (let i = 0; i < strokes.length; i++) {
      strokes[i] ??= strokePaintResolved.fallback;
    }
  }

  const batch: SegmentsBatch = {
    kind: "segments",
    layerIndex: binding.index,
    panelIndex: 0,
    segments,
    rowIndex,
    stroke,
    linewidth: constantStyle(binding, params, "linewidth", DEFAULT_RULE_LINEWIDTH),
    alpha: constantStyle(binding, params, "alpha", 1),
    ...constantLinetype(binding, params),
    ...(strokePaintResolved !== undefined && { strokePaint: strokePaintResolved }),
    ...(glowResolved !== undefined && { glow: glowResolved }),
  };
  applyMappedSegmentStyles(batch, frame, styleRows, styles);
  if (wantsColors && binding.ruleForm !== "annotation" && strokes !== null) {
    batch.strokes = strokes;
  }
  return batch;
}

/**
 * Errorbar geometry: vertical range plus caps.
 *
 * Emit preallocates typed segment buffers (3 segments per kept row); pack
 * reuses dense buffers and never Float32Array.from a number[] scratch list.
 */
import type { ErrorbarParams } from "@ggts-sh/spec";

import type { SegmentsBatch } from "../scene.js";
import { linetypeIndex, type Linetype } from "../scales/style.js";

import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import {
  indexedStyleVector,
  constantStyle,
  numericStyleVector,
  type ResolvedStyleScales,
} from "./geometry-style.js";
import { DEFAULT_RULE_LINEWIDTH, removedWarning } from "./geometry-shared.js";
import { emitErrorbarRows } from "./geometry-errorbar-rows.js";
import { makeErrorbarXSpan } from "./geometry-errorbar-width.js";

const DEFAULT_ERRORBAR_WIDTH = 0.9;

export function errorbarBatch(
  frame: LayerFrame,
  fx: Frame,
  color: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): SegmentsBatch | null {
  const { binding } = frame;
  if (frame.ymin === null || frame.ymax === null || fx.yScale.type === "band") return null;
  const params = (binding.layer.params ?? {}) as ErrorbarParams;
  const widthParam = params.width ?? DEFAULT_ERRORBAR_WIDTH;
  const wantsColors =
    color !== null && (frame.colorValues !== null || binding.color.scaledConstant !== null);

  const xSpanOf = makeErrorbarXSpan(frame, fx, widthParam);

  const emitted = emitErrorbarRows({
    frame,
    fx,
    color,
    wantsColors,
    xSpanOf,
  });
  removedWarning(emitted.removed, binding.index, warnings);
  if (emitted.keptSegments === 0) return null;

  const batch: SegmentsBatch = {
    kind: "segments",
    layerIndex: binding.index,
    panelIndex: 0,
    segments: emitted.segments,
    rowIndex: emitted.rowIndex,
    stroke: binding.color.constant,
    linewidth: constantStyle(binding, params, "linewidth", DEFAULT_RULE_LINEWIDTH),
    alpha: constantStyle(binding, params, "alpha", 1),
    ...(typeof binding.linetype?.constant === "string" && {
      linetype: binding.linetype.constant as Linetype,
    }),
  };
  const linewidths = numericStyleVector(frame, "linewidth", emitted.styleRows, styles);
  const alphas = numericStyleVector(frame, "alpha", emitted.styleRows, styles);
  const linetypeIndexes = indexedStyleVector(
    frame,
    "linetype",
    emitted.styleRows,
    styles,
    (value) => linetypeIndex(value as Linetype),
  );
  if (linewidths !== undefined) batch.linewidths = linewidths;
  if (alphas !== undefined) {
    batch.alpha = 1;
    batch.alphas = alphas;
  }
  if (linetypeIndexes !== undefined) batch.linetypeIndexes = linetypeIndexes;
  if (wantsColors && emitted.strokes !== null) batch.strokes = emitted.strokes;
  return batch;
}

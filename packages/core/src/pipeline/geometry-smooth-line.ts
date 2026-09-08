/**
 * Smooth fitted-line path batch.
 */
import type { SmoothParams } from "@ggts-sh/spec";

import type { GeometryBatch } from "../scene.js";
import { linetypeIndex, type Linetype } from "../scales/style.js";

import type { LayerFrame, ResolvedColorScale } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import {
  constantStyle,
  indexedStyleVector,
  numericStyleVector,
  type ResolvedStyleScales,
} from "./geometry-style.js";
import { writeLineSubpaths } from "./geometry-paths-line-write.js";
import { splitStyleSubpaths } from "./geometry-paths-style-subpaths.js";
import { DEFAULT_SMOOTH_LINEWIDTH } from "./geometry-smooth-shared.js";

export function buildSmoothLineBatch(input: {
  frame: LayerFrame;
  fx: Frame;
  color: ResolvedColorScale | null;
  groupRows: readonly (readonly number[])[];
  styles: ResolvedStyleScales;
}): GeometryBatch {
  const { frame, fx, color, groupRows, styles } = input;
  const { binding } = frame;
  const params = (binding.layer.params ?? {}) as SmoothParams;
  const subpaths = splitStyleSubpaths(frame, groupRows, styles);
  const styleSplit = subpaths.length > groupRows.length;
  const { positions, rowIndex, frameRowIndex, pathOffsets, strokes } = writeLineSubpaths({
    frame,
    fx,
    color,
    subpaths,
    includeFrameRows: styleSplit,
  });
  const styleRows = subpaths.map((rows) => rows[0]!);
  const linewidths = numericStyleVector(frame, "linewidth", styleRows, styles);
  const alphas = numericStyleVector(frame, "alpha", styleRows, styles);
  const linetypeIndexes = indexedStyleVector(frame, "linetype", styleRows, styles, (value) =>
    linetypeIndex(value as Linetype),
  );
  return {
    kind: "paths",
    layerIndex: binding.index,
    panelIndex: 0,
    positions,
    rowIndex,
    ...(frameRowIndex !== undefined && { frameRowIndex }),
    pathOffsets,
    strokes,
    linewidth: constantStyle(binding, params, "linewidth", DEFAULT_SMOOTH_LINEWIDTH),
    ...(linewidths !== undefined && { linewidths }),
    alpha: alphas === undefined ? constantStyle(binding, params, "alpha", 1) : 1,
    ...(alphas !== undefined && { alphas }),
    ...(typeof binding.linetype.constant === "string" && {
      linetype: binding.linetype.constant as Linetype,
    }),
    ...(linetypeIndexes !== undefined && { linetypeIndexes }),
    curve: "linear",
  };
}

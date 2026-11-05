/**
 * Bar/col (and binned histogram) rect geometry batch builder.
 */
import type { RectsBatch } from "../scene.js";
import { resolution as resolutionOf } from "../stats/numeric.js";

import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import {
  constantStyle,
  mappedPaintVector,
  numericStyleVector,
  type ResolvedStyleScales,
} from "./geometry-style.js";
import { DEFAULT_BAR_WIDTH, droppedFrameRows, removedWarning } from "./geometry-shared.js";
import { emitRectRows } from "./geometry-rects-emit.js";

export function rectsBatch(
  frame: LayerFrame,
  fx: Frame,
  fill: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): RectsBatch | null {
  const { binding } = frame;
  if (frame.ymin === null || frame.ymax === null) return null;
  const binned = (frame.xmin !== null && frame.xmax !== null) || binding.xBinning !== undefined;
  const params = (binding.layer.params ?? {}) as { width?: number; alpha?: number };
  let widthFrac: number;
  if (fx.xScale.type === "band") {
    widthFrac = (params.width ?? DEFAULT_BAR_WIDTH) * fx.xScale.step;
  } else if (binned) {
    // stat-bin carries exact xmin/xmax edges (0 means span the full bin); a
    // binned position scale applies the authored/default width fraction.
    widthFrac = binding.xBinning === undefined ? 0 : (params.width ?? DEFAULT_BAR_WIDTH);
  } else {
    // Continuous bar width tracks min positive x-gap (ggplot2 resolution).
    // Fewer than two distinct x values → resolution 0 → fall back to gap 1 so
    // widthFrac still has a finite data-unit scale (pre-unique-first parity).
    const gap = resolutionOf(frame.xNumeric ?? []);
    const resolution = gap > 0 ? gap : 1;
    const span = fx.xScale.transformedDomain[1] - fx.xScale.transformedDomain[0];
    widthFrac = span === 0 ? 0 : ((params.width ?? DEFAULT_BAR_WIDTH) * resolution) / span;
  }

  const { rects, rowIndex, keptRows, kept, removed } = emitRectRows({
    frame,
    fx,
    binned,
    widthFrac,
  });
  removedWarning(removed, binding.index, warnings);
  if (kept === 0) return null;

  const batch: RectsBatch = {
    kind: "rects",
    layerIndex: binding.index,
    panelIndex: 0,
    rects,
    rowIndex,
    ...droppedFrameRows(keptRows, frame.n),
    fill: binding.fill.constant,
    alpha: constantStyle(binding, params, "alpha", 1),
  };
  const alphas = numericStyleVector(frame, "alpha", keptRows, styles);
  if (alphas !== undefined) {
    batch.alpha = 1;
    batch.alphas = alphas;
  }
  if (fill !== null && (frame.fillValues !== null || binding.fill.scaledConstant !== null)) {
    batch.fills = mappedPaintVector(frame, "fill", fill, keptRows);
  }
  return batch;
}

/**
 * Finite segment geometry: one (x,y)→(xend,yend) segment per data row.
 *
 * Distinct from rule's panel-spanning segmentsBatch. Reuses SegmentsBatch
 * packing so flip/coord/candidates/render stay shared.
 */
import type { SegmentParams } from "@ggts-sh/spec";

import type { SegmentsBatch } from "../scene.js";

import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import { positionOf, removedWarning } from "./geometry-shared.js";
import { mappedPaintVector, type ResolvedStyleScales } from "./geometry-style.js";
import { packSegmentsBatch } from "./geometry-segments-pack.js";

export function finiteSegmentBatch(
  frame: LayerFrame,
  fx: Frame,
  color: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): SegmentsBatch | null {
  const { binding } = frame;
  if (frame.xend === null || frame.yend === null) return null;

  const wantsColors =
    color !== null && (frame.colorValues !== null || binding.color.scaledConstant !== null);
  const capacity = frame.n;
  const segments = new Float32Array(capacity * 4);
  const rowIndex = new Uint32Array(capacity);
  const styleRows = new Uint32Array(capacity);
  let kept = 0;
  let removed = 0;

  for (let row = 0; row < frame.n; row++) {
    const t0x = positionOf(fx.xScale, frame.xNumeric, frame.xValues, row);
    const t0y = positionOf(fx.yScale, frame.yNumeric, frame.yValues, row);
    const t1x = positionOf(fx.xScale, frame.xend, frame.xendValues, row);
    const t1y = positionOf(fx.yScale, frame.yend, frame.yendValues, row);
    if (Number.isNaN(t0x) || Number.isNaN(t0y) || Number.isNaN(t1x) || Number.isNaN(t1y)) {
      removed++;
      continue;
    }
    const o = kept * 4;
    segments[o] = t0x * fx.innerWidth;
    segments[o + 1] = fx.innerHeight - t0y * fx.innerHeight;
    segments[o + 2] = t1x * fx.innerWidth;
    segments[o + 3] = fx.innerHeight - t1y * fx.innerHeight;
    rowIndex[kept] = frame.rowIndex[row]!;
    styleRows[kept] = row;
    kept++;
  }

  removedWarning(removed, binding.index, warnings);
  if (kept === 0) return null;

  const outSegments = kept === capacity ? segments : segments.subarray(0, kept * 4).slice();
  const outRows = kept === capacity ? rowIndex : rowIndex.subarray(0, kept).slice();
  const outStyleRows = kept === capacity ? styleRows : styleRows.subarray(0, kept).slice();
  const outStrokes =
    wantsColors && color !== null ? mappedPaintVector(frame, "color", color, outStyleRows) : null;

  const batch = packSegmentsBatch({
    frame,
    segments: outSegments,
    rowIndex: outRows,
    styleRows: outStyleRows,
    strokes: outStrokes,
    wantsColors,
    styles,
  });
  if (batch === null) return null;

  const params = (binding.layer.params ?? {}) as SegmentParams;
  const lineend = params.lineend ?? "butt";
  batch.linecap = lineend;
  return batch;
}

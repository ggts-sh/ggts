/**
 * geom_rug: short ticks along panel edges for marginal distributions (#806).
 *
 * Reuses SegmentsBatch packing (rule/segment). Length is a panel-fraction
 * (ggplot2 unit(0.03, "npc") analogue). Sides are panel-edge-relative and
 * do not flip with reversed scales.
 */
import type { RugParams } from "@ggts-sh/spec";

import type { SegmentsBatch } from "../scene.js";

import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import { positionOf, removedWarning } from "./geometry-shared.js";
import { mappedPaintVector, type ResolvedStyleScales } from "./geometry-style.js";
import { packSegmentsBatch } from "./geometry-segments-pack.js";

const DEFAULT_SIDES = "bl";
const DEFAULT_LENGTH = 0.03;

function parseRugSides(sides: string | undefined): Set<"b" | "l" | "t" | "r"> {
  const raw = sides !== undefined && sides.length > 0 ? sides : DEFAULT_SIDES;
  const out = new Set<"b" | "l" | "t" | "r">();
  for (const ch of raw) {
    if (ch === "b" || ch === "l" || ch === "t" || ch === "r") out.add(ch);
  }
  return out;
}

function rugLength(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(value, 1)
    : DEFAULT_LENGTH;
}

function emitRugSegments(
  frame: LayerFrame,
  fx: Frame,
  sides: ReadonlySet<"b" | "l" | "t" | "r">,
  length: number,
): {
  segments: Float32Array;
  rowIndex: Uint32Array;
  styleRows: Uint32Array;
  kept: number;
  removed: number;
} {
  const capacity = frame.n * sides.size;
  const segments = new Float32Array(capacity * 4);
  const rowIndex = new Uint32Array(capacity);
  const styleRows = new Uint32Array(capacity);
  const needX = sides.has("b") || sides.has("t");
  const needY = sides.has("l") || sides.has("r");
  const width = fx.innerWidth;
  const height = fx.innerHeight;
  const tickHeight = length * height;
  const tickWidth = length * width;
  let kept = 0;
  let removed = 0;

  const push = (row: number, x0: number, y0: number, x1: number, y1: number): void => {
    const offset = kept * 4;
    segments[offset] = x0;
    segments[offset + 1] = y0;
    segments[offset + 2] = x1;
    segments[offset + 3] = y1;
    rowIndex[kept] = frame.rowIndex[row]!;
    styleRows[kept] = row;
    kept++;
  };

  for (let row = 0; row < frame.n; row++) {
    let emitted = 0;
    if (needX) {
      const tx = positionOf(fx.xScale, frame.xNumeric, frame.xValues, row);
      if (!Number.isNaN(tx)) {
        const x = tx * width;
        if (sides.has("b")) {
          push(row, x, height, x, height - tickHeight);
          emitted++;
        }
        if (sides.has("t")) {
          push(row, x, 0, x, tickHeight);
          emitted++;
        }
      }
    }
    if (needY) {
      const ty = positionOf(fx.yScale, frame.yNumeric, frame.yValues, row);
      if (!Number.isNaN(ty)) {
        const y = height - ty * height;
        if (sides.has("l")) {
          push(row, 0, y, tickWidth, y);
          emitted++;
        }
        if (sides.has("r")) {
          push(row, width, y, width - tickWidth, y);
          emitted++;
        }
      }
    }
    if (emitted === 0) removed++;
  }
  return { segments, rowIndex, styleRows, kept, removed };
}

export function rugBatch(
  frame: LayerFrame,
  fx: Frame,
  color: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): SegmentsBatch | null {
  const { binding } = frame;
  const params = (binding.layer.params ?? {}) as RugParams;
  const sides = parseRugSides(params.sides);
  const length = rugLength(params.length);

  const needX = sides.has("b") || sides.has("t");
  const needY = sides.has("l") || sides.has("r");
  if (needX && frame.xNumeric === null && frame.xValues === null) return null;
  if (needY && frame.yNumeric === null && frame.yValues === null) return null;

  const wantsColors =
    color !== null && (frame.colorValues !== null || binding.color.scaledConstant !== null);

  // Worst case: every side emits for every row.
  const capacity = frame.n * sides.size;
  if (capacity === 0) return null;

  const { segments, rowIndex, styleRows, kept, removed } = emitRugSegments(
    frame,
    fx,
    sides,
    length,
  );

  // One removal unit per row that produced no ticks (all requested channels non-finite).
  removedWarning(removed, binding.index, warnings);
  if (kept === 0) return null;

  const outSegments = kept === capacity ? segments : segments.subarray(0, kept * 4).slice();
  const outRows = kept === capacity ? rowIndex : rowIndex.subarray(0, kept).slice();
  const outStyleRows = kept === capacity ? styleRows : styleRows.subarray(0, kept).slice();
  const outStrokes =
    wantsColors && color !== null ? mappedPaintVector(frame, "color", color, outStyleRows) : null;

  return packSegmentsBatch({
    frame,
    segments: outSegments,
    rowIndex: outRows,
    styleRows: outStyleRows,
    strokes: outStrokes,
    wantsColors,
    styles,
  });
}

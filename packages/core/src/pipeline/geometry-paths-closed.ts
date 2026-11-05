/**
 * Shared closed-band path edges: upper ascending, lower descending.
 * Used by area/density ribbons and smooth confidence bands.
 */
import type { LayerFrame } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import { positionOf } from "./geometry-shared.js";

type EdgeBuffers = {
  positions: Float32Array;
  rowIndex: Uint32Array;
  closedFrameRows?: Uint32Array;
};

/** Emit a vertex wherever the segment crosses y = 0 or y = 1, in travel order. */
function putCrossings(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  row: number,
  put: (tx: number, ty: number, row: number) => void,
): void {
  const first = y0 < y1 ? 0 : 1;
  for (const level of [first, 1 - first]) {
    if ((y0 - level) * (y1 - level) < 0)
      put(x0 + ((level - y0) / (y1 - y0)) * (x1 - x0), level, row);
  }
}

/**
 * Append one edge of a band. `rows` are visited in the given order.
 *
 * When `clip` is set, the edge is cut to the panel's unit span in y. The band
 * between two curves, cut to a strip, is the band between the two clamped
 * curves, so clamping is exact if every segment that crosses a limit gets a
 * vertex at the crossing. Clamping the vertices alone would bend those
 * segments (#1905). A crossing vertex takes the row of the segment's end.
 * NaN compares false, so it passes through and the row drops as before.
 */
function appendEdge(
  buffers: EdgeBuffers,
  start: number,
  rows: readonly number[],
  reverse: boolean,
  y: Float64Array,
  frame: LayerFrame,
  fx: Frame,
): number {
  const { positions, rowIndex, closedFrameRows } = buffers;
  const clip = fx.clip === true;
  let cursor = start;
  const put = (tx: number, ty: number, row: number): void => {
    positions[cursor * 2] = tx * fx.innerWidth;
    positions[cursor * 2 + 1] = fx.innerHeight - ty * fx.innerHeight;
    rowIndex[cursor] = frame.rowIndex[row]!;
    if (closedFrameRows !== undefined) closedFrameRows[cursor] = row;
    cursor++;
  };
  let prevX = 0;
  let prevY = 0;
  for (let k = 0; k < rows.length; k++) {
    const row = rows[reverse ? rows.length - 1 - k : k]!;
    const tx = positionOf(fx.xScale, frame.xNumeric, frame.xValues, row);
    let ty = fx.yScale.type === "band" ? NaN : fx.yScale.normalizeTransformed(y[row]!);
    if (clip) {
      if (k > 0) putCrossings(prevX, prevY, tx, ty, row, put);
      prevX = tx;
      prevY = ty;
      ty = Math.min(Math.max(ty, 0), 1);
    }
    put(tx, ty, row);
  }
  return cursor;
}

/**
 * Append upper-then-reversed-lower vertices for one closed band subpath.
 * Returns the advanced cursor.
 */
export function appendClosedBandEdges(input: {
  positions: Float32Array;
  rowIndex: Uint32Array;
  /** Optional parallel frame-row ids (same length as rowIndex / vertex count). */
  closedFrameRows?: Uint32Array;
  cursor: number;
  rows: readonly number[];
  frame: LayerFrame;
  fx: Frame;
  yTop: Float64Array;
  yBottom: Float64Array;
}): number {
  const { rows, frame, fx, yTop, yBottom } = input;
  const upper = appendEdge(input, input.cursor, rows, false, yTop, frame, fx);
  return appendEdge(input, upper, rows, true, yBottom, frame, fx);
}

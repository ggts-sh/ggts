/**
 * Allocate and fill multi-group closed path buffers with per-group fills.
 */
import type { LayerFrame } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import { appendClosedBandEdges } from "./geometry-paths-closed.js";

export function writeClosedPathGroups(input: {
  frame: LayerFrame;
  fx: Frame;
  groupRows: readonly (readonly number[])[];
  yTop: Float64Array;
  yBottom: Float64Array;
  fillOf: (rows: readonly number[], groupIndex: number) => string | null;
}): {
  positions: Float32Array;
  rowIndex: Uint32Array;
  closedFrameRows: Uint32Array;
  pathOffsets: Uint32Array;
  fills: (string | null)[];
  strokes: (string | null)[];
} {
  const { frame, fx, groupRows, yTop, yBottom, fillOf } = input;
  // A clipped edge gains up to two crossing vertices per segment, so a group
  // needs at most 6n - 4 slots. Trim the buffers once the cursor is known.
  const perRow = fx.clip === true ? 6 : 2;
  let total = 0;
  for (const rows of groupRows) total += rows.length * perRow;
  const positions = new Float32Array(total * 2);
  const rowIndex = new Uint32Array(total);
  const closedFrameRows = new Uint32Array(total);
  const pathOffsets = new Uint32Array(groupRows.length + 1);
  const fills: (string | null)[] = [];
  const strokes: (string | null)[] = [];
  let cursor = 0;
  for (let s = 0; s < groupRows.length; s++) {
    pathOffsets[s] = cursor;
    const rows = groupRows[s]!;
    cursor = appendClosedBandEdges({
      positions,
      rowIndex,
      closedFrameRows,
      cursor,
      rows,
      frame,
      fx,
      yTop,
      yBottom,
    });
    fills.push(fillOf(rows, s));
    strokes.push(null);
  }
  pathOffsets[groupRows.length] = cursor;
  if (cursor === total)
    return { positions, rowIndex, closedFrameRows, pathOffsets, fills, strokes };
  return {
    positions: positions.slice(0, cursor * 2),
    rowIndex: rowIndex.slice(0, cursor),
    closedFrameRows: closedFrameRows.slice(0, cursor),
    pathOffsets,
    fills,
    strokes,
  };
}

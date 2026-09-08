import type { CellValue, GeometryBatch, RenderModel } from "./index.js";

/** Rows referenced by a canvas stratum, capped for the a11y table. */
export const A11Y_TABLE_CAP = 100;

/**
 * Distinct source-row indexes referenced by canvas batches.
 * Skips the `0xffffffff` missing-row sentinel. Shared by count-only and
 * materialise paths so sentinel / dedupe semantics cannot drift.
 *
 * Cost: O(P) time over primitive `rowIndex` entries, O(R) memory for the set
 * (R = distinct indexes). Does not sort or call `model.row`.
 */
export function collectCanvasRowIndexes(batches: readonly GeometryBatch[]): Set<number> {
  const rowSet = new Set<number>();
  for (const batch of batches) {
    for (const raw of batch.rowIndex) {
      if (raw !== 0xffffffff) rowSet.add(raw);
    }
  }
  return rowSet;
}

/**
 * Distinct canvas mark count for aria labels (source-row indexes, not
 * geometry primitives). O(P) scan, O(R) set — no sort, no row materialisation.
 */
export function a11yMarkCount(batches: readonly GeometryBatch[]): number {
  return collectCanvasRowIndexes(batches).size;
}

/**
 * Build the capped a11y data table for an open canvas stratum.
 *
 * - `total` = distinct source-row indexes (matches `a11yMarkCount`).
 * - `rows` = up to {@link A11Y_TABLE_CAP} materialised rows in ascending
 *   source-row index order; null `model.row` entries are skipped and do not
 *   count toward the cap.
 * - Selection is a CAP-sized max-heap of successful materialisations
 *   (O(R log CAP) heap ops, not a full O(R log R) sort). Closed UIs should
 *   call {@link a11yMarkCount} instead.
 */
export function a11yRows(
  model: RenderModel,
  batches: GeometryBatch[],
): { fields: string[]; rows: CellValue[][]; total: number } {
  const rowSet = collectCanvasRowIndexes(batches);
  const fieldSet = new Set<string>();
  for (const batch of batches) {
    for (const f of model.layerFields[batch.layerIndex] ?? []) fieldSet.add(f.field);
  }
  const fields = [...fieldSet];
  // Max-heap by source-row index (largest index at [0]), size ≤ CAP. Keeps
  // the CAP smallest indexes that materialise successfully without sorting R.
  type Entry = { index: number; cells: CellValue[] };
  const heap: Entry[] = [];
  const siftDown = (start: number): void => {
    let i = start;
    for (;;) {
      const left = i * 2 + 1;
      const right = left + 1;
      let largest = i;
      if (left < heap.length && heap[left]!.index > heap[largest]!.index) largest = left;
      if (right < heap.length && heap[right]!.index > heap[largest]!.index) largest = right;
      if (largest === i) break;
      const tmp = heap[i]!;
      heap[i] = heap[largest]!;
      heap[largest] = tmp;
      i = largest;
    }
  };
  const siftUp = (start: number): void => {
    let i = start;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[i]!.index <= heap[parent]!.index) break;
      const tmp = heap[i]!;
      heap[i] = heap[parent]!;
      heap[parent] = tmp;
      i = parent;
    }
  };
  for (const index of rowSet) {
    // Skip indexes that cannot enter a full heap before paying model.row().
    if (heap.length >= A11Y_TABLE_CAP && index >= heap[0]!.index) continue;
    const row = model.row(index);
    if (row === null) continue;
    const cells = fields.map((f) => row[f] ?? null);
    if (heap.length < A11Y_TABLE_CAP) {
      heap.push({ index, cells });
      siftUp(heap.length - 1);
    } else {
      heap[0] = { index, cells };
      siftDown(0);
    }
  }
  // CAP-or-fewer entries — sorting the heap is O(CAP log CAP), not O(R log R).
  heap.sort((a, b) => a.index - b.index);
  return { fields, rows: heap.map((entry) => entry.cells), total: rowSet.size };
}

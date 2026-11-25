/**
 * Facet panel row partition (encodeKey preserves `"1"`/`1` and `0`/`-0`).
 *
 * One O(n) scan groups a layer's row indices by field value so panel slicing
 * can look up a bucket instead of re-scanning per panel (issue #183).
 */
import { encodeKey } from "../scales/state.js";
import type { ColumnTable } from "../table.js";

/**
 * Single-pass partition of table rows by a facet field's encodeKey.
 * Row indices within each bucket preserve table order.
 */
export function partitionByField(table: ColumnTable, field: string): Map<string, number[]> {
  const map = new Map<string, number[]>();
  const column = table.column(field);
  for (let i = 0; i < column.length; i++) {
    const k = encodeKey(column[i]!);
    let bucket = map.get(k);
    if (bucket === undefined) map.set(k, (bucket = []));
    bucket.push(i);
  }
  return map;
}

/**
 * Single-pass partition of table rows by the composite encodeKey of two facet
 * fields (grid rows × cols). Outer map keyed by `fieldA`, inner by `fieldB`;
 * row indices within each bucket preserve table order. Empty (a, b)
 * combinations are simply absent — a missing bucket is the caller's empty panel.
 * O(n), replacing per-cell bucket intersection over R·C cells (issue #183).
 */
export function partitionByFields(
  table: ColumnTable,
  fieldA: string,
  fieldB: string,
): Map<string, Map<string, number[]>> {
  const map = new Map<string, Map<string, number[]>>();
  const colA = table.column(fieldA);
  const colB = table.column(fieldB);
  for (let i = 0; i < colA.length; i++) {
    const ka = encodeKey(colA[i]!);
    const kb = encodeKey(colB[i]!);
    let inner = map.get(ka);
    if (inner === undefined) map.set(ka, (inner = new Map<string, number[]>()));
    let bucket = inner.get(kb);
    if (bucket === undefined) inner.set(kb, (bucket = []));
    bucket.push(i);
  }
  return map;
}

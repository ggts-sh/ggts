/**
 * Facet grid partition: rows × cols combinations (empty combos kept).
 */
import type { FacetFieldRef } from "@ggts-sh/spec";

import { createFacetPanelIdentity } from "../facet-identity.js";
import { encodeKey } from "../scales/state.js";
import type { CellValue, ColumnTable } from "../table.js";

import { facetDisplayLabel, facetValues } from "./facets-helpers.js";
import { partitionByField, partitionByFields } from "./facets-tokens.js";
import type { FacetLayout, FacetPanelDef, FacetStripConfig } from "./facets-types.js";
import { SINGLE_PANEL } from "./facets-types.js";
import type { PipelineWarning } from "./types.js";

export function resolveFacetGrid(input: {
  table: ColumnTable;
  rowsField: string | null;
  rowsRef: FacetFieldRef | undefined;
  colsField: string | null;
  colsRef: FacetFieldRef | undefined;
  freeX: boolean;
  freeY: boolean;
  baseSourceRows: number[] | null;
  strip: FacetStripConfig;
  warnings: PipelineWarning[];
}): FacetLayout {
  const { table, rowsField, colsField, freeX, freeY, baseSourceRows, strip } = input;
  const rowValues = facetValuesFor(input, "rows");
  const colValues = facetValuesFor(input, "cols");
  if (
    (rowsField !== null && rowValues.length === 0) ||
    (colsField !== null && colValues.length === 0)
  ) {
    return SINGLE_PANEL(table, baseSourceRows);
  }
  // Partition rows once (issue #183): a full grid by the composite (row, col)
  // key, or a single dimension when only one field is set — O(n), then O(R·C)
  // bucket reads. With closed levels, an absent bucket is a genuine empty combo.
  const grid =
    rowsField !== null && colsField !== null
      ? partitionByFields(table, rowsField, colsField)
      : null;
  const rowBuckets =
    rowsField !== null && colsField === null ? partitionByField(table, rowsField) : null;
  const colBuckets =
    colsField !== null && rowsField === null ? partitionByField(table, colsField) : null;
  const panels: FacetPanelDef[] = [];
  for (let r = 0; r < rowValues.length; r++) {
    // Row-dimension lookup is loop-invariant across the col loop — hoist it.
    // Closed levels may list row values never observed: missing outer/inner
    // buckets yield empty panels, not a hard throw.
    const rowInner = grid === null ? null : (grid.get(encodeKey(rowValues[r]!)) ?? null);
    const rowOnly = rowBuckets === null ? null : (rowBuckets.get(encodeKey(rowValues[r]!)) ?? []);
    for (let c = 0; c < colValues.length; c++) {
      const rows = panelRows(grid, rowInner, rowOnly, colBuckets, colValues[c]!);
      panels.push(makeFacetPanel(input, rowValues[r]!, colValues[c]!, rows, r, c));
    }
  }
  return {
    faceted: true,
    panels,
    nrow: rowValues.length,
    ncol: colValues.length,
    freeX,
    freeY,
    strip,
  };
}

type FacetGridInput = Parameters<typeof resolveFacetGrid>[0];

function facetValuesFor(input: FacetGridInput, axis: "rows" | "cols") {
  const field = axis === "rows" ? input.rowsField : input.colsField;
  const ref = axis === "rows" ? input.rowsRef : input.colsRef;
  if (field === null) return [null];
  return facetValues(input.table, field, {
    ...(ref?.levels !== undefined && { levels: ref.levels }),
    path: `/facet/${axis}/levels`,
    warnings: input.warnings,
  });
}

function panelRows(
  grid: Map<string, Map<string, number[]>> | null,
  rowInner: Map<string, number[]> | null,
  rowOnly: number[] | null,
  colBuckets: Map<string, number[]> | null,
  colValue: CellValue,
): number[] {
  if (grid !== null) return rowInner?.get(encodeKey(colValue)) ?? [];
  if (rowOnly !== null) return rowOnly;
  if (colBuckets === null) throw new Error("facet grid resolved with neither rows nor cols field");
  return colBuckets.get(encodeKey(colValue)) ?? [];
}

function makeFacetPanel(
  input: FacetGridInput,
  rowValue: CellValue,
  colValue: CellValue,
  rows: number[],
  row: number,
  col: number,
): FacetPanelDef {
  const { table, rowsField, colsField, rowsRef, colsRef, baseSourceRows } = input;
  const parts: string[] = [];
  if (rowsField !== null) parts.push(facetDisplayLabel(rowValue, rowsRef?.labels));
  if (colsField !== null) parts.push(facetDisplayLabel(colValue, colsRef?.labels));
  const identity = createFacetPanelIdentity([
    ...(rowsField === null ? [] : [{ role: "rows" as const, field: rowsField, value: rowValue }]),
    ...(colsField === null ? [] : [{ role: "cols" as const, field: colsField, value: colValue }]),
  ]);
  return {
    identity,
    id: identity.key,
    label: parts.join(" / "),
    row,
    col,
    table: table.subset(rows),
    sourceRows: rows.map((index) => baseSourceRows?.[index] ?? index),
  };
}

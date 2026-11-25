/**
 * Facet grid layout: rows × cols combinations (empty combos kept).
 */
import type { FacetFieldRef } from "@ggts-sh/spec";

import { createFacetPanelIdentity } from "../facet-identity.js";
import type { CellValue, ColumnTable } from "../table.js";

import { facetDisplayLabel, facetValues } from "./facets-helpers.js";
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
  strip: FacetStripConfig;
  warnings: PipelineWarning[];
}): FacetLayout {
  const { rowsField, colsField, freeX, freeY, strip } = input;
  const rowValues = facetValuesFor(input, "rows");
  const colValues = facetValuesFor(input, "cols");
  if (
    (rowsField !== null && rowValues.length === 0) ||
    (colsField !== null && colValues.length === 0)
  ) {
    return SINGLE_PANEL();
  }
  const panels: FacetPanelDef[] = [];
  for (let r = 0; r < rowValues.length; r++) {
    for (let c = 0; c < colValues.length; c++) {
      panels.push(makeFacetPanel(input, rowValues[r]!, colValues[c]!, r, c));
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

function makeFacetPanel(
  input: FacetGridInput,
  rowValue: CellValue,
  colValue: CellValue,
  row: number,
  col: number,
): FacetPanelDef {
  const { rowsField, colsField, rowsRef, colsRef } = input;
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
  };
}

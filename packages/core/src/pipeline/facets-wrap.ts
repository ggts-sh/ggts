/**
 * Facet wrap partition: one panel per distinct value, near-square ncol default.
 */
import type { FacetFieldRef } from "@ggts-sh/spec";

import { createFacetPanelIdentity } from "../facet-identity.js";
import { encodeKey } from "../scales/state.js";
import type { ColumnTable } from "../table.js";

import { facetDisplayLabel, facetValues } from "./facets-helpers.js";
import { partitionByField } from "./facets-tokens.js";
import type { FacetLayout, FacetStripConfig } from "./facets-types.js";
import { SINGLE_PANEL } from "./facets-types.js";
import type { PipelineWarning } from "./types.js";

export function resolveFacetWrap(input: {
  table: ColumnTable;
  wrapField: string;
  wrapRef: FacetFieldRef | undefined;
  ncol: number | undefined;
  freeX: boolean;
  freeY: boolean;
  baseSourceRows: number[] | null;
  strip: FacetStripConfig;
  warnings: PipelineWarning[];
}): FacetLayout {
  const { table, wrapField, freeX, freeY, baseSourceRows, strip, warnings } = input;
  const levels = input.wrapRef?.levels;
  const labels = input.wrapRef?.labels;
  const values = facetValues(table, wrapField, {
    ...(levels !== undefined && { levels }),
    path: "/facet/wrap/levels",
    warnings,
  });
  if (values.length === 0) return SINGLE_PANEL(table, baseSourceRows);
  const ncol = Math.min(values.length, input.ncol ?? Math.ceil(Math.sqrt(values.length)));
  const nrow = Math.ceil(values.length / ncol);
  // One O(n) partition, then O(v) panel assembly (issue #183).
  const buckets = partitionByField(table, wrapField);
  const panels = values.map((value, i) => {
    // Closed levels may list values never observed — empty panel is intentional.
    const rows = buckets.get(encodeKey(value)) ?? [];
    const identity = createFacetPanelIdentity([{ role: "wrap", field: wrapField, value }]);
    return {
      identity,
      id: identity.key,
      label: facetDisplayLabel(value, labels),
      row: Math.floor(i / ncol),
      col: i % ncol,
      table: table.subset(rows),
      sourceRows: rows.map((row) => baseSourceRows?.[row] ?? row),
    };
  });
  return { faceted: true, panels, nrow, ncol, freeX, freeY, strip };
}

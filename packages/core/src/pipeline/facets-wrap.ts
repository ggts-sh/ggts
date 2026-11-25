/**
 * Facet wrap layout: one panel per distinct value, near-square ncol default.
 */
import type { FacetFieldRef } from "@ggts-sh/spec";

import { createFacetPanelIdentity } from "../facet-identity.js";
import type { ColumnTable } from "../table.js";

import { facetDisplayLabel, facetValues } from "./facets-helpers.js";
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
  strip: FacetStripConfig;
  warnings: PipelineWarning[];
}): FacetLayout {
  const { table, wrapField, freeX, freeY, strip, warnings } = input;
  const levels = input.wrapRef?.levels;
  const labels = input.wrapRef?.labels;
  const values = facetValues(table, wrapField, {
    ...(levels !== undefined && { levels }),
    path: "/facet/wrap/levels",
    warnings,
  });
  if (values.length === 0) return SINGLE_PANEL();
  const ncol = Math.min(values.length, input.ncol ?? Math.ceil(Math.sqrt(values.length)));
  const nrow = Math.ceil(values.length / ncol);
  const panels = values.map((value, i) => {
    const identity = createFacetPanelIdentity([{ role: "wrap", field: wrapField, value }]);
    return {
      identity,
      id: identity.key,
      label: facetDisplayLabel(value, labels),
      row: Math.floor(i / ncol),
      col: i % ncol,
    };
  });
  return { faceted: true, panels, nrow, ncol, freeX, freeY, strip };
}

/**
 * Facet partition (BEFORE stats/positions — plan round-2 consensus).
 * Counts, bins, stacks, and dodges are panel-local, exactly like ggplot2.
 */
import type { FacetSpec } from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";

import { facetField } from "./facets-helpers.js";
import { resolveFacetGrid } from "./facets-grid.js";
import type { FacetLayout, FacetStripConfig } from "./facets-types.js";
import { DEFAULT_FACET_STRIP, SINGLE_PANEL } from "./facets-types.js";
import { assertFacetForm, facetFreeFlags } from "./facets-form.js";
import { resolveFacetWrap } from "./facets-wrap.js";
import type { PipelineWarning } from "./types.js";

export type { FacetPanelDef, FacetLayout, FacetStripConfig } from "./facets-types.js";
export { SINGLE_PANEL, DEFAULT_FACET_STRIP } from "./facets-types.js";

function resolveStripConfig(facet: FacetSpec): FacetStripConfig {
  return {
    position: facet.strip?.position ?? DEFAULT_FACET_STRIP.position,
    show: facet.strip?.show ?? DEFAULT_FACET_STRIP.show,
  };
}

export function resolveFacet(
  facet: FacetSpec | undefined,
  table: ColumnTable,
  baseSourceRows: number[] | null = null,
  warnings: PipelineWarning[] = [],
): FacetLayout {
  if (facet === undefined) return SINGLE_PANEL(table, baseSourceRows);
  const wrapField = facetField(facet.wrap, "wrap", table);
  const rowsField = facetField(facet.rows, "rows", table);
  const colsField = facetField(facet.cols, "cols", table);
  assertFacetForm({ wrapField, rowsField, colsField });
  const { freeX, freeY } = facetFreeFlags(facet.scales);
  const strip = resolveStripConfig(facet);

  if (wrapField !== null) {
    return resolveFacetWrap({
      table,
      wrapField,
      wrapRef: facet.wrap,
      ncol: facet.ncol,
      freeX,
      freeY,
      baseSourceRows,
      strip,
      warnings,
    });
  }

  return resolveFacetGrid({
    table,
    rowsField,
    rowsRef: facet.rows,
    colsField,
    colsRef: facet.cols,
    freeX,
    freeY,
    baseSourceRows,
    strip,
    warnings,
  });
}

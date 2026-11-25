/**
 * Resolve facet panel identities, positions, and strip labels. Layer slicing
 * happens separately before panel-local statistics and positions.
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
  warnings: PipelineWarning[] = [],
): FacetLayout {
  if (facet === undefined) return SINGLE_PANEL();
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
    strip,
    warnings,
  });
}

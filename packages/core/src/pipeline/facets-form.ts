/**
 * Facet form validation and free-scale flag derivation.
 */
import type { FacetSpec } from "@ggts-sh/spec";

import { PipelineError } from "./types.js";

export function facetFreeFlags(scales: FacetSpec["scales"] | undefined): {
  freeX: boolean;
  freeY: boolean;
} {
  const resolved = scales ?? "fixed";
  return {
    freeX: resolved === "free" || resolved === "free_x",
    freeY: resolved === "free" || resolved === "free_y",
  };
}

/** facet_grid `space` uses the same fixed/free/free_x/free_y vocabulary as `scales`. */
export function facetSpaceFlags(space: FacetSpec["space"] | undefined): {
  x: boolean;
  y: boolean;
} {
  const { freeX, freeY } = facetFreeFlags(space);
  return { x: freeX, y: freeY };
}

export function assertFacetForm(input: {
  wrapField: string | null;
  rowsField: string | null;
  colsField: string | null;
}): void {
  const { wrapField, rowsField, colsField } = input;
  if (wrapField !== null && (rowsField !== null || colsField !== null)) {
    throw new PipelineError(
      "facet-form-ambiguous",
      "/facet",
      "This facet mixes the wrap form (facet.wrap) with the grid form (facet.rows/facet.cols). Use wrap OR rows/cols, never both.",
    );
  }
  if (wrapField === null && rowsField === null && colsField === null) {
    throw new PipelineError(
      "facet-form-missing",
      "/facet",
      "This facet sets neither wrap nor rows/cols — there is no field to partition panels by.",
    );
  }
}

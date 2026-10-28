/**
 * Build panel placements for facet grids or a single panel.
 */
import type { LayoutAxisPresentation } from "../layout/layout.js";

import type { FacetPanelDef } from "./facets.js";
import type { PanelLayoutChrome } from "./panel-layout-chrome.js";
import { placeFacetPanelsFromChrome } from "./panel-layout-facet.js";
import { placeSinglePanelFromChrome } from "./panel-layout-single.js";
import type { FacetSpaceFlags, PanelPlacement } from "./panel-layout-types.js";
import type { RunOptions } from "./types.js";

export function buildPanelPlacements(input: {
  faceted: boolean;
  nrow: number;
  ncol: number;
  facetPanels: readonly FacetPanelDef[];
  strip: import("./facets-types.js").FacetStripConfig;
  stripBand: number;
  chrome: PanelLayoutChrome;
  space: FacetSpaceFlags;
  axis: Readonly<{ x: LayoutAxisPresentation; y: LayoutAxisPresentation }>;
  options: Pick<RunOptions, "width">;
}): PanelPlacement[] {
  const { faceted, nrow, ncol, facetPanels, strip, stripBand, chrome, space, axis, options } =
    input;
  if (faceted) {
    return placeFacetPanelsFromChrome({
      nrow,
      ncol,
      facetPanels,
      strip,
      stripBand,
      chrome,
      space,
      axis,
      options,
    });
  }
  return [placeSinglePanelFromChrome(chrome, axis, options)];
}

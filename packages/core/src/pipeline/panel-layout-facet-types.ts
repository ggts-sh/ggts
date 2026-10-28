/**
 * Shared input type for facet grid geometry + placement orchestration.
 */
import type { LayoutAxisPresentation, LayoutTheme, TickFormatter } from "../layout/layout.js";
import type { TextMeasurer } from "../layout/measure.js";

import type { FacetPanelDef } from "./facets.js";
import type { FacetStripConfig } from "./facets-types.js";
import type { DisplayBandFn, DisplayScalesFn, DisplayTemporalFn } from "./panel-layout-types.js";

/** Fields shared by computeFacetGridGeometry and placeFacetPanels. */
export interface FacetGridLayoutInput {
  facetPanels: readonly FacetPanelDef[];
  nrow: number;
  ncol: number;
  freeH: boolean;
  freeV: boolean;
  /** Display-space facet_grid `space` flags: column widths / row heights follow scale length. */
  spaceH: boolean;
  spaceV: boolean;
  outerLeftTitle: string;
  outerBottomTitle: string;
  axisTitleBand: number;
  legendWidth: number;
  legendBottomHeight: number;
  optionsWidth: number;
  layoutHeight: number;
  topBand: number;
  stripBand: number;
  stripConfig: FacetStripConfig;
  displayScales: DisplayScalesFn;
  displayTemporal: DisplayTemporalFn;
  displayBand: DisplayBandFn;
  hBreaks: readonly (number | string)[] | undefined;
  vBreaks: readonly (number | string)[] | undefined;
  formatH: TickFormatter | undefined;
  formatV: TickFormatter | undefined;
  measurer: TextMeasurer;
  layoutTheme: LayoutTheme;
  axis: Readonly<{ x: LayoutAxisPresentation; y: LayoutAxisPresentation }>;
}

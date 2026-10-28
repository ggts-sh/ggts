/**
 * Shared panel layout result types.
 */
import type {
  BandLayoutDomainContext,
  LayoutResult,
  TemporalLayoutDomainContext,
  TickFormatter,
} from "../layout/layout.js";
import type { AxisGuidePlan } from "../layout/temporal-guide.js";
import type { PositionScale } from "../scales/train.js";
import { buildLegends } from "../legend.js";

import type { AxisGuideAppearance } from "./guide-config.js";

/** Owned free-scale flags for facet position scales (derived once at facet resolve). */
export type FacetScaleFreedom = {
  readonly freeX: boolean;
  readonly freeY: boolean;
};

/** Data-space facet_grid `space` flags (all false for "fixed" or no facet). */
export type FacetSpaceFlags = {
  readonly x: boolean;
  readonly y: boolean;
};

export interface PanelPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  ticksH: LayoutResult["x"]["ticks"];
  ticksV: LayoutResult["y"]["ticks"];
  hGuidePlan?: AxisGuidePlan;
  vGuidePlan?: AxisGuidePlan;
  showAxisX: boolean;
  showAxisY: boolean;
  /** Original panel allocation before a fixed-aspect data rectangle is fitted. */
  allocation?: { x: number; y: number; width: number; height: number };
}

/**
 * Result of `layoutPanels`: placements, chrome, and axis guides resolved once.
 * Scene assembly reads `guides` rather than calling resolveAxisGuide again.
 */
export interface PanelLayoutResult {
  placements: PanelPlacement[];
  title: string;
  subtitle: string;
  caption: string;
  hTitle: string;
  vTitle: string;
  xTitle: string;
  yTitle: string;
  topBand: number;
  bottomBand: number;
  formatX: TickFormatter | undefined;
  formatY: TickFormatter | undefined;
  /** Display-space formatters (already flipped when coord_flip is on). */
  formatters: { readonly h: TickFormatter | undefined; readonly v: TickFormatter | undefined };
  /** Display-space free flags (already flipped when coord_flip is on). */
  freeH: boolean;
  freeV: boolean;
  /** Resolved once in layout; scene assembly must not re-resolve. */
  guides: { readonly h: AxisGuideAppearance; readonly v: AxisGuideAppearance };
  displayScales: (p: number) => { h: PositionScale; v: PositionScale };
  legendBlock: ReturnType<typeof buildLegends>;
  guidePlans: readonly AxisGuidePlan[];
  degraded: boolean;
  /** Facet strip chrome resolved for this layout (defaults when unfaceted). */
  strip: import("./facets-types.js").FacetStripConfig;
  /** Measured strip band size in px (0 when hidden / unfaceted). */
  stripBand: number;
}

export type DisplayScalesFn = (p: number) => { h: PositionScale; v: PositionScale };
export type DisplayTemporalFn = (p: number) => {
  h?: TemporalLayoutDomainContext;
  v?: TemporalLayoutDomainContext;
};
export type DisplayBandFn = (p: number) => {
  h?: BandLayoutDomainContext;
  v?: BandLayoutDomainContext;
};

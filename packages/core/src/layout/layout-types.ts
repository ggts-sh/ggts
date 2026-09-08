/**
 * Shared types and theme defaults for the bounded two-pass layout.
 *
 * Kept free of tick derivation and margin measurement so consumers can import
 * Domain / Margins / TickFormatter without pulling planner algorithms.
 */
import type { PositionScaleSpec, TemporalScaleKind } from "@ggts-sh/spec";

import type { CellValue } from "../table.js";
import type { TextMeasurer } from "./measure.js";
import type { AxisGuidePlan } from "./temporal-guide.js";

export type Domain =
  | {
      type: "linear";
      /** Pre-stat transform: numeric tick/grid/format dispatch keys from this. */
      transform?: "identity" | "log10" | "sqrt";
      min: number;
      max: number;
      breaks?: readonly number[];
    }
  | {
      type: "time";
      min: number;
      max: number;
      breaks?: readonly number[];
      temporal?: TemporalLayoutDomainContext;
    }
  | {
      type: "band";
      categories: string[];
      rawCategories?: readonly unknown[];
      breaks?: readonly (number | string)[];
      /** Present ⇒ this band axis gets the measured label planner (horizontal only). */
      band?: BandLayoutDomainContext;
    };

export interface TemporalLayoutDomainContext {
  aesthetic: "x" | "y";
  panelIndex: number;
  kind: TemporalScaleKind;
  config: PositionScaleSpec;
  sourceBreaks?: readonly CellValue[];
}

export interface BandLayoutDomainContext {
  /** Data aesthetic (flip-corrected) — used for the guide-plan id and diagnostic path. */
  aesthetic: "x" | "y";
  panelIndex: number;
  config: PositionScaleSpec;
}

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Tick {
  value: number | string;
  label: string;
  fullLabel?: string;
  kind?: "major" | "minor";
  /** Typed band-domain position; avoids indexing filtered/reordered breaks. */
  domainIndex?: number;
  /** false when band-label thinning hides this tick's label. */
  labeled: boolean;
  /**
   * Multi-line label: mode "wrapped" (horizontal) or wrap-then-rotate
   * (mode "rotated" + angle + lines).
   */
  lines?: string[];
  /** Rotation in degrees (band axis, mode "rotated"): 0 | -45 | -90. */
  angle?: number;
}

export interface AxisResult {
  ticks: Tick[];
  guidePlan?: AxisGuidePlan;
  /** band thinning: only every n-th tick keeps its label. 1 = all. */
  labelEvery: number;
  truncated: boolean;
}

/** Custom formatter: value plus the tick step (NaN for band axes). */
export type TickFormatter = (value: number | string, step: number) => string;

export interface LayoutTheme {
  /** Tick label font size in px. */
  fontSize: number;
  /** Pass-A margin priors. */
  marginPriors: Margins;
  /** Margin floors (axis line + breathing room even with no labels). */
  minMargins: Margins;
  tickLength: number;
  tickLabelGap: number;
  /** Per-side cap as a fraction of the plot dimension on that side's axis. */
  maxMarginFraction: number;
  targetPxPerTickX: number;
  targetPxPerTickY: number;
  maxTicks: number;
  /** Margin quantization grid in px (0 disables). */
  quantum: number;
  ellipsis: string;
}

export const DEFAULT_LAYOUT_THEME: LayoutTheme = {
  fontSize: 11,
  marginPriors: { top: 8, right: 12, bottom: 28, left: 44 },
  minMargins: { top: 4, right: 4, bottom: 16, left: 12 },
  tickLength: 6,
  tickLabelGap: 3,
  maxMarginFraction: 0.35,
  targetPxPerTickX: 80,
  targetPxPerTickY: 40,
  maxTicks: 10,
  quantum: 4,
  ellipsis: "…",
};

export interface LayoutAxisPresentation {
  visible: boolean;
  showTicks: boolean;
  showLabels: boolean;
  collision: "auto" | "preserve" | "ellipsis";
}

export interface LayoutInput {
  width: number;
  height: number;
  x: Domain;
  y: Domain;
  formatX?: TickFormatter;
  formatY?: TickFormatter;
  measurer: TextMeasurer;
  theme?: Partial<LayoutTheme>;
  /** Axis presentation that affects measured chrome but never semantic tick plans. */
  axis?: Readonly<{ x?: LayoutAxisPresentation; y?: LayoutAxisPresentation }>;
  /**
   * Extra per-side space consumed by non-tick content (axis titles, legends),
   * folded INTO the two-pass measurement loop: reserved space shrinks the
   * panel, which re-derives tick counts — no post-layout margin hacks
   * (fixes the M0c follow-up in decision 0007).
   */
  reserve?: Partial<Margins>;
  /** @internal Pass-A temporal plans used as monotonic Pass-B hints. */
  previousGuidePlans?: Readonly<{ x?: AxisGuidePlan; y?: AxisGuidePlan }>;
}

export interface PassResult {
  margins: Margins;
  x: AxisResult;
  y: AxisResult;
  degradations: string[];
}

export interface LayoutResult extends PassResult {
  innerWidth: number;
  innerHeight: number;
  converged: boolean;
  passes: 2;
  passAMargins: Margins;
}

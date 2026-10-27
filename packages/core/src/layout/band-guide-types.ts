/**
 * Band axis guide plan types — shared by the planner and guide-plan contracts.
 */
import type { GuideDegradedCode } from "./guide-degraded-codes.js";
import type { TextMeasurer } from "./measure.js";

export type BandLabelMode = "single-line" | "wrapped" | "rotated";

/**
 * Author override for band (categorical) axis label layout — from
 * `scales.*.guide` / `scale*Discrete({ guide })`. Mirrors ggplot2's
 * `guide_axis(angle=)` / discrete label wrap for pixel-stable output.
 */
export type BandGuideConfig = {
  /** Default "auto" escalates single → wrap → rotate → truncate. */
  mode?: "auto" | "single" | "wrap" | "rotate" | "off";
  /** Degrees when mode is "rotate", or when auto escalates to rotation. */
  angle?: number;
  /** Max wrap lines (default 2) when wrapping. */
  wrap?: number;
};

/** A pre-resolved band tick to lay out (break-matching already applied). */
interface BandPlanEntry {
  value: string | number;
  label: string;
  domainIndex: number;
}

export interface BandAxisPlanInput {
  aesthetic: "x" | "y";
  panelIndex: number;
  /** Total number of bands (band width = extentPx / categoryCount). */
  categoryCount: number;
  /** Ticks to lay out, in display order, already break-filtered. */
  entries: readonly BandPlanEntry[];
  /** Both orientations are planned; vertical axes use the single-line ladder. */
  orient: "horizontal" | "vertical";
  extentPx: number;
  reverse: boolean;
  measurer: TextMeasurer;
  fontSize: number;
  /** Cap for along-axis overhang past either end tick. */
  marginCapPx: number;
  /** Cap for the orthogonal label band (bottom for x, left for y). */
  orthogonalMarginCapPx: number;
  /** Margin quantum; fitness budgets are floored to it so mode is A→B stable. */
  quantum?: number;
  ellipsis?: string;
  /** Pass-A mode; the planner escalates only, never de-escalates. */
  previousMode?: BandLabelMode | null;
  /**
   * Optional author `scales.*.guide` pin. When set (and mode ≠ "auto"), the
   * planner does not auto-escalate away from the pinned presentation.
   */
  config?: BandGuideConfig;
}

export interface BandAxisPlanTick {
  value: string | number;
  label: string;
  fullLabel: string;
  labeled: boolean;
  domainIndex: number;
  /**
   * Multi-line layout: mode `"wrapped"` (horizontal stack) or mode `"rotated"`
   * with wrap-then-rotate (lines rotated at `angle`, ≤2 by default).
   */
  lines?: string[];
  /** Rotation in degrees (present when mode === "rotated"). */
  angle?: number;
}

export interface BandAxisPlan {
  mode: BandLabelMode;
  /** 0 | -45 | -90 (or a clamped author pin in −90..0). */
  angle: number;
  ticks: BandAxisPlanTick[];
  /** 1 = every category labeled; >1 = high-cardinality thinning. */
  labelEvery: number;
  /** Orthogonal label extent required (bottom height or left width), px. */
  labelBandHeight: number;
  /** Along-axis overhang past the end-edge tick, px. */
  alongOverhang: number;
  /** Along-axis overhang past the start-edge tick, px. */
  leftOverhang: number;
  overlap: boolean;
  marginOverflow: boolean;
  degraded: GuideDegradedCode[];
  /**
   * True when `scales.*.guide.mode` forced the presentation (not auto).
   * Suppresses heuristic wrap/rotate advisories that would re-suggest the pin.
   */
  authorPinned?: boolean;
}

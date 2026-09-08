/**
 * Public guide-plan contracts for axes and non-position color/fill legends.
 *
 * Behavior (planning algorithms) lives in temporal-guide.ts and color/legend
 * pipeline modules; this file is pure data shapes only.
 */
import type { StyleAesthetic, TemporalScaleKind } from "@ggts-sh/spec";

import type { CellValue } from "../table.js";
import type { BandLabelMode } from "./band-guide-types.js";
import type { GuideDegradedCode } from "./guide-degraded-codes.js";

export interface AxisGuideTick {
  value: number | CellValue;
  label: string;
  fullLabel: string;
  kind: "major" | "minor";
}

export interface AxisGuidePlan {
  type: "axis";
  id: string;
  aesthetic: "x" | "y";
  panelIndex: number;
  scaleType: "linear" | "time" | "band";
  /** Pre-stat numeric transform; time/band plans use identity. */
  transform: "identity" | "log10" | "sqrt";
  temporalKind: TemporalScaleKind | null;
  domain: readonly [number, number] | readonly CellValue[];
  direction: "ascending" | "descending";
  source: "automatic" | "interval" | "explicit";
  interval: string | null;
  locale: string | null;
  timezone: string | null;
  ticks: readonly AxisGuideTick[];
  sourceBreaks?: readonly CellValue[];
  overlap: boolean;
  marginOverflow: boolean;
  degraded: readonly GuideDegradedCode[];
  /** Band label layout (measured horizontal band axes only). */
  bandLabelMode?: BandLabelMode;
  /** Band rotation in degrees (auto chooses −45/−90; authors may pin any finite angle). */
  bandLabelAngle?: number;
  /** Measured orthogonal (bottom) band height the labels require, px. */
  bandLabelBandHeight?: number;
  /**
   * True when the author forced `scales.*.guide.mode` (not auto). Heuristic
   * wrap/rotate advisories should be suppressed for these plans.
   */
  bandLabelAuthorPinned?: boolean;
}

export interface DiscreteGuideEntry {
  value: CellValue;
  label: string;
  color?: string;
  size?: number;
  linewidth?: number;
  alpha?: number;
  shape?: string;
  linetype?: string;
}

export interface DiscreteGuidePlan {
  type: "discrete";
  id: string;
  aesthetic: "color" | "fill" | StyleAesthetic;
  scaleType: "sequential" | "ordinal" | "binned" | "manual" | "identity";
  title: string;
  domain: readonly CellValue[];
  entries: readonly DiscreteGuideEntry[];
  naValue: string | number;
  unknownValue: string | number;
}

export interface ColorbarGuideTick {
  value: number;
  label: string;
  fullLabel: string;
}

export interface ColorbarGuidePlan {
  type: "colorbar";
  id: string;
  aesthetic: "color" | "fill";
  title: string;
  domain: readonly [number, number];
  transformedDomain: readonly [number, number];
  transform: "identity" | "log10" | "sqrt";
  temporalKind: TemporalScaleKind | null;
  direction: "ascending" | "descending";
  ticks: readonly ColorbarGuideTick[];
  stops: readonly (readonly [number, string])[];
  naValue: string;
  unknownValue: string;
}

export interface ColorstepsGuideStep {
  lower: number;
  upper: number;
  lowerInclusive: true;
  upperInclusive: boolean;
  label: string;
  color: string;
}

export interface ColorstepsGuidePlan {
  type: "colorsteps";
  id: string;
  aesthetic: "color" | "fill";
  title: string;
  domain: readonly [number, number];
  transformedDomain: readonly [number, number];
  transform: "identity" | "log10" | "sqrt";
  temporalKind: TemporalScaleKind | null;
  direction: "ascending" | "descending";
  steps: readonly ColorstepsGuideStep[];
  naValue: string;
  unknownValue: string;
}

export type GuidePlan = AxisGuidePlan | DiscreteGuidePlan | ColorbarGuidePlan | ColorstepsGuidePlan;

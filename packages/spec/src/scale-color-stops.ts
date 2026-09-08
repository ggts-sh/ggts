/**
 * Multi-stop color/fill scale constructors: gradient* (#826 continuous) and
 * steps* (#827 binned). Share default hexes and stop-range resolvers so the
 * two families stay one edit surface.
 */
import type { Scales } from "./schema.js";
import {
  colorScale,
  type BinnedColorScaleOptions,
  type SequentialColorScaleOptions,
} from "./scale-color-helpers.js";

// Shared stop defaults (navy→sky continuous; red–light–blue diverging).
const STOP_DEFAULT_LOW = "#132B43";
const STOP_DEFAULT_HIGH = "#56B1F7";
/** ggts diverging defaults (red–light–blue); not claimed as ggplot2 muted(). */
const STOP2_DEFAULT_LOW = "#B2182B";
const STOP2_DEFAULT_MID = "#F7F7F7";
const STOP2_DEFAULT_HIGH = "#2166AC";

/** ggplot2-shaped two-stop continuous colour (default navy → sky). */
export type GradientScaleOptions = Omit<SequentialColorScaleOptions, "scheme" | "range"> & {
  low?: string;
  high?: string;
};

/**
 * Diverging three-stop continuous colour.
 * v1: mid is the center stop of `range` only — no asymmetric domain remapping
 * (ggplot2 `midpoint` deferred; not accepted so it cannot silently no-op).
 */
export type Gradient2ScaleOptions = Omit<SequentialColorScaleOptions, "scheme" | "range"> & {
  low?: string;
  mid?: string;
  high?: string;
};

/** N-stop continuous colour; requires ≥2 hex stops via colours/colors/values. */
export type GradientnScaleOptions = Omit<SequentialColorScaleOptions, "scheme" | "range"> & {
  colours?: readonly string[];
  colors?: readonly string[];
  values?: readonly string[];
};

/** Two-stop stepped continuous colour (default navy → sky). */
export type StepsScaleOptions = Omit<BinnedColorScaleOptions, "scheme" | "range"> & {
  low?: string;
  high?: string;
};

/**
 * Three-stop stepped diverging colour.
 * v1: no `midpoint` param (asymmetric domain remapping deferred).
 */
export type Steps2ScaleOptions = Omit<BinnedColorScaleOptions, "scheme" | "range"> & {
  low?: string;
  mid?: string;
  high?: string;
};

/** N-stop stepped colour; requires ≥2 hex stops via colours/colors/values. */
export type StepsnScaleOptions = Omit<BinnedColorScaleOptions, "scheme" | "range"> & {
  colours?: readonly string[];
  colors?: readonly string[];
  values?: readonly string[];
};

type TwoStopOptions = { low?: string; high?: string };
type ThreeStopOptions = { low?: string; mid?: string; high?: string };
type NStopOptions = {
  colours?: readonly string[];
  colors?: readonly string[];
  values?: readonly string[];
};

function twoStopRange<T extends TwoStopOptions>(
  options: T,
): Omit<T, "low" | "high"> & { range: string[] } {
  const { low = STOP_DEFAULT_LOW, high = STOP_DEFAULT_HIGH, ...rest } = options;
  return { ...rest, range: [low, high] };
}

function threeStopRange<T extends ThreeStopOptions>(
  options: T,
): Omit<T, "low" | "mid" | "high"> & { range: string[] } {
  const {
    low = STOP2_DEFAULT_LOW,
    mid = STOP2_DEFAULT_MID,
    high = STOP2_DEFAULT_HIGH,
    ...rest
  } = options;
  return { ...rest, range: [low, mid, high] };
}

function nStopRange<T extends NStopOptions>(
  options: T,
  helperLabel: string,
): Omit<T, "colours" | "colors" | "values"> & { range: string[] } {
  const { colours, colors, values, ...rest } = options;
  const stops = colours ?? colors ?? values;
  if (stops === undefined || stops.length < 2) {
    throw new Error(
      `${helperLabel} requires colours/colors/values with at least 2 #rgb/#rrggbb stops.`,
    );
  }
  return { ...rest, range: [...stops] };
}

// --- gradient / gradient2 / gradientn (#826) --------------------------------

export function scaleColorGradient(options: GradientScaleOptions = {}): Scales {
  return colorScale("color", "sequential", twoStopRange(options));
}
export function scaleColorGradient2(options: Gradient2ScaleOptions = {}): Scales {
  return colorScale("color", "sequential", threeStopRange(options));
}
export function scaleColorGradientn(options: GradientnScaleOptions = {}): Scales {
  return colorScale("color", "sequential", nStopRange(options, "scale_*_gradientn"));
}

export function scaleFillGradient(options: GradientScaleOptions = {}): Scales {
  return colorScale("fill", "sequential", twoStopRange(options));
}
export function scaleFillGradient2(options: Gradient2ScaleOptions = {}): Scales {
  return colorScale("fill", "sequential", threeStopRange(options));
}
export function scaleFillGradientn(options: GradientnScaleOptions = {}): Scales {
  return colorScale("fill", "sequential", nStopRange(options, "scale_*_gradientn"));
}

export const scaleColourGradient = scaleColorGradient;
export const scaleColourGradient2 = scaleColorGradient2;
export const scaleColourGradientn = scaleColorGradientn;
export const scale_color_gradient = scaleColorGradient;
export const scale_color_gradient2 = scaleColorGradient2;
export const scale_color_gradientn = scaleColorGradientn;
export const scale_colour_gradient = scaleColorGradient;
export const scale_colour_gradient2 = scaleColorGradient2;
export const scale_colour_gradientn = scaleColorGradientn;
export const scale_fill_gradient = scaleFillGradient;
export const scale_fill_gradient2 = scaleFillGradient2;
export const scale_fill_gradientn = scaleFillGradientn;

// --- steps / steps2 / stepsn (#827) ----------------------------------------

export function scaleColorSteps(options: StepsScaleOptions = {}): Scales {
  return colorScale("color", "binned", twoStopRange(options));
}
export function scaleColorSteps2(options: Steps2ScaleOptions = {}): Scales {
  return colorScale("color", "binned", threeStopRange(options));
}
export function scaleColorStepsn(options: StepsnScaleOptions = {}): Scales {
  return colorScale("color", "binned", nStopRange(options, "scale_*_stepsn"));
}

export function scaleFillSteps(options: StepsScaleOptions = {}): Scales {
  return colorScale("fill", "binned", twoStopRange(options));
}
export function scaleFillSteps2(options: Steps2ScaleOptions = {}): Scales {
  return colorScale("fill", "binned", threeStopRange(options));
}
export function scaleFillStepsn(options: StepsnScaleOptions = {}): Scales {
  return colorScale("fill", "binned", nStopRange(options, "scale_*_stepsn"));
}

export const scaleColourSteps = scaleColorSteps;
export const scaleColourSteps2 = scaleColorSteps2;
export const scaleColourStepsn = scaleColorStepsn;
export const scale_color_steps = scaleColorSteps;
export const scale_color_steps2 = scaleColorSteps2;
export const scale_color_stepsn = scaleColorStepsn;
export const scale_colour_steps = scaleColorSteps;
export const scale_colour_steps2 = scaleColorSteps2;
export const scale_colour_stepsn = scaleColorStepsn;
export const scale_fill_steps = scaleFillSteps;
export const scale_fill_steps2 = scaleFillSteps2;
export const scale_fill_stepsn = scaleFillStepsn;

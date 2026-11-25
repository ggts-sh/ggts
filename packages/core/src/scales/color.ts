/**
 * Continuous (sequential) color scales for quantitative color/fill mappings.
 *
 * The default ramp is a small viridis-like table (10 stops sampled from the
 * viridis colormap — decision 0008: a lookup table with piecewise-linear sRGB
 * interpolation, no d3-scale-chromatic dependency; perceptual uniformity is
 * inherited from the sampled stops, not re-derived).
 *
 * Per-point sampling uses a dense trained LUT (#1423): 1024 steps so t=0.5
 * lands on an exact table entry (same `rampColor` rounding as continuous
 * midpoints). Per-point cost is one clamp + index lookup after t is known.
 */
import { normalizeColor } from "./normalize-color.js";
import { padDegenerateDomain, resolveMissingColors } from "./engine.js";
import { scaleTransform } from "./transform.js";
import { VIRIDIS_RAMP_10 } from "./viridis-ramp.js";

/** Normalize #rgb / #rrggbb color stops to lowercase #rrggbb. */
export { normalizeColor } from "./normalize-color.js";

/** 10 stops sampled evenly from the viridis colormap (dark -> bright). */
export { VIRIDIS_RAMP_10 } from "./viridis-ramp.js";

/**
 * Number of intervals in the trained sequential LUT (entries = steps + 1).
 * Power-of-two steps keep t=0.5 on an exact sample so fixture midpoints
 * match continuous `rampColor` (e.g. black↔white → #808080).
 */
export const RAMP_LUT_STEPS = 1024;

function hexChannel(hex: string, i: number): number {
  return Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
}

const to2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");

/** Map value onto [lower, upper) so the period endpoints share one colour. */
export function wrapIntoPeriod(value: number, lower: number, upper: number): number {
  const period = upper - lower;
  if (period === 0) return lower;
  let offset = (value - lower) % period;
  if (offset < 0) offset += period;
  return lower + offset;
}

/**
 * Piecewise-linear interpolation over evenly spaced #rrggbb stops.
 * t is clamped to [0, 1]; output is a deterministic lowercase #rrggbb.
 */
export function rampColor(stops: readonly string[], t: number): string {
  const n = stops.length;
  if (n === 1) return stops[0]!;
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (n - 1);
  const i = Math.min(n - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  let out = "#";
  for (let c = 0; c < 3; c++) {
    out += to2(hexChannel(a, c) + (hexChannel(b, c) - hexChannel(a, c)) * f);
  }
  return out;
}

/**
 * Dense ramp LUT: entry i stores `rampColor(stops, i / steps)`.
 * Lookup quantizes t via `Math.round(t * steps)`.
 */
export function buildRampLut(
  stops: readonly string[],
  steps: number = RAMP_LUT_STEPS,
): readonly string[] {
  if (steps < 1) throw new RangeError(`Ramp LUT steps must be ≥ 1 (got ${String(steps)}).`);
  if (stops.length === 0) throw new RangeError("Ramp LUT needs at least one color stop.");
  if (stops.length === 1) {
    return Object.freeze(Array.from({ length: steps + 1 }, () => stops[0]!));
  }
  const lut = Array.from<string>({ length: steps + 1 });
  for (let i = 0; i <= steps; i++) {
    lut[i] = rampColor(stops, i / steps);
  }
  return Object.freeze(lut);
}

/** Quantized LUT sample for t ∈ [0, 1] (clamped). */
export function sampleRampLut(lut: readonly string[], t: number): string {
  const steps = lut.length - 1;
  if (steps <= 0) return lut[0]!;
  const clamped = Math.min(1, Math.max(0, t));
  return lut[Math.round(clamped * steps)]!;
}

export interface SequentialColorScale {
  type: "sequential";
  /** Semantic/source-space domain [min, max] (epoch ms for temporal values). */
  domain: [number, number];
  /** Transform-space affine domain used to interpolate the ramp. */
  transformedDomain: [number, number];
  transform: "identity" | "log10" | "sqrt";
  reverse: boolean;
  /** Resolved ramp stops (post-reverse). */
  stops: readonly string[];
  naValue: string;
  unknownValue: string;
  /** Color for a semantic value, including explicit NA/OOB fallbacks. */
  colorOf(value: unknown): string | undefined;
  /** Color at a normalized ramp position t in [0, 1] (legend gradients). */
  at(t: number): string;
  /** True when the numeric domain contains semantic epoch milliseconds. */
  temporal?: boolean;
  temporalKind?: "date" | "datetime"; // color ramps never use time-of-day kind
  /** Explicit semantic guide breaks, when authored. */
  guideBreaks?: readonly number[];
}

export interface SequentialConfig {
  /** Explicit [min, max]; wins over the data extent. */
  domain?: [number, number];
  /** Explicit ramp stops (#rgb or #rrggbb; normalized before interpolation). */
  range?: readonly string[];
  reverse?: boolean;
  transform?: "identity" | "log10" | "sqrt";
  oob?: "censor" | "squish" | "wrap";
  naValue?: string;
  unknownValue?: string;
}

let lastRampKey: string | undefined;
let lastRamp: readonly string[];

/**
 * Train a sequential color scale over a data extent. Zero-variance domains
 * pad symmetrically (matching the positional-scale failure policy).
 */
export function trainSequential(
  extent: [number, number] | null,
  config: SequentialConfig = {},
): SequentialColorScale {
  let [min, max] = config.domain ?? extent ?? [0, 1];
  [min, max] = padDegenerateDomain(min, max);
  const transform = config.transform ?? "identity";
  const scaleTx = scaleTransform(transform);
  const forward = (value: number): number =>
    scaleTx.valid(value) ? scaleTx.forward(value) : Number.NaN;
  const transformedMin = forward(min);
  const transformedMax = forward(max);
  if (!Number.isFinite(transformedMin) || !Number.isFinite(transformedMax)) {
    throw new RangeError(
      `Sequential color domain [${String(min)}, ${String(max)}] is invalid for ${transform}.`,
    );
  }
  const base = (config.range ?? VIRIDIS_RAMP_10).map((stop) => normalizeColor(stop));
  const stops = config.reverse === true ? base.toReversed() : [...base];
  const span = transformedMax - transformedMin;
  // Trained dense LUT: per-point color is one index lookup after t (#1423).
  // Distinguish an empty range from a single omitted stop.
  const rampKey = stops.length + stops.join();
  if (rampKey !== lastRampKey) {
    lastRamp = buildRampLut(stops);
    lastRampKey = rampKey;
  }
  const lut = lastRamp;
  const at = (t: number) => sampleRampLut(lut, t);
  const { naValue, unknownValue } = resolveMissingColors(config);
  return {
    type: "sequential",
    domain: [min, max],
    transformedDomain: [transformedMin, transformedMax],
    transform,
    reverse: config.reverse === true,
    stops,
    naValue,
    unknownValue,
    at,
    colorOf(value: unknown): string | undefined {
      if (value === null || value === undefined) {
        return config.naValue === undefined ? undefined : naValue;
      }
      let semantic =
        typeof value === "number" ? value : value instanceof Date ? value.getTime() : Number.NaN;
      if (!Number.isFinite(semantic)) {
        return config.unknownValue === undefined ? undefined : unknownValue;
      }
      const lower = Math.min(min, max);
      const upper = Math.max(min, max);
      if (config.oob === "wrap") {
        semantic = wrapIntoPeriod(semantic, lower, upper);
      } else if (semantic < lower || semantic > upper) {
        if (config.oob !== "squish") {
          return config.unknownValue === undefined ? undefined : unknownValue;
        }
        semantic = Math.min(upper, Math.max(lower, semantic));
      }
      const transformed = forward(semantic);
      if (!Number.isFinite(transformed)) {
        return config.unknownValue === undefined ? undefined : unknownValue;
      }
      return at(span === 0 ? 0.5 : (transformed - transformedMin) / span);
    },
  };
}

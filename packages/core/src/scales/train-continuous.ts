/**
 * Continuous positional scale training (linear / log / time, config-aware).
 *
 * Config semantics:
 *  - `domain` PINS a scale (nice/zero ignored).
 *  - `nice` (default true) rounds continuous domains (time never niced).
 *  - `zero` extends the domain to include 0.
 *  - `reverse` flips normalize output.
 *  - log refuses non-positive domains (ScaleConfigError).
 */
import { tickStep } from "../layout/ticks.js";
import { padDegenerateDomain } from "./engine.js";
import { ScaleConfigError } from "./scale-error.js";
import type { ContinuousScale } from "./train-types.js";
import type { ScaleTransform } from "./transform.js";
import { scaleTransform } from "./transform.js";

/** d3-style nice: expand [min, max] to tick-step-aligned bounds. */
export function niceLinearDomain(min: number, max: number, count = 10): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    // Zero-variance domain: ggplot2-style symmetric padding.
    const [lo, hi] = padDegenerateDomain(min, max);
    return niceLinearDomain(lo, hi, count);
  }
  let lo = min;
  let hi = max;
  // Two rounds, like d3-scale's nice(): the step can change after widening.
  for (let i = 0; i < 2; i++) {
    const step = tickStep(lo, hi, count);
    if (!Number.isFinite(step) || step <= 0) break;
    lo = Math.floor(min / step) * step;
    hi = Math.ceil(max / step) * step;
  }
  return [lo, hi];
}

/** Finite extent of possibly-NaN numeric arrays. Returns null when empty. */
export function finiteExtent(arrays: readonly Float64Array[]): [number, number] | null {
  let min = Infinity;
  let max = -Infinity;
  for (const array of arrays) {
    for (let i = 0; i < array.length; i++) {
      const v = array[i]!;
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return min > max ? null : [min, max];
}

/** Display expansion split per end, applied in transformed space. */
interface TransformedExpansion {
  lowerMult: number;
  upperMult: number;
  lowerAdd: number;
  upperAdd: number;
}

const NO_EXPANSION: TransformedExpansion = { lowerMult: 0, upperMult: 0, lowerAdd: 0, upperAdd: 0 };

export interface ContinuousConfig {
  type?: "linear" | "time";
  /** Pre-stat transform (default identity). Time forces identity. */
  transform?: ScaleTransform;
  /** Explicit [min, max] SEMANTIC domain (epoch ms for time) — PINS the scale. */
  domain?: [number, number];
  nice?: boolean;
  zero?: boolean;
  reverse?: boolean;
  /** Display expansion in transformed space (default: none). */
  expansion?: TransformedExpansion;
}

export interface ContinuousTraining {
  scale: ContinuousScale;
  /** True when no finite data trained the scale. */
  empty: boolean;
  /** Retained for the warning channel; transform-domain drops are counted
   *  pre-stat by the column transform, so the trainer reports 0. */
  nonPositive: number;
}

/**
 * Train a continuous positional scale in TRANSFORMED space. `arrays` are the
 * post-stat transformed (scale-space) evidence: the affine domain is trained
 * over them, nice/zero apply in transformed space, expansion pads after nice,
 * and the public semantic `domain` is the inverse-projection of the expanded
 * transformed endpoints. `normalize` forwards a semantic value before the
 * affine map; `normalizeTransformed` skips the forward (geometry uses it).
 */
export function trainContinuous(
  arrays: readonly Float64Array[],
  config: ContinuousConfig = {},
): ContinuousTraining {
  const type = config.type ?? "linear";
  const transform = config.transform ?? scaleTransform("identity");
  const reverse = config.reverse === true;
  const expansion = config.expansion ?? NO_EXPANSION;
  const pinned = config.domain !== undefined;
  const nice = config.nice !== false;

  const extent = pinned ? null : finiteExtent(arrays);
  let t0: number;
  let t1: number;
  if (pinned) {
    const [lo, hi] = config.domain!;
    if (!transform.valid(lo) || !transform.valid(hi)) {
      throw new ScaleConfigError(
        "scale-transform-domain",
        `A ${transform.key} scale's explicit domain must lie in the transform's valid range ` +
          `(got [${lo}, ${hi}]). Use values inside the domain, or a different transform.`,
      );
    }
    t0 = transform.forward(lo);
    t1 = transform.forward(hi);
  } else if (extent === null) {
    // Empty: a unit transformed window; inverse gives a sensible semantic span.
    t0 = 0;
    t1 = 1;
  } else {
    t0 = extent[0];
    t1 = extent[1];
    if (config.zero === true && transform.valid(0)) {
      const zeroT = transform.forward(0);
      t0 = Math.min(t0, zeroT);
      t1 = Math.max(t1, zeroT);
    }
    if (type === "time") {
      if (t0 === t1) {
        t0 -= 43_200_000;
        t1 += 43_200_000;
      }
    } else if (nice) {
      [t0, t1] = niceLinearDomain(t0, t1);
    } else {
      [t0, t1] = padDegenerateDomain(t0, t1);
    }
  }

  const evidenceTransformedDomain: [number, number] = pinned
    ? [transform.forward(config.domain![0]), transform.forward(config.domain![1])]
    : extent === null
      ? [t0, t1]
      : [extent[0], extent[1]];

  // Display expansion in transformed space (after nice; pinned domains too).
  const innerSpan = t1 - t0;
  const expandedLower = t0 - expansion.lowerMult * innerSpan - expansion.lowerAdd;
  // sqrt's transformed codomain starts at zero. Inverse-projecting negative
  // display padding would square it back into a positive semantic lower bound.
  const e0 = transform.key === "sqrt" ? Math.max(0, expandedLower) : expandedLower;
  const e1 = t1 + expansion.upperMult * innerSpan + expansion.upperAdd;
  const span = e1 - e0;
  const affine = (transformed: number): number => {
    const raw = span === 0 ? 0.5 : (transformed - e0) / span;
    return reverse ? 1 - raw : raw;
  };
  return {
    scale: {
      type,
      transform: transform.key,
      domain: [transform.inverse(e0), transform.inverse(e1)],
      transformedDomain: [e0, e1],
      evidenceTransformedDomain,
      normalize: (value: number) =>
        transform.valid(value) ? affine(transform.forward(value)) : Number.NaN,
      normalizeTransformed: (value: number) => affine(value),
      invert: (t: number) => {
        const a = reverse ? 1 - t : t;
        return transform.inverse(e0 + a * span);
      },
    },
    empty: extent === null && !pinned,
    nonPositive: 0,
  };
}

/** Backwards-compatible linear training (M0c signature). */
export function trainLinear(arrays: readonly Float64Array[]): {
  scale: ContinuousScale;
  empty: boolean;
} {
  const { scale, empty } = trainContinuous(arrays);
  return { scale, empty };
}

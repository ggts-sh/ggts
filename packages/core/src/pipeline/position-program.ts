/**
 * Effective position-scale program (PR 3).
 *
 * Resolves the pre-stat transform, source-limit OOB, NA replacement, and
 * display expansion for a continuous/binned position axis. Time and band
 * families are left untouched (identity, no pre-stat OOB, zero expansion) so
 * PR 1–2 temporal domains, GuidePlans, and screenshots never drift.
 *
 * The transform runs at the stat read sites (making frame arrays scale-space);
 * the affine trainer then unions those transformed arrays and expands in
 * transformed space. Source limits/domain values stay semantic for OOB and for
 * the public inverse-projected domain.
 */
import type { PositionScaleSpec, ScaleExpansion } from "@ggts-sh/spec";

import {
  getScaleTransform,
  scaleTransform,
  type ColumnTransformConfig,
  type ScaleTransform,
} from "../scales/transform.js";

import { positionValuesToNumeric, type PositionConversionContext } from "./temporal-position.js";

/** Resolved display expansion, split per end (transformed-space units). */
export interface ResolvedExpansion {
  lowerMult: number;
  upperMult: number;
  lowerAdd: number;
  upperAdd: number;
}

/** ggplot2 default: 5% multiplicative padding for non-temporal continuous. */
const DEFAULT_CONTINUOUS_EXPANSION: ResolvedExpansion = Object.freeze({
  lowerMult: 0.05,
  upperMult: 0.05,
  lowerAdd: 0,
  upperAdd: 0,
});

/** Time axes retain flush (zero) expansion to preserve PR 1–2 domains. */
const ZERO_EXPANSION: ResolvedExpansion = Object.freeze({
  lowerMult: 0,
  upperMult: 0,
  lowerAdd: 0,
  upperAdd: 0,
});

function pair(value: number | readonly number[] | undefined): [number, number] | null {
  if (value === undefined) return null;
  if (typeof value === "number") return [value, value];
  return [value[0]!, value[1]!];
}

/**
 * Resolve the display expansion for an axis. Non-temporal continuous/binned
 * axes default to { mult: 0.05, add: 0 }; time axes default to zero. Explicit
 * `expand` overrides; `{ mult: 0, add: 0 }` restores flush behavior.
 */
export function resolveScaleExpansion(
  expand: ScaleExpansion | undefined,
  isTime: boolean,
): ResolvedExpansion {
  const base = isTime ? ZERO_EXPANSION : DEFAULT_CONTINUOUS_EXPANSION;
  if (expand === undefined) return base;
  const mult = pair(expand.mult);
  const add = pair(expand.add);
  return {
    lowerMult: mult === null ? base.lowerMult : mult[0],
    upperMult: mult === null ? base.upperMult : mult[1],
    lowerAdd: add === null ? base.lowerAdd : add[0],
    upperAdd: add === null ? base.upperAdd : add[1],
  };
}

/** The pre-stat transform for an axis (identity for time; config-driven else). */
export function axisTransform(
  config: PositionScaleSpec | undefined,
  type: "linear" | "time",
): ScaleTransform {
  if (type === "time") return scaleTransform("identity");
  return getScaleTransform(config?.transform ?? "identity");
}

/** Semantic [lo, hi] source limits from an explicit domain, sorted ascending. */
function resolveSourceLimits(
  config: PositionScaleSpec | undefined,
  conversion: PositionConversionContext,
): [number, number] | null {
  if (config?.domain === undefined || config.domain.length < 2) return null;
  const { values } = positionValuesToNumeric(config.domain, conversion);
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < lo) lo = value;
    if (value > hi) hi = value;
  }
  return lo > hi ? null : [lo, hi];
}

/**
 * The pre-stat column transform config for a continuous/binned axis, or null
 * when no staging is needed (identity + unpinned + no NA, or a time/band axis)
 * so stat reads keep aliasing the parsed semantic arrays.
 */
export function resolveColumnTransform(
  config: PositionScaleSpec | undefined,
  conversion: PositionConversionContext,
): ColumnTransformConfig | null {
  if (config === undefined) return null;
  if (config.type === "band") return null;
  if (conversion.requestedTime || config.type === "time") return null;
  const transformName = config.transform ?? "identity";
  const oob = config.oob ?? "censor";
  const naValue = config.naValue ?? null;
  const sourceLimits = resolveSourceLimits(config, conversion);
  if (transformName === "identity" && sourceLimits === null && naValue === null) return null;
  return { transform: getScaleTransform(transformName), sourceLimits, oob, naValue };
}

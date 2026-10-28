/**
 * Scale canonicalization for normalize() — position type rewrites and color hex.
 * Coord: normalize-coord.ts. Layer/aes orchestration: normalize.ts.
 */

import { normalizeHexColor } from "./normalize-paint.js";
import type { ColorScaleSpec, PositionScaleSpec, Scales } from "./schema.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withGuide<T extends object>(scale: T): T {
  if (!("guide" in scale) || !isRecord(scale.guide)) return { ...scale };
  const guide = {
    ...scale.guide,
    ...(isRecord(scale.guide["theme"]) && { theme: { ...scale.guide["theme"] } }),
  };
  return { ...scale, guide };
}

function normalizeColorScale(scale: ColorScaleSpec): ColorScaleSpec {
  const fallbacks = {
    ...(scale.naValue !== undefined && { naValue: normalizeHexColor(scale.naValue) }),
    ...(scale.unknownValue !== undefined && {
      unknownValue: normalizeHexColor(scale.unknownValue),
    }),
  };
  if (scale.type === "identity") return { ...withGuide(scale), ...fallbacks };
  return {
    ...withGuide(scale),
    ...(Array.isArray(scale.range) && {
      range: scale.range.map((color) => normalizeHexColor(color)),
    }),
    ...fallbacks,
  };
}

function normalizePositionScale(scale: PositionScaleSpec): PositionScaleSpec {
  if (scale.type === "band") {
    const {
      temporalKind: _,
      parse: __,
      parseFailure: ___,
      timezone: ____,
      disambiguation: _____,
      dateBreaks: ______,
      dateMinorBreaks: _______,
      dateLabels: ________,
      locale: _________,
      weekStart: __________,
      ...band
    } = scale;
    return band;
  }
  // Canonical log10: an authored `type: "log"` (base-10) IS the linear family
  // with the log10 transform. A conflicting explicit transform (identity/sqrt)
  // is left uncanonicalized for pipeline preflight to reject as
  // scale-type-transform-conflict. Pure normalize never throws.
  if (scale.type === "log" && (scale.transform === undefined || scale.transform === "log10")) {
    return { ...scale, type: "linear", transform: "log10" };
  }
  // Binned is a quantitative position family; it never requests a time scale.
  // Contradictory temporal options are left for validate() to reject.
  if (scale.type === "binned") {
    return { ...scale };
  }
  const hasTemporalGuideOption =
    scale.dateBreaks !== undefined ||
    scale.dateMinorBreaks !== undefined ||
    scale.dateLabels !== undefined ||
    scale.locale !== undefined ||
    scale.weekStart !== undefined;
  if ((scale.type === "linear" || scale.type === "log") && hasTemporalGuideOption) {
    return { ...scale };
  }
  const requestsTime =
    scale.type === "time" ||
    scale.temporalKind !== undefined ||
    scale.parse !== undefined ||
    scale.parseFailure !== undefined ||
    scale.timezone !== undefined ||
    scale.disambiguation !== undefined ||
    hasTemporalGuideOption;
  return requestsTime ? { ...scale, type: "time" } : { ...scale };
}

export function normalizeScales(scales: Scales): Scales {
  return {
    ...(scales.x !== undefined && { x: withGuide(normalizePositionScale(scales.x)) }),
    ...(scales.y !== undefined && { y: withGuide(normalizePositionScale(scales.y)) }),
    ...(scales.color !== undefined && { color: normalizeColorScale(scales.color) }),
    ...(scales.fill !== undefined && { fill: normalizeColorScale(scales.fill) }),
    ...(scales.size !== undefined && { size: withGuide(scales.size) }),
    ...(scales.linewidth !== undefined && { linewidth: withGuide(scales.linewidth) }),
    ...(scales.alpha !== undefined && { alpha: withGuide(scales.alpha) }),
    ...(scales.shape !== undefined && { shape: withGuide(scales.shape) }),
    ...(scales.linetype !== undefined && { linetype: withGuide(scales.linetype) }),
  };
}

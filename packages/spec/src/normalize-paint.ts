/**
 * Canonicalize within-mark paint on layer params: hex → lowercase #rrggbb,
 * default gradient space → "mark". Pure; never throws.
 */
import type { ColorStop, GlowSpec, GradientPaint, LayerSpec } from "./schema.js";

export function normalizeHexColor(color: string): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (match === null) return color;
  const digits = match[1]!.toLowerCase();
  return digits.length === 3
    ? `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`
    : `#${digits}`;
}

function normalizeStop(stop: ColorStop): ColorStop {
  return {
    offset: stop.offset,
    color: normalizeHexColor(stop.color),
    ...(stop.opacity !== undefined && { opacity: stop.opacity }),
  };
}

function normalizeGradient(paint: GradientPaint): GradientPaint {
  const space = paint.space ?? "mark";
  if (paint.type === "linear") {
    return {
      type: "linear",
      x1: paint.x1,
      y1: paint.y1,
      x2: paint.x2,
      y2: paint.y2,
      space,
      stops: paint.stops.map(normalizeStop),
      fallback: normalizeHexColor(paint.fallback),
    };
  }
  return {
    type: "radial",
    cx: paint.cx,
    cy: paint.cy,
    r: paint.r,
    space,
    stops: paint.stops.map(normalizeStop),
    fallback: normalizeHexColor(paint.fallback),
  };
}

function normalizeGlow(glow: GlowSpec): GlowSpec {
  return {
    color: normalizeHexColor(glow.color),
    radius: glow.radius,
    opacity: glow.opacity,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGradientPaint(value: unknown): value is GradientPaint {
  if (!isRecord(value)) return false;
  return value["type"] === "linear" || value["type"] === "radial";
}

function isGlow(value: unknown): value is GlowSpec {
  if (!isRecord(value)) return false;
  return (
    typeof value["color"] === "string" &&
    typeof value["radius"] === "number" &&
    typeof value["opacity"] === "number"
  );
}

/** Normalize fillPaint / strokePaint / glow on a layer's params bag. */
export function normalizeLayerParamsPaint(
  params: NonNullable<LayerSpec["params"]>,
): NonNullable<LayerSpec["params"]> {
  const bag: Record<string, unknown> = { ...params };
  let changed = false;

  if (isGradientPaint(bag["fillPaint"])) {
    bag["fillPaint"] = normalizeGradient(bag["fillPaint"]);
    changed = true;
  }
  if (isGradientPaint(bag["strokePaint"])) {
    bag["strokePaint"] = normalizeGradient(bag["strokePaint"]);
    changed = true;
  }
  if (isGlow(bag["glow"])) {
    bag["glow"] = normalizeGlow(bag["glow"]);
    changed = true;
  }

  // Layer params is a geom-specific union; paint keys are optional extras on
  // the supported members. Spread preserves the original structural type.
  return changed ? { ...params, ...bag } : params;
}

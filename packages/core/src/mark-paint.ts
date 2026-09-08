/**
 * Within-mark paint resolution (#591): closed gradients + bounded glow with
 * stable resource ids (plot/layer/role — never randomness or process counters).
 *
 * Renderer-neutral mark style (shapes, dash, stroke-null) lives in mark-style.ts.
 *
 * `subpathBounds` is pure path AABB geometry with no paint dependency; it stays
 * here because both callers are paint sites (canvas gradient mark-space mapping).
 */
import type { GradientPaint, GlowSpec, PaintSpace } from "@ggts-sh/spec";

/** Resolved gradient ready for SVG/canvas paint. */
export interface ResolvedGradientPaint {
  kind: "linear" | "radial";
  space: PaintSpace;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
  r: number;
  stops: readonly { offset: number; color: string; opacity: number }[];
  fallback: string;
  /** Deterministic paint resource id. */
  id: string;
}

/** Resolved bounded glow. */
export interface ResolvedGlow {
  color: string;
  radius: number;
  opacity: number;
  /** Deterministic filter resource id. */
  id: string;
}

export type PaintRole = "fill" | "stroke" | "glow";

/** Stable resource id from layer (+ optional panel) and role. */
export function paintResourceId(layerIndex: number, role: PaintRole, panelIndex = 0): string {
  return `gg-paint-l${String(layerIndex)}-p${String(panelIndex)}-${role}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asGradient(value: unknown): GradientPaint | null {
  if (!isRecord(value)) return null;
  if (value["type"] !== "linear" && value["type"] !== "radial") return null;
  return value as GradientPaint;
}

function asGlow(value: unknown): GlowSpec | null {
  if (!isRecord(value)) return null;
  if (
    typeof value["color"] !== "string" ||
    typeof value["radius"] !== "number" ||
    typeof value["opacity"] !== "number"
  ) {
    return null;
  }
  return value as GlowSpec;
}

/** Read paint fields from a layer params bag (already schema-validated). */
export function layerPaintFromParams(params: unknown): {
  fillPaint: GradientPaint | null;
  strokePaint: GradientPaint | null;
  glow: GlowSpec | null;
} {
  if (!isRecord(params)) {
    return { fillPaint: null, strokePaint: null, glow: null };
  }
  return {
    fillPaint: asGradient(params["fillPaint"]),
    strokePaint: asGradient(params["strokePaint"]),
    glow: asGlow(params["glow"]),
  };
}

export function resolveGradientPaint(
  paint: GradientPaint,
  layerIndex: number,
  role: Exclude<PaintRole, "glow">,
  panelIndex = 0,
): ResolvedGradientPaint {
  const space: PaintSpace = paint.space ?? "mark";
  const stops = paint.stops.map((stop) => ({
    offset: stop.offset,
    color: stop.color,
    opacity: stop.opacity ?? 1,
  }));
  if (paint.type === "linear") {
    return {
      kind: "linear",
      space,
      x1: paint.x1,
      y1: paint.y1,
      x2: paint.x2,
      y2: paint.y2,
      cx: 0,
      cy: 0,
      r: 0,
      stops,
      fallback: paint.fallback,
      id: paintResourceId(layerIndex, role, panelIndex),
    };
  }
  return {
    kind: "radial",
    space,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    cx: paint.cx,
    cy: paint.cy,
    r: paint.r,
    stops,
    fallback: paint.fallback,
    id: paintResourceId(layerIndex, role, panelIndex),
  };
}

export function resolveGlow(glow: GlowSpec, layerIndex: number, panelIndex = 0): ResolvedGlow {
  return {
    color: glow.color,
    radius: glow.radius,
    opacity: glow.opacity,
    id: paintResourceId(layerIndex, "glow", panelIndex),
  };
}

/** Emit SVG gradient + glow filter defs for a paint set (deterministic order). */
export function paintDefsSvg(
  paints: readonly ResolvedGradientPaint[],
  glows: readonly ResolvedGlow[],
): string {
  const parts: string[] = [];
  for (const paint of paints) {
    const stops = paint.stops
      .map((stop) => {
        const opacity = stop.opacity === 1 ? "" : ` stop-opacity="${String(stop.opacity)}"`;
        return `<stop offset="${String(stop.offset)}" stop-color="${stop.color}"${opacity}/>`;
      })
      .join("");
    const units = paint.space === "mark" ? "objectBoundingBox" : "userSpaceOnUse";
    if (paint.kind === "linear") {
      parts.push(
        `<linearGradient id="${paint.id}" gradientUnits="${units}" x1="${String(paint.x1)}" y1="${String(paint.y1)}" x2="${String(paint.x2)}" y2="${String(paint.y2)}">${stops}</linearGradient>`,
      );
    } else {
      parts.push(
        `<radialGradient id="${paint.id}" gradientUnits="${units}" cx="${String(paint.cx)}" cy="${String(paint.cy)}" r="${String(paint.r)}">${stops}</radialGradient>`,
      );
    }
  }
  for (const glow of glows) {
    // Bound filter region to avoid pathological filter region growth; radius
    // is already schema-capped at MAX_GLOW_RADIUS (32).
    const pad = glow.radius * 3;
    parts.push(
      `<filter id="${glow.id}" x="-${String(pad)}" y="-${String(pad)}" width="${String(1 + pad * 2)}" height="${String(1 + pad * 2)}" filterUnits="objectBoundingBox" color-interpolation-filters="sRGB">` +
        `<feGaussianBlur in="SourceAlpha" stdDeviation="${String(glow.radius / 2)}" result="blur"/>` +
        `<feFlood flood-color="${glow.color}" flood-opacity="${String(glow.opacity)}" result="color"/>` +
        `<feComposite in="color" in2="blur" operator="in" result="glow"/>` +
        `<feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>` +
        `</filter>`,
    );
  }
  return parts.join("");
}

/** Canvas fill/stroke style from a resolved gradient (panel-local user space). */
export function canvasGradientStyle(
  ctx: CanvasRenderingContext2D,
  paint: ResolvedGradientPaint,
  bounds: { x: number; y: number; width: number; height: number },
): CanvasGradient | string {
  const mapX = (v: number) => (paint.space === "mark" ? bounds.x + v * bounds.width : v);
  const mapY = (v: number) => (paint.space === "mark" ? bounds.y + v * bounds.height : v);
  const mapR = (v: number) =>
    paint.space === "mark" ? v * Math.max(bounds.width, bounds.height) : v;

  let gradient: CanvasGradient;
  if (paint.kind === "linear") {
    gradient = ctx.createLinearGradient(
      mapX(paint.x1),
      mapY(paint.y1),
      mapX(paint.x2),
      mapY(paint.y2),
    );
  } else {
    gradient = ctx.createRadialGradient(
      mapX(paint.cx),
      mapY(paint.cy),
      0,
      mapX(paint.cx),
      mapY(paint.cy),
      Math.max(mapR(paint.r), 1e-6),
    );
  }
  for (const stop of paint.stops) {
    // Canvas addColorStop does not take opacity separately; bake into rgba when needed.
    if (stop.opacity < 1) {
      const hex = stop.color;
      const full =
        hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
      const r = Number.parseInt(full.slice(1, 3), 16);
      const g = Number.parseInt(full.slice(3, 5), 16);
      const b = Number.parseInt(full.slice(5, 7), 16);
      gradient.addColorStop(
        stop.offset,
        `rgba(${String(r)},${String(g)},${String(b)},${String(stop.opacity)})`,
      );
    } else {
      gradient.addColorStop(stop.offset, stop.color);
    }
  }
  return gradient;
}

/** Axis-aligned bounds of a path batch subpath (panel-local px). */
export function subpathBounds(
  positions: Float32Array,
  start: number,
  end: number,
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = start; i < end; i++) {
    const x = positions[i * 2]!;
    const y = positions[i * 2 + 1]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1e-6),
    height: Math.max(maxY - minY, 1e-6),
  };
}

/**
 * Renderer-neutral mark style resolution: one shape / dash / stroke-null table
 * shared by SVG, canvas, and Svelte serializers.
 *
 * Within-mark gradient/glow paint (#591) lives in mark-paint.ts.
 */
import { LINETYPE_NAMES, POINT_SHAPE_NAMES } from "@ggts-sh/spec";

import type { GlyphsBatch, PathsBatch, PointsBatch, RectsBatch, SegmentsBatch } from "./scene.js";
import { LINETYPE_DASHES, type Linetype, type PointShape } from "./scales/style.js";

/** Renderer-neutral point-shape geometry (one proportion table). */
export type PointShapeGeometry =
  | { kind: "circle"; mode: "fill"; cx: number; cy: number; r: number }
  | { kind: "circle"; mode: "stroke"; strokeWidth: number; cx: number; cy: number; r: number }
  | { kind: "rect"; mode: "fill"; x: number; y: number; width: number; height: number }
  | { kind: "polygon"; mode: "fill"; points: readonly (readonly [number, number])[] }
  | {
      kind: "lines";
      mode: "stroke";
      strokeWidth: number;
      segments: readonly (readonly [readonly [number, number], readonly [number, number]])[];
    };

/** Closed shape proportions shared by SVG, canvas, and Svelte serializers. */
export function pointShapeGeometry(
  shape: PointShape,
  x: number,
  y: number,
  size: number,
): PointShapeGeometry {
  switch (shape) {
    case "square":
      return {
        kind: "rect",
        mode: "fill",
        x: x - size,
        y: y - size,
        width: size * 2,
        height: size * 2,
      };
    case "triangle":
      return {
        kind: "polygon",
        mode: "fill",
        points: [
          [x, y - size * 1.2],
          [x + size * 1.1, y + size * 0.9],
          [x - size * 1.1, y + size * 0.9],
        ],
      };
    case "diamond":
      return {
        kind: "polygon",
        mode: "fill",
        points: [
          [x, y - size * 1.25],
          [x + size, y],
          [x, y + size * 1.25],
          [x - size, y],
        ],
      };
    case "plus":
      return {
        kind: "lines",
        mode: "stroke",
        strokeWidth: Math.max(1, size / 2),
        segments: [
          [
            [x - size, y],
            [x + size, y],
          ],
          [
            [x, y - size],
            [x, y + size],
          ],
        ],
      };
    case "cross": {
      const arm = size * 0.75;
      return {
        kind: "lines",
        mode: "stroke",
        strokeWidth: Math.max(1, size / 2),
        segments: [
          [
            [x - arm, y - arm],
            [x + arm, y + arm],
          ],
          [
            [x + arm, y - arm],
            [x - arm, y + arm],
          ],
        ],
      };
    }
    case "circle-open":
      // Unfilled ring (ggplot2 shape 1): stroke in the mark's color channel,
      // width proportional to size so small rings stay visible.
      return {
        kind: "circle",
        mode: "stroke",
        strokeWidth: Math.max(1, size / 3),
        cx: x,
        cy: y,
        r: size,
      };
    default:
      return { kind: "circle", mode: "fill", cx: x, cy: y, r: size };
  }
}

/** SVG path `d` for polygon/lines shapes (circle/rect keep dedicated elements). */
export function pointShapePathD(
  geometry: Extract<PointShapeGeometry, { kind: "polygon" | "lines" }>,
  format: (n: number) => string = String,
): string {
  if (geometry.kind === "polygon") {
    const [first, ...rest] = geometry.points;
    if (first === undefined) return "";
    const parts = [`M${format(first[0])} ${format(first[1])}`];
    for (const [px, py] of rest) parts.push(`L${format(px)} ${format(py)}`);
    parts.push("Z");
    return parts.join("");
  }
  return geometry.segments
    .map(([a, b]) => `M${format(a[0])} ${format(a[1])}L${format(b[0])} ${format(b[1])}`)
    .join("");
}

/** Dash array for a named linetype (empty = solid). */
export function linetypeDash(linetype: Linetype): readonly number[] {
  return LINETYPE_DASHES[LINETYPE_NAMES.indexOf(linetype)] ?? [];
}

/** Area outline is drawn only when stroke is concrete and linewidth > 0. */
export function areaOutlineActive(
  stroke: string | null | undefined,
  linewidth: number,
): stroke is string {
  return stroke !== null && stroke !== undefined && linewidth > 0;
}

export interface ResolvedPointMark {
  fill: string;
  alpha: number;
  size: number;
  shape: PointShape;
  geometry: PointShapeGeometry;
}

export interface ResolvedPathMark {
  fill: string;
  stroke: string;
  width: number;
  dash: readonly number[];
  alpha: number;
  linecap: "butt" | "round" | "square";
  linejoin: "miter" | "round" | "bevel";
}

function linetypeAt(
  batch: { linetype?: Linetype; linetypeIndexes?: Uint8Array },
  index: number,
): Linetype {
  return batch.linetypeIndexes === undefined
    ? (batch.linetype ?? "solid")
    : LINETYPE_NAMES[batch.linetypeIndexes[index]!]!;
}

/** Resolve linetype for batch index `i` (constant or per-mark indexes). */
export function markLinetype(
  batch: { linetype?: Linetype; linetypeIndexes?: Uint8Array },
  index: number,
): Linetype {
  return linetypeAt(batch, index);
}

/** Resolve one point mark's fill from palette indexes, string[], or constant. */
export function pointFillAt(batch: PointsBatch, index: number, themeInk: string): string {
  const palette = batch.colorPalette;
  const indexes = batch.colorIndexes;
  if (palette !== undefined && indexes !== undefined) {
    return palette[indexes[index]!] ?? batch.fill ?? themeInk;
  }
  return batch.colors?.[index] ?? batch.fill ?? themeInk;
}

/** Expand per-mark fills (palette indexes or string[]). */
export function pointFills(batch: PointsBatch, themeInk = ""): string[] {
  const n = batch.rowIndex.length;
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(pointFillAt(batch, i, themeInk));
  return out;
}

/** Resolve one point mark's fill/shape/alpha for any serializer. */
export function resolvePointMark(
  batch: PointsBatch,
  index: number,
  themeInk: string,
): ResolvedPointMark {
  const size = batch.sizes?.[index] ?? batch.size;
  const shape =
    batch.shapeIndexes === undefined ? batch.shape : POINT_SHAPE_NAMES[batch.shapeIndexes[index]!]!;
  return {
    fill: pointFillAt(batch, index, themeInk),
    alpha: batch.alphas?.[index] ?? 1,
    size,
    shape,
    geometry: pointShapeGeometry(
      shape,
      batch.positions[index * 2]!,
      batch.positions[index * 2 + 1]!,
      size,
    ),
  };
}

export interface ResolvedRectMark {
  fill: string;
  /** Outline color; undefined = no outline (bars/cols — decision 0008 note 7). */
  stroke: string | undefined;
  strokeWidth: number;
  dash: readonly number[];
  alpha: number;
}

/** Resolve one rect's fill/outline/dash for any serializer. */
export function resolveRectMark(
  batch: RectsBatch,
  index: number,
  theme: { accent: string; paper: string; ink: string },
): ResolvedRectMark {
  const roleFill = batch.fillRole === "paper" ? theme.paper : theme.accent;
  const stroke =
    batch.strokes?.[index] ??
    (batch.stroke === undefined && batch.strokes === undefined
      ? undefined
      : (batch.stroke ?? theme.ink));
  return {
    fill: batch.fills?.[index] ?? batch.fill ?? roleFill,
    stroke,
    strokeWidth: batch.strokeWidths?.[index] ?? batch.strokeWidth ?? 1,
    dash: linetypeDash(linetypeAt(batch, index)),
    alpha: batch.alphas?.[index] ?? 1,
  };
}

export interface ResolvedSegmentMark {
  stroke: string;
  width: number;
  dash: readonly number[];
  alpha: number;
  /** Present only when the batch opts in (segment geom); undefined leaves
   *  renderer defaults (SVG/Svelte omit the attribute; canvas ctx default). */
  linecap: "butt" | "round" | "square" | undefined;
}

/**
 * Stroke color alone — the hot-loop subset of resolveSegmentMark. Canvas
 * run-length collapsing compares this per segment; the full resolver would
 * pay an object allocation plus a dash-table lookup per comparison.
 */
export function segmentStrokeAt(batch: SegmentsBatch, index: number, themeInk: string): string {
  return batch.strokes?.[index] ?? batch.stroke ?? themeInk;
}

/** Resolve one segment's stroke/dash for any serializer. */
export function resolveSegmentMark(
  batch: SegmentsBatch,
  index: number,
  themeInk: string,
): ResolvedSegmentMark {
  return {
    stroke: segmentStrokeAt(batch, index, themeInk),
    width: batch.linewidths?.[index] ?? batch.linewidth,
    dash: linetypeDash(linetypeAt(batch, index)),
    alpha: batch.alphas?.[index] ?? 1,
    linecap: batch.linecap,
  };
}

export interface ResolvedGlyphMark {
  fill: string;
  size: number;
  alpha: number;
}

/** Resolve one glyph's fill/size for any serializer (label box chrome stays
 *  with the SVG emitter — canvas glyphs are deliberate no-ops). */
export function resolveGlyphMark(
  batch: GlyphsBatch,
  index: number,
  themeInk: string,
): ResolvedGlyphMark {
  return {
    fill: batch.colors?.[index] ?? batch.color ?? themeInk,
    size: batch.sizes?.[index] ?? batch.size,
    alpha: batch.alphas?.[index] ?? 1,
  };
}

/** Resolve one path/area subpath's stroke/fill/dash for any serializer. */
export function resolvePathMark(
  batch: PathsBatch,
  index: number,
  theme: { ink: string; accent: string },
): ResolvedPathMark {
  const isArea = batch.fills !== undefined;
  const linewidth = batch.linewidths?.[index] ?? batch.linewidth;
  const strokeColor = batch.strokes[index];
  const dash = linetypeDash(linetypeAt(batch, index));
  const alpha = batch.alphas?.[index] ?? 1;
  const linecap = batch.linecap ?? "round";
  const linejoin = batch.linejoin ?? "round";
  if (isArea) {
    return {
      fill: batch.fills![index] ?? batch.fillPaint?.fallback ?? theme.accent,
      stroke: areaOutlineActive(strokeColor, linewidth) ? strokeColor : "none",
      width: linewidth,
      dash,
      alpha,
      linecap,
      linejoin,
    };
  }
  return {
    fill: "none",
    stroke: strokeColor ?? batch.strokePaint?.fallback ?? theme.ink,
    width: linewidth,
    dash,
    alpha,
    linecap,
    linejoin,
  };
}

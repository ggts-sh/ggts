import type { ResolvedCandidateInspectMode } from "./candidate-store-types.js";
import { POINT_SHAPE_NAMES } from "@ggts-sh/spec";

import type { GeometryBatch, PointsBatch } from "./scene.js";
import { ringCuts } from "./ring-cuts.js";

/**
 * Geometry-array topology for candidate indexes / hit refine:
 * - rects / segments: packed float arrays
 * - points / glyphs / paths: vertices (`positions.length / 2`)
 *
 * Distinct from {@link renderPrimitiveCount} (paint/focus marks) and
 * {@link candidatePrimitiveCount} (inspectable anchors).
 */
export function primitiveCount(batch: GeometryBatch): number {
  if (batch.kind === "rects") return batch.rects.length / 4;
  if (batch.kind === "segments") return batch.segments.length / 4;
  return batch.positions.length / 2;
}

/**
 * Paint / focus / mark-threshold address space (one count for canvas focus,
 * interaction masks, SVG mark totals, and backend auto threshold).
 * Paths count **subpaths**, not tessellated vertices.
 */
export function renderPrimitiveCount(batch: GeometryBatch): number {
  switch (batch.kind) {
    case "points":
    case "glyphs":
      return batch.rowIndex.length;
    case "paths":
      return Math.max(0, batch.pathOffsets.length - 1);
    case "rects":
      return batch.rects.length / 4;
    case "segments":
      return batch.segments.length / 4;
    default:
      return 0;
  }
}

export function isCandidatePrimitive(batch: GeometryBatch, primitiveIndex: number): boolean {
  if (batch.kind === "paths" && batch.candidates === false) return false;
  return batch.kind !== "paths" || batch.semanticAnchors?.[primitiveIndex] !== 0;
}

export function candidatePrimitiveCount(batch: GeometryBatch): number {
  if (batch.kind === "paths" && batch.candidates === false) return 0;
  if (batch.kind !== "paths" || batch.semanticAnchors === undefined) return primitiveCount(batch);
  let count = 0;
  for (const anchor of batch.semanticAnchors) if (anchor !== 0) count++;
  return count;
}

export function localAnchor(batch: GeometryBatch, i: number): readonly [number, number] {
  if (batch.kind === "rects") {
    const x = batch.rects[i * 4]! + batch.rects[i * 4 + 2]! / 2;
    const yTop = batch.rects[i * 4 + 1]!;
    const h = batch.rects[i * 4 + 3]!;
    return batch.anchor === "center" ? [x, yTop + h / 2] : [x, yTop];
  }
  if (batch.kind === "segments")
    return batch.anchorPositions === undefined
      ? [
          (batch.segments[i * 4]! + batch.segments[i * 4 + 2]!) / 2,
          (batch.segments[i * 4 + 1]! + batch.segments[i * 4 + 3]!) / 2,
        ]
      : [batch.anchorPositions[i * 2]!, batch.anchorPositions[i * 2 + 1]!];
  return [batch.positions[i * 2]!, batch.positions[i * 2 + 1]!];
}

export function defaultAutoMode(batch: GeometryBatch, i: number): ResolvedCandidateInspectMode {
  if (batch.kind === "rects") return "exact";
  if (batch.kind === "paths") return "x";
  if (batch.kind === "segments") {
    const dx = Math.abs(batch.segments[i * 4 + 2]! - batch.segments[i * 4]!);
    const dy = Math.abs(batch.segments[i * 4 + 3]! - batch.segments[i * 4 + 1]!);
    return dx <= dy ? "x" : "y";
  }
  // Glyphs / points: ring-only exact hit (#754). Full crosshair (`xy`) is opt-in.
  return "exact";
}

export function segmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1,
    dy = y2 - y1,
    length2 = dx * dx + dy * dy;
  const t =
    length2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length2));
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}

export function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  loX: number,
  loY: number,
  hiX: number,
  hiY: number,
): boolean {
  let enter = 0;
  let exit = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (const [p, q] of [
    [-dx, x1 - loX],
    [dx, hiX - x1],
    [-dy, y1 - loY],
    [dy, hiY - y1],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const ratio = q / p;
    if (p < 0) enter = Math.max(enter, ratio);
    else exit = Math.min(exit, ratio);
    if (enter > exit) return false;
  }
  return true;
}

/** Conservative shape-aware point hit distance, or null outside the symbol bounds. */
export function pointHitDistance(
  batch: PointsBatch,
  primitive: number,
  dx: number,
  dy: number,
  hitTolerance: number,
): number | null {
  const size = batch.sizes?.[primitive] ?? batch.size;
  const shape =
    batch.shapeIndexes === undefined
      ? batch.shape
      : POINT_SHAPE_NAMES[batch.shapeIndexes[primitive]!]!;
  if (shape === "circle" || shape === "circle-open") {
    const distance = Math.hypot(dx, dy);
    return distance <= size + hitTolerance ? distance : null;
  }
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const inside =
    shape === "triangle"
      ? ax <= size * 1.1 + hitTolerance && ay <= size * 1.2 + hitTolerance
      : shape === "diamond"
        ? ax + ay * 0.8 <= size + hitTolerance
        : shape === "plus"
          ? ax <= size * 1.25 + hitTolerance && ay <= size * 1.25 + hitTolerance
          : ax <= size + hitTolerance && ay <= size + hitTolerance;
  return inside ? Math.hypot(dx, dy) : null;
}

/**
 * Subpath index in `pathOffsets` for a vertex (0 .. subpathCount-1), or null.
 * Binary search on monotonic half-open spans — O(log P) vs linear O(P).
 * Fractional vertices allowed; zero-length spans never match.
 */
export function pathSubpathIndex(offsets: ArrayLike<number>, vertex: number): number | null {
  if (offsets.length < 2) return null;
  let low = 0;
  let high = offsets.length - 2;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const start = offsets[mid]!;
    const end = offsets[mid + 1]!;
    if (vertex < start) high = mid - 1;
    else if (vertex >= end) low = mid + 1;
    else return mid;
  }
  return null;
}

/**
 * Half-open subpath range [start, end) containing `vertex`, or null.
 * Binary search on monotonic pathOffsets — O(log P) vs linear O(P).
 * Preserves the linear-scan contract: fractional vertices are allowed;
 * zero-length spans never match.
 */
export function pathRange(
  batch: Extract<GeometryBatch, { kind: "paths" }>,
  vertex: number,
): readonly [number, number] | null {
  const offsets = batch.pathOffsets;
  const mid = pathSubpathIndex(offsets, vertex);
  if (mid === null) return null;
  return [offsets[mid]!, offsets[mid + 1]!] as const;
}

/** Render-vertex span between the nearest semantic anchors around `vertex`.
 * Returns inclusive endpoints [previousAnchor, nextAnchor]. */
export function pathSemanticNeighborRange(
  batch: Extract<GeometryBatch, { kind: "paths" }>,
  vertex: number,
): readonly [number, number] | null {
  const range = pathRange(batch, vertex);
  if (range === null) return null;
  if (batch.semanticAnchors === undefined) {
    return [Math.max(range[0], vertex - 1), Math.min(range[1] - 1, vertex + 1)];
  }
  let previous = vertex - 1;
  while (previous >= range[0] && batch.semanticAnchors[previous] === 0) previous--;
  if (previous < range[0]) previous = vertex;
  let next = vertex + 1;
  while (next < range[1] && batch.semanticAnchors[next] === 0) next++;
  if (next >= range[1]) next = vertex;
  return [previous, next];
}

// Nearest-nav (orthogonal group pick + directional panel traversal) lives in
// candidate-geometry-nearest.ts (#534). Re-export for existing import sites.
export {
  closestOrthInRange,
  directionalNearestInOrder,
  panelRangeInOrder,
} from "./candidate-geometry-nearest.js";

/**
 * Half-open ring spans within a path subpath [start, end), split on
 * {@link PathsBatch.ringStarts} (hole rings). Always includes [start, end) when
 * no interior breaks fall in range.
 */
function pathRingRanges(
  batch: Extract<GeometryBatch, { kind: "paths" }>,
  start: number,
  end: number,
): readonly (readonly [number, number])[] {
  if (end <= start) return [];
  const breaks = batch.ringStarts;
  if (breaks === undefined || breaks.length === 0) return [[start, end]];
  const cuts = ringCuts(breaks, start, end);
  const ranges: (readonly [number, number])[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i]!;
    const b = cuts[i + 1]!;
    if (b > a) ranges.push([a, b]);
  }
  return ranges;
}

function insideRing(
  batch: Extract<GeometryBatch, { kind: "paths" }>,
  start: number,
  end: number,
  x: number,
  y: number,
): boolean {
  let inside = false;
  for (let i = start, j = end - 1; i < end; j = i++) {
    const xi = batch.positions[i * 2]!;
    const yi = batch.positions[i * 2 + 1]!;
    const xj = batch.positions[j * 2]!;
    const yj = batch.positions[j * 2 + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Point-in-filled-path. Multi-ring subpaths (polygon holes) use even-odd across
 * rings; single-ring subpaths keep the classic even-odd edge toggle (equivalent
 * to nonzero for simple non-self-intersecting polygons).
 */
export function insidePath(
  batch: Extract<GeometryBatch, { kind: "paths" }>,
  start: number,
  end: number,
  x: number,
  y: number,
): boolean {
  const rings = pathRingRanges(batch, start, end);
  if (rings.length <= 1) {
    return insideRing(batch, start, end, x, y);
  }
  // Even-odd compound: each ring toggles membership (GeoJSON holes).
  let inside = false;
  for (const [rs, re] of rings) {
    if (insideRing(batch, rs, re, x, y)) inside = !inside;
  }
  return inside;
}

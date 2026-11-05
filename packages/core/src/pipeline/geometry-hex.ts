/**
 * Hex polygon geometry: one closed PathsBatch subpath per hex cell.
 */
import type { PathsBatch } from "../scene.js";

import { hexVertices } from "../stats/bin-hex.js";
import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import {
  constantStyle,
  numericStyleVector,
  paintVector,
  type ResolvedStyleScales,
} from "./geometry-style.js";

/**
 * Cut a convex polygon (flat x,y pairs) to the unit square. Each pass keeps the
 * points on the inner side of one edge and adds a point where the outline
 * crosses it; the added point takes the edge value exactly. Returns null when
 * no area is left (the cell lies outside, or touches the panel at an edge or
 * corner only).
 */
function cutToUnitSquare(poly: readonly number[]): number[] | null {
  let pts = poly;
  for (let axis = 0; axis < 2; axis++) {
    for (let bound = 0; bound < 2; bound++) {
      const inside = (v: number): boolean => (bound === 0 ? v >= 0 : v <= 1);
      const out: number[] = [];
      for (let i = 0; i < pts.length; i += 2) {
        const j = (i + pts.length - 2) % pts.length;
        const a = pts[j + axis]!;
        const b = pts[i + axis]!;
        if (inside(a) !== inside(b)) {
          const t = (bound - a) / (b - a);
          const crossing = [
            pts[j]! + t * (pts[i]! - pts[j]!),
            pts[j + 1]! + t * (pts[i + 1]! - pts[j + 1]!),
          ];
          crossing[axis] = bound;
          out.push(crossing[0]!, crossing[1]!);
        }
        if (inside(b)) out.push(pts[i]!, pts[i + 1]!);
      }
      pts = out;
    }
  }
  // Drop repeats (a corner on the edge) and keep only a polygon with area.
  const kept: number[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const n = kept.length;
    if (n === 0 || kept[n - 2] !== pts[i] || kept[n - 1] !== pts[i + 1]) {
      kept.push(pts[i]!, pts[i + 1]!);
    }
  }
  if (kept.length > 2 && kept[0] === kept.at(-2) && kept[1] === kept.at(-1)) kept.length -= 2;
  let area = 0;
  for (let i = 0; i < kept.length; i += 2) {
    const k = (i + 2) % kept.length;
    area += kept[i]! * kept[k + 1]! - kept[k]! * kept[i + 1]!;
  }
  // Rounding can leave a sliver when a cell only touches the panel; drop it.
  return kept.length >= 6 && Math.abs(area) > 1e-9 ? kept : null;
}

/**
 * Unit-space vertices of one cell, cut to the panel when it clips and a corner
 * leaves it. Pointy-top: width = √3 · size, height = 2 · size, so rx = width/√3
 * and ry = height/2 are the center-to-vertex radii. Null drops the cell.
 */
function cellVertices(
  fx: Frame,
  project: { x: (v: number) => number; y: (v: number) => number },
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): number[] | null {
  const unit: number[] = [];
  let leaves = false;
  for (const [dx, dy] of hexVertices(cx, cy, rx, ry)) {
    const tx = project.x(dx);
    const ty = project.y(dy);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;
    if (tx < 0 || tx > 1 || ty < 0 || ty > 1) leaves = true;
    unit.push(tx, ty);
  }
  return fx.clip === true && leaves ? cutToUnitSquare(unit) : unit;
}

function emittedNoHexes(cursor: number, subpaths: number): boolean {
  return cursor === 0 || subpaths === 0;
}

/**
 * Project one data-space hex into panel-local vertices.
 * Uses frame x/y centers and hexWidth/hexHeight (data units) from bin_hex.
 */
export function hexBatch(
  frame: LayerFrame,
  fx: Frame,
  fill: ResolvedColorScale | null,
  color: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): PathsBatch | null {
  const { binding, n } = frame;
  if (n === 0) return null;
  if (fx.xScale.type === "band" || fx.yScale.type === "band") {
    warnings.push({
      code: "hex-band-scale",
      message: `Layer ${binding.index} (hex): continuous x and y scales are required; band scales are skipped.`,
    });
    return null;
  }

  const widths = frame.hexWidth;
  const heights = frame.hexHeight;
  if (widths === null || heights === null || frame.xNumeric === null || frame.yNumeric === null) {
    warnings.push({
      code: "hex-missing-size",
      message: `Layer ${binding.index} (hex): missing hex width/height from bin_hex stat.`,
    });
    return null;
  }

  // Narrowed above: both scales are continuous here.
  const { xScale, yScale } = fx;
  const project = {
    x: (v: number) => xScale.normalizeTransformed(v),
    y: (v: number) => yScale.normalizeTransformed(v),
  };
  // A cut cell gains at most four vertices (one per panel edge).
  const clip = fx.clip === true;
  const totalVerts = n * (clip ? 10 : 6);
  const positions = new Float32Array(totalVerts * 2);
  const rowIndex = new Uint32Array(totalVerts);
  // One frame-row id per vertex so hover/tooltip maps each hex to its cell,
  // not the ribbon/band reconstruction fallback (same as polygonBatch; #916).
  const closedFrameRows = new Uint32Array(totalVerts);
  const pathOffsets = new Uint32Array(n + 1);
  const keptRows = new Uint32Array(n);
  let cursor = 0;
  let subpaths = 0;
  for (let row = 0; row < n; row++) {
    pathOffsets[subpaths] = cursor;
    const cx = frame.xNumeric[row]!;
    const cy = frame.yNumeric[row]!;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;

    const w = widths[row]!;
    const h = heights[row]!;
    const verts = cellVertices(fx, project, cx, cy, w / Math.sqrt(3), h / 2);
    if (verts === null) continue;
    for (let i = 0; i < verts.length; i += 2) {
      positions[cursor * 2] = verts[i]! * fx.innerWidth;
      positions[cursor * 2 + 1] = fx.innerHeight - verts[i + 1]! * fx.innerHeight;
      rowIndex[cursor] = frame.rowIndex[row]!;
      closedFrameRows[cursor] = row;
      cursor++;
    }
    keptRows[subpaths] = row;
    subpaths++;
  }
  pathOffsets[subpaths] = cursor;

  if (emittedNoHexes(cursor, subpaths)) return null;

  const params = (binding.layer.params ?? {}) as { alpha?: number; linewidth?: number };
  // Style vectors must index by kept subpath order (not raw frame rows): dropped
  // centers / non-finite projected vertices leave gaps that would misalign alpha
  // and linewidth with the emitted shapes (same pattern as edge-rects keptRows).
  const styleRows = keptRows.subarray(0, subpaths);
  const fills = paintVector(frame, "fill", fill, styleRows);
  const strokes = paintVector(frame, "color", color, styleRows);
  const alphas = numericStyleVector(frame, "alpha", styleRows, styles);
  const linewidths = numericStyleVector(frame, "linewidth", styleRows, styles);

  return {
    kind: "paths",
    layerIndex: binding.index,
    panelIndex: 0,
    positions: positions.subarray(0, cursor * 2).slice(),
    rowIndex: rowIndex.subarray(0, cursor).slice(),
    pathOffsets: pathOffsets.subarray(0, subpaths + 1).slice(),
    strokes,
    fills,
    closed: true,
    closedFrameRows: closedFrameRows.subarray(0, cursor).slice(),
    linewidth: constantStyle(binding, params, "linewidth", 0),
    ...(linewidths !== undefined && { linewidths }),
    alpha: alphas === undefined ? constantStyle(binding, params, "alpha", 1) : 1,
    ...(alphas !== undefined && { alphas }),
    curve: "linear",
  };
}

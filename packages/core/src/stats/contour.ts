/**
 * The contour stat (ggplot2's stat_contour isolines; #801 v1).
 *
 * Clean-room marching-squares isolines over a regular x×y grid. No R/C++ code.
 *
 * Contract:
 *  - required: continuous x, y, z; complete rectangular grid per group
 *    (every unique x × unique y present exactly once with finite z preferred)
 *  - levels: params.breaks, else evenly spaced bins from min..max (inclusive)
 *  - outputs one open polyline vertex stream per (group × level × piece)
 *  - after_stat: level (numeric contour value)
 *  - incomplete grids: incomplete cells skipped (missing/NaN corners)
 *  - contour_filled deferred
 */
import type { CellValue } from "../table.js";
import { indexCellsByLevel, type ContourGrid } from "./contour-grid-index.js";

export interface ContourParamsInput {
  bins?: number | undefined;
  breaks?: readonly number[] | undefined;
  binwidth?: number | undefined;
}

export interface ContourStatInput {
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  groups: readonly number[];
  carried?: Readonly<Record<string, readonly CellValue[]>>;
  params?: ContourParamsInput;
}

export interface ContourStatResult {
  x: Float64Array;
  y: Float64Array;
  level: Float64Array;
  groups: number[];
  /** Piece id within (group, level) for multi-component isolines. */
  piece: number[];
  carried: Record<string, CellValue[]>;
  dropped: number;
  droppedGroups: number;
}

type Pt = { x: number; y: number };

function uniqueSorted(values: Float64Array): number[] {
  // Number.isFinite already drops non-finite samples; no separate mask needed.
  const set = new Set<number>();
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (Number.isFinite(v)) set.add(v);
  }
  return [...set].toSorted((a, b) => a - b);
}

/** Resolve contour levels from breaks / bins / binwidth. */
export function contourLevels(zmin: number, zmax: number, params: ContourParamsInput): number[] {
  if (params.breaks !== undefined && params.breaks.length > 0) {
    return params.breaks.filter((v) => Number.isFinite(v)).toSorted((a, b) => a - b);
  }
  if (!(zmax > zmin)) return [];
  if (params.binwidth !== undefined && params.binwidth > 0) {
    const w = params.binwidth;
    const start = Math.ceil(zmin / w) * w;
    const levels: number[] = [];
    for (let v = start; v <= zmax + w * 1e-12; v += w) {
      if (v >= zmin - 1e-12 && v <= zmax + 1e-12) levels.push(v);
    }
    return levels;
  }
  const bins = params.bins ?? 10;
  if (bins < 1) return [];
  if (bins === 1) return [(zmin + zmax) / 2];
  const levels: number[] = [];
  for (let i = 0; i < bins; i++) {
    levels.push(zmin + ((zmax - zmin) * i) / (bins - 1));
  }
  return levels;
}

function edgeInterp(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  level: number,
): Pt {
  const d = bz - az;
  const t = Math.abs(d) < 1e-15 ? 0.5 : (level - az) / d;
  const u = Math.min(1, Math.max(0, t));
  return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u };
}

function cellMask(values: readonly number[], level: number): number {
  if (!values.every((value) => Number.isFinite(value)) || !Number.isFinite(level)) return -1;
  let mask = 0;
  if (values[0]! >= level) mask |= 1;
  if (values[1]! >= level) mask |= 2;
  if (values[3]! >= level) mask |= 4;
  if (values[2]! >= level) mask |= 8;
  return mask;
}

/** Emit 0–2 undirected segments for one cell at one level (marching squares). */
export function cellSegments(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z00: number,
  z10: number,
  z01: number,
  z11: number,
  level: number,
): Array<[Pt, Pt]> {
  // Bitmask: corner ≥ level. corners: 0=SW, 1=SE, 2=NE, 3=NW
  const mask = cellMask([z00, z10, z01, z11], level);
  if (mask < 0) return [];
  if (mask === 0 || mask === 15) return [];

  const bottom = () => edgeInterp(x0, y0, z00, x1, y0, z10, level);
  const right = () => edgeInterp(x1, y0, z10, x1, y1, z11, level);
  const top = () => edgeInterp(x0, y1, z01, x1, y1, z11, level);
  const left = () => edgeInterp(x0, y0, z00, x0, y1, z01, level);

  // Standard MS cases (pair opposite edges; saddle uses average).
  switch (mask) {
    case 1:
    case 14:
      return [[bottom(), left()]];
    case 2:
    case 13:
      return [[bottom(), right()]];
    case 3:
    case 12:
      return [[left(), right()]];
    case 4:
    case 11:
      return [[right(), top()]];
    case 5: {
      // saddle
      const avg = (z00 + z10 + z01 + z11) / 4;
      return avg >= level
        ? [
            [bottom(), right()],
            [left(), top()],
          ]
        : [
            [bottom(), left()],
            [right(), top()],
          ];
    }
    case 6:
    case 9:
      return [[bottom(), top()]];
    case 7:
    case 8:
      return [[left(), top()]];
    case 10: {
      const avg = (z00 + z10 + z01 + z11) / 4;
      return avg >= level
        ? [
            [bottom(), left()],
            [right(), top()],
          ]
        : [
            [bottom(), right()],
            [left(), top()],
          ];
    }
    default:
      return [];
  }
}

function keyPt(p: Pt): string {
  // Round to avoid float join failures.
  return `${p.x.toFixed(9)},${p.y.toFixed(9)}`;
}

/** Marching-squares segments for every complete cell on a regular grid. */
function gridCellSegments(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  grid: ContourGrid,
  level: number,
): Array<[Pt, Pt]> {
  const segs: Array<[Pt, Pt]> = [];
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      const z00 = grid[j]![i];
      const z10 = grid[j]![i + 1];
      const z01 = grid[j + 1]![i];
      const z11 = grid[j + 1]![i + 1];
      // Inner index can be undefined when a row is short; skip incomplete cells.
      if (
        z00 === null ||
        z00 === undefined ||
        z10 === null ||
        z10 === undefined ||
        z01 === null ||
        z01 === undefined ||
        z11 === null ||
        z11 === undefined
      ) {
        continue;
      }
      segs.push(...cellSegments(xs[i]!, xs[i + 1]!, ys[j]!, ys[j + 1]!, z00, z10, z01, z11, level));
    }
  }
  return segs;
}

/** Stitch undirected segments into polylines (open or closed). O(E) total. */
export function stitchSegments(segments: Array<[Pt, Pt]>): Pt[][] {
  if (segments.length === 0) return [];
  type Edge = { a: string; b: string; pa: Pt; pb: Pt; used: boolean };
  const edges: Edge[] = segments.map(([pa, pb]) => ({
    a: keyPt(pa),
    b: keyPt(pb),
    pa,
    pb,
    used: false,
  }));
  const adj = new Map<string, number[]>();
  const remDeg = new Map<string, number>();
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push(i);
    adj.get(e.b)!.push(i);
    remDeg.set(e.a, (remDeg.get(e.a) ?? 0) + 1);
    remDeg.set(e.b, (remDeg.get(e.b) ?? 0) + 1);
  }

  // Prefer degree-1 seeds without O(E) unused-edge rescans: maintain a stack of
  // edges that currently touch a remaining-degree-1 vertex (#977).
  const open: number[] = [];
  const inOpen = new Uint8Array(edges.length);
  const enqueueIfEndpoint = (ei: number): void => {
    if (edges[ei]!.used || inOpen[ei] === 1) return;
    const e = edges[ei]!;
    if ((remDeg.get(e.a) ?? 0) === 1 || (remDeg.get(e.b) ?? 0) === 1) {
      open.push(ei);
      inOpen[ei] = 1;
    }
  };
  for (let i = 0; i < edges.length; i++) enqueueIfEndpoint(i);

  const markUsed = (ei: number): void => {
    const e = edges[ei]!;
    if (e.used) return;
    e.used = true;
    for (const v of [e.a, e.b] as const) {
      const d = (remDeg.get(v) ?? 0) - 1;
      remDeg.set(v, d);
      if (d === 1) {
        for (const nei of adj.get(v) ?? []) {
          if (!edges[nei]!.used) enqueueIfEndpoint(nei);
        }
      }
    }
  };

  let scan = 0;
  const nextSeed = (): number => {
    while (open.length > 0) {
      const ei = open.pop()!;
      inOpen[ei] = 0;
      if (!edges[ei]!.used) return ei;
    }
    while (scan < edges.length && edges[scan]!.used) scan++;
    return scan < edges.length ? scan : -1;
  };

  const polylines: Pt[][] = [];
  for (;;) {
    const seed = nextSeed();
    if (seed < 0) break;
    const e0 = edges[seed]!;
    markUsed(seed);
    // prefix collects the backward walk with push; reverse once at the end
    // instead of chain.unshift per edge (O(E²) → O(E)).
    const prefix: Pt[] = [];
    const chain: Pt[] = [e0.pa, e0.pb];
    // Extend forward from pb
    let head = e0.b;
    let guard = 0;
    while (guard++ < edges.length + 2) {
      const cand = (adj.get(head) ?? []).find((j) => !edges[j]!.used);
      if (cand === undefined) break;
      const e = edges[cand]!;
      markUsed(cand);
      if (e.a === head) {
        chain.push(e.pb);
        head = e.b;
      } else {
        chain.push(e.pa);
        head = e.a;
      }
    }
    // Extend backward from pa
    let tail = e0.a;
    guard = 0;
    while (guard++ < edges.length + 2) {
      const cand = (adj.get(tail) ?? []).find((j) => !edges[j]!.used);
      if (cand === undefined) break;
      const e = edges[cand]!;
      markUsed(cand);
      if (e.a === tail) {
        prefix.push(e.pb);
        tail = e.b;
      } else {
        prefix.push(e.pa);
        tail = e.a;
      }
    }
    prefix.reverse();
    const poly = prefix.length === 0 ? chain : prefix.concat(chain);
    if (poly.length >= 2) polylines.push(poly);
  }
  return polylines;
}

function collectFiniteRows(input: ContourStatInput) {
  const order: number[] = [];
  const rowsByGroup = new Map<number, number[]>();
  let dropped = 0;
  for (let i = 0; i < input.x.length; i++) {
    const finite =
      Number.isFinite(input.x[i]!) && Number.isFinite(input.y[i]!) && Number.isFinite(input.z[i]!);
    if (!finite) {
      dropped++;
      continue;
    }
    const group = input.groups[i]!;
    let rows = rowsByGroup.get(group);
    if (rows === undefined) {
      rows = [];
      rowsByGroup.set(group, rows);
      order.push(group);
    }
    rows.push(i);
  }
  return { order, rowsByGroup, dropped };
}

type ContourVertex = Pt & { level: number; piece: number };

function contourGroup(
  input: ContourStatInput,
  rows: number[],
  params: ContourParamsInput,
): ContourVertex[] | null {
  const gx = Float64Array.from(rows, (row) => input.x[row]!);
  const gy = Float64Array.from(rows, (row) => input.y[row]!);
  const gz = Float64Array.from(rows, (row) => input.z[row]!);
  const xs = uniqueSorted(gx);
  const ys = uniqueSorted(gy);
  if (xs.length < 2 || ys.length < 2) return null;
  const xi = new Map(xs.map((value, i) => [value, i]));
  const yi = new Map(ys.map((value, i) => [value, i]));
  const grid: (number | null)[][] = Array.from({ length: ys.length }, () =>
    Array.from({ length: xs.length }, () => null),
  );
  for (let k = 0; k < rows.length; k++) grid[yi.get(gy[k]!)!]![xi.get(gx[k]!)!] = gz[k]!;

  let zmin = Infinity;
  let zmax = -Infinity;
  for (const row of grid) {
    for (const value of row) {
      if (value === null || !Number.isFinite(value)) continue;
      if (value < zmin) zmin = value;
      if (value > zmax) zmax = value;
    }
  }
  if (!(zmax > zmin) && params.breaks === undefined) return null;
  const levels = contourLevels(
    Number.isFinite(zmin) ? zmin : 0,
    Number.isFinite(zmax) ? zmax : 1,
    params,
  );
  if (levels.length === 0) return null;

  const vertices: ContourVertex[] = [];
  let piece = 0;
  for (const { level, segments } of contourSegmentsByLevel(xs, ys, grid, levels)) {
    for (const line of stitchSegments(segments)) {
      const pieceId = piece++;
      for (const point of line) vertices.push({ ...point, level, piece: pieceId });
    }
  }
  return vertices;
}

function indexedCellSegments(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  grid: ContourGrid,
  level: number,
  cells: readonly number[],
): Array<[Pt, Pt]> {
  const segs: Array<[Pt, Pt]> = [];
  const columns = xs.length - 1;
  for (const cell of cells) {
    const i = cell % columns;
    const j = (cell - i) / columns;
    segs.push(
      ...cellSegments(
        xs[i]!,
        xs[i + 1]!,
        ys[j]!,
        ys[j + 1]!,
        grid[j]![i]!,
        grid[j]![i + 1]!,
        grid[j + 1]![i]!,
        grid[j + 1]![i + 1]!,
        level,
      ),
    );
  }
  return segs;
}

export function* contourSegmentsByLevel(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  grid: ContourGrid,
  levels: readonly number[],
) {
  const finite = levels.filter((level) => Number.isFinite(level));
  const index = indexCellsByLevel(xs.length - 1, ys.length - 1, grid, finite);
  for (let i = 0; i < finite.length; i++) {
    const level = finite[i]!;
    const cells = index?.[i];
    const segments =
      cells === undefined
        ? gridCellSegments(xs, ys, grid, level)
        : indexedCellSegments(xs, ys, grid, level, cells);
    yield { level, segments };
  }
}

export function statContour(input: ContourStatInput): ContourStatResult {
  const params = input.params ?? {};
  const carriedNames = Object.keys(input.carried ?? {});

  // Group order first-seen
  const { order: groupOrder, rowsByGroup: groupRows, dropped } = collectFiniteRows(input);

  const outX: number[] = [];
  const outY: number[] = [];
  const outLevel: number[] = [];
  const outGroups: number[] = [];
  const outPiece: number[] = [];
  const sampleRows: number[] = [];
  let droppedGroups = 0;

  for (const g of groupOrder) {
    const rows = groupRows.get(g)!;
    const vertices = contourGroup(input, rows, params);
    if (vertices === null) {
      droppedGroups++;
      continue;
    }
    const sample = rows[0]!;
    for (const vertex of vertices) {
      outX.push(vertex.x);
      outY.push(vertex.y);
      outLevel.push(vertex.level);
      outGroups.push(g);
      outPiece.push(vertex.piece);
      sampleRows.push(sample);
    }
  }

  const carried: Record<string, CellValue[]> = {};
  for (const name of carriedNames) {
    const src = input.carried![name]!;
    carried[name] = sampleRows.map((row) => src[row]!);
  }

  return {
    x: Float64Array.from(outX),
    y: Float64Array.from(outY),
    level: Float64Array.from(outLevel),
    groups: outGroups,
    piece: outPiece,
    carried,
    dropped,
    droppedGroups,
  };
}

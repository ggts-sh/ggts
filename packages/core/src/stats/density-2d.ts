/**
 * The density_2d stat (ggplot2's stat_density_2d isolines; #802 v1).
 *
 * Clean-room bivariate product-Gaussian KDE + isolines via contour MS helpers
 * (shared with #801 `stats/contour.ts`). No MASS/R source.
 *
 * Bandwidth: MASS::bandwidth.nrd then kde2d's h/4 scaling (fixture-oriented).
 * Grid: n×n over data range expanded by 5% each side (approx ggplot expand).
 * Contour levels: contourLevels(breaks | bins | binwidth) of the density surface.
 * KDE surface: sorted-x sliding window plus a per-row y gather (same ±8σ
 * product kernel as a full G²·n scan; visits only the pairs inside both
 * windows, so a local bandwidth cuts the work on both axes).
 *
 * Filled v1 (#802 phase 2): closed isoline rings only (open rings dropped).
 * True isobands between consecutive levels deferred.
 * Deferred: contour_var other than density, weights.
 */
import type { CellValue } from "../table.js";

import { contourLevels, contourSegmentsByLevel, stitchSegments } from "./contour.js";
import { quantile7, sampleSD } from "./numeric.js";

interface Density2dParamsInput {
  /** Bandwidth: one number for both axes, or [hx, hy]. */
  h?: number | readonly number[] | undefined;
  adjust?: number | undefined;
  /** Grid resolution per axis (default 100). */
  n?: number | undefined;
  bins?: number | undefined;
  breaks?: readonly number[] | undefined;
  binwidth?: number | undefined;
  /**
   * When true, keep only closed isoline rings for filled bands (density_2d_filled).
   * Open (boundary-touching) rings are dropped.
   */
  filled?: boolean | undefined;
}

export interface Density2dStatInput {
  x: Float64Array;
  y: Float64Array;
  groups: readonly number[];
  carried?: Readonly<Record<string, readonly CellValue[]>>;
  params?: Density2dParamsInput;
}

export interface Density2dStatResult {
  x: Float64Array;
  y: Float64Array;
  level: Float64Array;
  density: Float64Array;
  groups: number[];
  piece: number[];
  carried: Record<string, CellValue[]>;
  dropped: number;
  droppedGroups: number;
  /** Open rings dropped when params.filled (for warnings). */
  openRingsDropped: number;
}

/** Whether a stitched polyline closes on itself (filled-ring eligibility). */
export function isClosedRing(line: readonly { x: number; y: number }[], eps = 1e-9): boolean {
  if (line.length < 3) return false;
  const a = line.at(0)!;
  const b = line.at(-1)!;
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

/**
 * MASS::bandwidth.nrd — 4 * 1.06 * min(sd, IQR/1.34) * n^(-1/5).
 * kde2d then divides by 4 → effective 1.06 * s * n^(-1/5).
 */
export function bandwidthNRD(sorted: Float64Array): number {
  const n = sorted.length;
  if (n < 2) return 1;
  const hi = sampleSD(sorted);
  const iqr = quantile7(sorted, 0.75) - quantile7(sorted, 0.25);
  let lo = Math.min(hi, iqr / 1.34);
  if (!(lo > 0)) {
    lo = hi > 0 ? hi : Math.abs(sorted[0]!) || 1;
  }
  return 4 * 1.06 * lo * Math.pow(n, -0.2);
}

const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI);

function dnorm(u: number): number {
  return INV_SQRT_2PI * Math.exp(-0.5 * u * u);
}

export type ProductKdeGridOptions = {
  /**
   * When true, also return how many (grid-cell, sample) pairs the inner loop
   * examined — those inside both the x and the y window. Complexity tests only.
   */
  countExaminations?: boolean;
};

export type ProductKdeGridResult = number[][] & {
  examinations?: number;
};

function sortedPairs(xs: Float64Array, ys: Float64Array) {
  const order = Array.from({ length: xs.length }, (_, i) => i).toSorted(
    (a, b) => xs[a]! - xs[b]! || a - b,
  );
  const x = new Float64Array(xs.length);
  const y = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    x[i] = xs[order[i]!]!;
    y[i] = ys[order[i]!]!;
  }
  return { x, y };
}

function extent(values: Float64Array): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

function packRow(
  y: number,
  window: number,
  sortedX: Float64Array,
  sortedY: Float64Array,
  rowX: Float64Array,
  rowY: Float64Array,
): number {
  let count = 0;
  for (let i = 0; i < sortedX.length; i++) {
    if (Math.abs(y - sortedY[i]!) > window) continue;
    rowX[count] = sortedX[i]!;
    rowY[count] = sortedY[i]!;
    count++;
  }
  return count;
}

/**
 * Product-Gaussian KDE on a regular grid.
 *
 * Samples are sorted once by x; each grid row slides an x-window across
 * ascending `gx`, and gathers the samples inside its y-window once up front, so
 * neither dimension is scanned per cell. Cost is O(G·n) for the gathers plus
 * one visit per sample-cell pair inside both windows. Scanning y per cell
 * instead — as this did before — costs O(G²·n·fx) with fx = 16·hx/xspan, and
 * throws away a share that grows with n (64% at n = 20 000, G = 100).
 * Each sample's Gaussian y factor is reused across the x cells of that row.
 *
 * `gx` must ascend (the x slide only moves forward). Same ±8σ truncation and
 * invN scaling as the historical direct product (MASS::kde2d-shaped), and the
 * same ascending-x addend order, so the surface is unchanged bit for bit.
 */
export function productKdeGrid(
  xs: Float64Array,
  ys: Float64Array,
  gx: Float64Array,
  gy: Float64Array,
  hx: number,
  hy: number,
  options: ProductKdeGridOptions = {},
): ProductKdeGridResult {
  const nx = xs.length;
  const gridNX = gx.length;
  const gridNY = gy.length;
  const z: ProductKdeGridResult = Array.from({ length: gridNY }, () =>
    Array.from({ length: gridNX }, () => 0),
  );
  if (nx === 0 || gridNX === 0 || gridNY === 0 || !(hx > 0) || !(hy > 0)) {
    if (options.countExaminations === true) z.examinations = 0;
    return z;
  }

  const { x: sortedX, y: sortedY } = sortedPairs(xs, ys);

  const wx = 8 * hx;
  const wy = 8 * hy;
  const invN = 1 / (nx * hx * hy);
  let examinations = 0;
  const count = options.countExaminations === true;

  // Does any row ever exclude a sample? If the widest sample-to-row gap still
  // fits inside the window, no gather can remove anything, so read the sorted
  // arrays directly. That is the wide-bandwidth case, where the gather would be
  // pure overhead.
  const [yMin, yMax] = extent(sortedY);
  const [gyMin, gyMax] = extent(gy);
  const everyRowTakesEverySample = Math.max(gyMax - yMin, yMax - gyMin) <= wy;

  // Samples inside the current row's y window, packed by value in the same
  // ascending-x order as `sortedX` — so the slide below still works and the
  // addends keep their order. Packed rather than indexed so the innermost loop
  // reads one array element per coordinate either way.
  const rowX = everyRowTakesEverySample ? sortedX : new Float64Array(nx);
  const rowKernelY = new Float64Array(nx);
  // In packed rows, replace each y coordinate with its factor on first use.
  const rowY = everyRowTakesEverySample ? sortedY : rowKernelY;
  let rowCount = nx;

  for (let j = 0; j < gridNY; j++) {
    const yj = gy[j]!;
    if (!everyRowTakesEverySample) {
      rowCount = packRow(yj, wy, sortedX, sortedY, rowX, rowY);
    }
    let lo = 0;
    // The advancing lower x cursor leaves skipped indices behind.
    let nextYFactor = 0;
    for (let i = 0; i < gridNX; i++) {
      const xi = gx[i]!;
      const xLo = xi - wx;
      const xHi = xi + wx;
      while (lo < rowCount && rowX[lo]! < xLo) lo++;
      let s = 0;
      for (let k = lo; k < rowCount; k++) {
        const xv = rowX[k]!;
        if (xv > xHi) break;
        if (count) examinations++;
        if (k >= nextYFactor) {
          rowKernelY[k] = dnorm((yj - rowY[k]!) / hy);
          nextYFactor = k + 1;
        }
        s += dnorm((xi - xv) / hx) * rowKernelY[k]!;
      }
      z[j]![i] = s * invN;
    }
  }

  if (count) z.examinations = examinations;
  return z;
}

function expandRange(min: number, max: number, mul = 0.05): [number, number] {
  if (!(max > min)) {
    const pad = Math.abs(min) || 1;
    return [min - pad * mul, max + pad * mul];
  }
  const mid = (min + max) / 2;
  const half = ((max - min) / 2) * (1 + mul);
  return [mid - half, mid + half];
}

function linspace(from: number, to: number, n: number): Float64Array {
  const out = new Float64Array(n);
  if (n === 1) {
    out[0] = from;
    return out;
  }
  const step = (to - from) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = from + i * step;
  return out;
}

function resolveH(
  xs: Float64Array,
  ys: Float64Array,
  params: Density2dParamsInput,
): [number, number] {
  const adjust = params.adjust ?? 1;
  const h = params.h;
  let hx: number;
  let hy: number;
  if (h === undefined) {
    const sx = Float64Array.from(xs).toSorted((a, b) => a - b);
    const sy = Float64Array.from(ys).toSorted((a, b) => a - b);
    hx = bandwidthNRD(sx);
    hy = bandwidthNRD(sy);
  } else if (typeof h === "number") {
    if (!(h > 0)) throw new Error("density_2d: params.h must be > 0");
    hx = h;
    hy = h;
  } else if (h.length >= 2) {
    // readonly number[] branch of params.h (not a bare number).
    const hx0 = h[0]!;
    const hy0 = h[1]!;
    if (!(hx0 > 0) || !(hy0 > 0)) {
      throw new Error("density_2d: params.h entries must be > 0");
    }
    hx = hx0;
    hy = hy0;
  } else {
    throw new Error("density_2d: params.h must be a number or [hx, hy]");
  }
  // MASS::kde2d scales bandwidth.nrd by 1/4
  return [(hx * adjust) / 4, (hy * adjust) / 4];
}

function collectFiniteRows(input: Density2dStatInput) {
  const order: number[] = [];
  const rowsByGroup = new Map<number, number[]>();
  let dropped = 0;
  for (let i = 0; i < input.x.length; i++) {
    if (!Number.isFinite(input.x[i]!) || !Number.isFinite(input.y[i]!)) {
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

function groupValues(input: Density2dStatInput, rows: number[]) {
  const x = new Float64Array(rows.length);
  const y = new Float64Array(rows.length);
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (let i = 0; i < rows.length; i++) {
    x[i] = input.x[rows[i]!]!;
    y[i] = input.y[rows[i]!]!;
    if (x[i]! < xmin) xmin = x[i]!;
    if (x[i]! > xmax) xmax = x[i]!;
    if (y[i]! < ymin) ymin = y[i]!;
    if (y[i]! > ymax) ymax = y[i]!;
  }
  return { x, y, xmin, xmax, ymin, ymax };
}

function densitySurface(
  input: Density2dStatInput,
  rows: number[],
  params: Density2dParamsInput,
  gridN: number,
) {
  const values = groupValues(input, rows);
  let bandwidth: [number, number];
  try {
    bandwidth = resolveH(values.x, values.y, params);
  } catch {
    return null;
  }
  const [hx, hy] = bandwidth;
  if (!(hx > 0) || !(hy > 0)) return null;
  const [x0, x1] = expandRange(values.xmin, values.xmax, 0.05);
  const [y0, y1] = expandRange(values.ymin, values.ymax, 0.05);
  const gx = linspace(x0, x1, gridN);
  const gy = linspace(y0, y1, gridN);
  const z = productKdeGrid(values.x, values.y, gx, gy, hx, hy);
  let zmin = Infinity;
  let zmax = -Infinity;
  for (const row of z) {
    for (const value of row) {
      if (value < zmin) zmin = value;
      if (value > zmax) zmax = value;
    }
  }
  const levels = contourLevels(zmin, zmax, {
    bins: params.bins,
    breaks: params.breaks,
    binwidth: params.binwidth,
  });
  return levels.length === 0 || !(zmax > zmin) ? null : { gx, gy, z, zmin, zmax, levels };
}

type DensityContourVertex = {
  x: number;
  y: number;
  level: number;
  piece: number;
};

function densityContours(
  surface: NonNullable<ReturnType<typeof densitySurface>>,
  filled: boolean,
): { vertices: DensityContourVertex[]; openRingsDropped: number } {
  const vertices: DensityContourVertex[] = [];
  let openRingsDropped = 0;
  let piece = 0;
  const levels = surface.levels.filter((level) => level > surface.zmin && level < surface.zmax);
  for (const { level, segments } of contourSegmentsByLevel(
    surface.gx,
    surface.gy,
    surface.z,
    levels,
  )) {
    for (const line of stitchSegments(segments)) {
      if (filled && !isClosedRing(line)) {
        openRingsDropped++;
        continue;
      }
      const pieceId = piece++;
      for (const point of line) vertices.push({ ...point, level, piece: pieceId });
    }
  }
  return { vertices, openRingsDropped };
}

export function statDensity2d(input: Density2dStatInput): Density2dStatResult {
  const params = input.params ?? {};
  const gridN = params.n ?? 100;
  const carriedNames = Object.keys(input.carried ?? {});

  const { order: groupOrder, rowsByGroup: groupRows, dropped } = collectFiniteRows(input);

  const outX: number[] = [];
  const outY: number[] = [];
  const outLevel: number[] = [];
  const outDensity: number[] = [];
  const outGroups: number[] = [];
  const outPiece: number[] = [];
  const sampleRows: number[] = [];
  let droppedGroups = 0;
  let openRingsDropped = 0;
  const filled = params.filled === true;

  for (const g of groupOrder) {
    const rows = groupRows.get(g)!;
    if (rows.length < 2) {
      droppedGroups++;
      continue;
    }
    const surface = densitySurface(input, rows, params, gridN);
    if (surface === null) {
      droppedGroups++;
      continue;
    }
    const contours = densityContours(surface, filled);
    openRingsDropped += contours.openRingsDropped;
    const sample = rows[0]!;
    for (const vertex of contours.vertices) {
      outX.push(vertex.x);
      outY.push(vertex.y);
      outLevel.push(vertex.level);
      outDensity.push(vertex.level);
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
    density: Float64Array.from(outDensity),
    groups: outGroups,
    piece: outPiece,
    carried,
    dropped,
    droppedGroups,
    openRingsDropped,
  };
}

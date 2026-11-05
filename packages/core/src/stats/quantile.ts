/**
 * stat_quantile — linear quantile regression y = a + b x (#805).
 * Clean-room public contract (ggplot2 geom_quantile / stat_quantile docs).
 *
 * Method v1: linear rq only (formula y ~ x). No rqss, no weights.
 *
 * Fit: for fixed slope b, optimal intercept is the pinball-minimizing
 * order statistic of residuals y − b·x (⌈τ n⌉-th). Optimal slope chosen
 * among pairwise slopes (LP vertex property) for n ≤ PAIRWISE_CAP;
 * otherwise derivative-bisection on the profiled pinball loss without
 * pairwise enumeration (default bracket + expand until subgradient signs differ).
 */

import type { CellValue } from "../table.js";

const PAIRWISE_CAP = 150;
const DEFAULT_QUANTILES = [0.25, 0.5, 0.75] as const;
const DEFAULT_N = 80;

export interface QuantileFit {
  readonly intercept: number;
  readonly slope: number;
}

export interface StatQuantileInput {
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly groups: readonly number[];
  readonly quantiles?: readonly number[];
  readonly n?: number;
  readonly carried: Readonly<Record<string, readonly CellValue[]>>;
}

export interface StatQuantileResult {
  readonly x: Float64Array;
  readonly y: Float64Array;
  /** Synthetic series id: one per (input group × quantile). */
  readonly groups: number[];
  /** Quantile τ for each output row. */
  readonly quantile: Float64Array;
  readonly carried: Record<string, CellValue[]>;
  readonly dropped: number;
  readonly droppedGroups: number;
}

/** Pinball / check loss ρ_τ. */
export function pinballLoss(residuals: ArrayLike<number>, tau: number): number {
  let sum = 0;
  for (let i = 0; i < residuals.length; i++) {
    const u = residuals[i]!;
    sum += u >= 0 ? tau * u : (tau - 1) * u;
  }
  return sum;
}

/**
 * The k-th smallest of `values` (0-based). Reorders `values`. Quickselect with
 * a median-of-three pivot: O(n) expected. An input built against the pivot rule
 * would make it O(n²), so after 2·log2(n) rounds a native sort finishes the
 * range, and the worst case stays O(n log n).
 */
function selectKth(values: Float64Array, k: number): number {
  let lo = 0;
  let hi = values.length - 1;
  let rounds = 2 * (32 - Math.clz32(values.length));
  while (lo < hi) {
    if (rounds-- === 0) {
      values.subarray(lo, hi + 1).sort();
      break;
    }
    const a = values[lo]!;
    const b = values[(lo + hi) >>> 1]!;
    const c = values[hi]!;
    const pivot = a < b ? (b < c ? b : a < c ? c : a) : a < c ? a : b < c ? c : b;
    let i = lo;
    let j = hi;
    while (i <= j) {
      while (values[i]! < pivot) i++;
      while (values[j]! > pivot) j--;
      if (i <= j) {
        const swapped = values[i]!;
        values[i] = values[j]!;
        values[j] = swapped;
        i++;
        j--;
      }
    }
    // [lo, j] <= pivot <= [i, hi], and anything between equals the pivot.
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else break;
  }
  return values[k]!;
}

function orderStatRank(n: number, tau: number): number {
  return Math.min(n - 1, Math.max(0, Math.ceil(tau * n) - 1));
}

/**
 * Pinball-minimizing empirical quantile: order statistic at index
 * k = clamp(ceil(τ n) − 1, 0, n−1). Deterministic on ties (left endpoint
 * of any flat optimal interval when τn is integer).
 */
export function empiricalQuantileOrderStat(values: readonly number[], tau: number): number {
  const n = values.length;
  if (n === 0) return Number.NaN;
  return selectKth(Float64Array.from(values), orderStatRank(n, tau));
}

/** Optimal intercept for a fixed slope. `scratch` holds one value per row, and a fit reuses it. */
function profiledIntercept(
  x: Float64Array,
  y: Float64Array,
  rows: readonly number[],
  slope: number,
  tau: number,
  scratch: Float64Array,
): number {
  for (let i = 0; i < rows.length; i++) scratch[i] = y[rows[i]!]! - slope * x[rows[i]!]!;
  return selectKth(scratch, orderStatRank(rows.length, tau));
}

function residualPinball(
  x: Float64Array,
  y: Float64Array,
  rows: readonly number[],
  slope: number,
  tau: number,
  scratch: Float64Array,
): { intercept: number; loss: number } {
  const intercept = profiledIntercept(x, y, rows, slope, tau, scratch);
  // Selection reordered `scratch`. Refill it in row order: rounding in this sum
  // can decide a tie between slopes.
  for (let i = 0; i < rows.length; i++) {
    scratch[i] = y[rows[i]!]! - slope * x[rows[i]!]! - intercept;
  }
  return { intercept, loss: pinballLoss(scratch, tau) };
}

function pairwiseSlopes(x: Float64Array, y: Float64Array, rows: readonly number[]): number[] {
  const slopes: number[] = [0];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const dx = x[rows[j]!]! - x[rows[i]!]!;
      if (dx === 0) continue;
      slopes.push((y[rows[j]!]! - y[rows[i]!]!) / dx);
    }
  }
  return slopes;
}

/** Sign of profiled pinball derivative wrt slope (for bisection). */
function slopeSubgradientSign(
  x: Float64Array,
  y: Float64Array,
  rows: readonly number[],
  slope: number,
  tau: number,
  scratch: Float64Array,
): number {
  const intercept = profiledIntercept(x, y, rows, slope, tau, scratch);
  // d/db ρ_τ(y − a − b x) = −x · (τ − 1{r < 0}) with care at zero residuals.
  let g = 0;
  for (const row of rows) {
    const r = y[row]! - intercept - slope * x[row]!;
    const xv = x[row]!;
    if (r < -1e-12) g += -(tau - 1) * xv;
    else if (r > 1e-12) g += -tau * xv;
    else g += -(tau - 0.5) * xv; // midpoint of subgradient interval at kink
  }
  if (Math.abs(g) < 1e-10) return 0;
  return g > 0 ? 1 : -1;
}

function fitByPairwise(
  x: Float64Array,
  y: Float64Array,
  rows: readonly number[],
  tau: number,
): QuantileFit {
  const scratch = new Float64Array(rows.length);
  let bestSlope = 0;
  let best = residualPinball(x, y, rows, 0, tau, scratch);
  for (const slope of pairwiseSlopes(x, y, rows)) {
    const cand = residualPinball(x, y, rows, slope, tau, scratch);
    if (cand.loss < best.loss - 1e-15) {
      best = cand;
      bestSlope = slope;
    }
  }
  return { intercept: best.intercept, slope: bestSlope };
}

function fitByBisection(
  x: Float64Array,
  y: Float64Array,
  rows: readonly number[],
  tau: number,
): QuantileFit {
  const scratch = new Float64Array(rows.length);
  let lo = -1;
  let hi = 1;
  for (let expand = 0; expand < 20; expand++) {
    const sLo = slopeSubgradientSign(x, y, rows, lo, tau, scratch);
    const sHi = slopeSubgradientSign(x, y, rows, hi, tau, scratch);
    if (sLo === 0) return residualToFit(x, y, rows, lo, tau, scratch);
    if (sHi === 0) return residualToFit(x, y, rows, hi, tau, scratch);
    if (sLo !== sHi) break;
    const width = hi - lo;
    lo -= width;
    hi += width;
  }
  // lo moves only to a slope with this same sign, so one evaluation holds for the whole loop.
  const sLo = slopeSubgradientSign(x, y, rows, lo, tau, scratch);
  for (let iter = 0; iter < 80; iter++) {
    const mid = 0.5 * (lo + hi);
    // No double lies between lo and hi. The slope below is already mid.
    if (mid === lo || mid === hi) break;
    const s = slopeSubgradientSign(x, y, rows, mid, tau, scratch);
    if (s === 0) return residualToFit(x, y, rows, mid, tau, scratch);
    if (sLo === s) lo = mid;
    else hi = mid;
  }
  const slope = 0.5 * (lo + hi);
  return residualToFit(x, y, rows, slope, tau, scratch);
}

function residualToFit(
  x: Float64Array,
  y: Float64Array,
  rows: readonly number[],
  slope: number,
  tau: number,
  scratch: Float64Array,
): QuantileFit {
  return { intercept: profiledIntercept(x, y, rows, slope, tau, scratch), slope };
}

/**
 * Fit y = a + b x at quantile τ. Returns null if n < 2 or all x identical.
 */
export function fitLinearQuantileRegression(
  x: Float64Array,
  y: Float64Array,
  tau: number,
  rowIndices?: readonly number[],
): QuantileFit | null {
  const rows =
    rowIndices ??
    Array.from({ length: x.length }, (_, i) => i).filter(
      (i) => Number.isFinite(x[i]!) && Number.isFinite(y[i]!),
    );
  if (rows.length < 2) return null;
  let minX = x[rows[0]!]!;
  let maxX = minX;
  for (const row of rows) {
    const xv = x[row]!;
    if (xv < minX) minX = xv;
    if (xv > maxX) maxX = xv;
  }
  if (minX === maxX) return null;
  if (rows.length <= PAIRWISE_CAP) return fitByPairwise(x, y, rows, tau);
  return fitByBisection(x, y, rows, tau);
}

export function normalizeQuantiles(raw: readonly number[] | undefined): number[] {
  const source = raw === undefined || raw.length === 0 ? [...DEFAULT_QUANTILES] : [...raw];
  const cleaned = source
    .filter((q) => Number.isFinite(q) && q > 0 && q < 1)
    .toSorted((a, b) => a - b);
  // Unique within epsilon
  const uniq: number[] = [];
  for (const q of cleaned) {
    if (uniq.length === 0 || Math.abs(uniq.at(-1)! - q) > 1e-12) uniq.push(q);
  }
  return uniq;
}

export function statQuantile(input: StatQuantileInput): StatQuantileResult {
  const quantiles = normalizeQuantiles(input.quantiles);
  const evalN = Math.max(2, Math.floor(input.n ?? DEFAULT_N));
  const { x, y, groups, carried } = input;

  const byGroup = new Map<number, number[]>();
  let dropped = 0;
  for (let row = 0; row < x.length; row++) {
    if (!Number.isFinite(x[row]!) || !Number.isFinite(y[row]!)) {
      dropped++;
      continue;
    }
    const g = groups[row] ?? 0;
    let list = byGroup.get(g);
    if (list === undefined) {
      list = [];
      byGroup.set(g, list);
    }
    list.push(row);
  }

  const outX: number[] = [];
  const outY: number[] = [];
  const outG: number[] = [];
  const outQ: number[] = [];
  const carriedOut: Record<string, CellValue[]> = {};
  const carriedKeys = Object.keys(carried);
  for (const key of carriedKeys) carriedOut[key] = [];

  let seriesId = 0;
  let droppedGroups = 0;

  if (quantiles.length === 0) {
    return {
      x: new Float64Array(0),
      y: new Float64Array(0),
      groups: [],
      quantile: new Float64Array(0),
      carried: carriedOut,
      dropped,
      droppedGroups: byGroup.size,
    };
  }

  for (const g of byGroup.keys()) {
    const rows = byGroup.get(g)!;
    let anyFit = false;
    for (const tau of quantiles) {
      const fit = fitLinearQuantileRegression(x, y, tau, rows);
      if (fit === null) continue;
      anyFit = true;
      let minX = x[rows[0]!]!;
      let maxX = minX;
      for (const row of rows) {
        const xv = x[row]!;
        if (xv < minX) minX = xv;
        if (xv > maxX) maxX = xv;
      }
      const rep = rows[0]!;
      for (let k = 0; k < evalN; k++) {
        const t = evalN === 1 ? 0 : k / (evalN - 1);
        const x0 = minX + t * (maxX - minX);
        outX.push(x0);
        outY.push(fit.intercept + fit.slope * x0);
        outG.push(seriesId);
        outQ.push(tau);
        for (const key of carriedKeys) {
          carriedOut[key]!.push(carried[key]![rep]!);
        }
      }
      seriesId++;
    }
    if (!anyFit) droppedGroups++;
  }

  return {
    x: Float64Array.from(outX),
    y: Float64Array.from(outY),
    groups: outG,
    quantile: Float64Array.from(outQ),
    carried: carriedOut,
    dropped,
    droppedGroups,
  };
}

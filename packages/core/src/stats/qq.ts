/**
 * Q–Q stats (ggplot2 stat_qq / stat_qq_line).
 *
 * Clean-room contracts:
 *  - sample aesthetic → finite values per group
 *  - theoretical quantiles from standard normal (qnorm) at ppoints(n)
 *  - qq_line: line through type-7 sample quantiles at probs (default 0.25, 0.75)
 *    matched to theoretical quantiles; two endpoints spanning theoretical range
 *
 * ppoints / qnorm algorithms: standard numerical recipes (not ggplot2 R source).
 */
import type { CellValue } from "../table.js";

import { quantile7 } from "./numeric.js";

function defaultPlottingPositionPad(n: number): number {
  return n <= 10 ? 3 / 8 : 1 / 2;
}

/** R's ppoints(n, a): plotting positions in (0,1). */
export function ppoints(n: number, a?: number): Float64Array {
  if (n <= 0) return new Float64Array(0);
  const aa = a ?? defaultPlottingPositionPad(n);
  const out = new Float64Array(n);
  const denom = n + 1 - 2 * aa;
  for (let i = 0; i < n; i++) out[i] = (i + 1 - aa) / denom;
  return out;
}

/**
 * Standard normal quantile (Acklam's approximation).
 * Relative error typically < 1.15e-9 over (0,1).
 */
export function qnorm(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return Number.NEGATIVE_INFINITY;
    if (p === 1) return Number.POSITIVE_INFINITY;
    return Number.NaN;
  }
  // Coefficients in rational approximations.
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614736e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

  const plow = 0.02425;
  const phigh = 1 - plow;
  let q: number;
  let r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p > phigh) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  q = p - 0.5;
  r = q * q;
  return (
    ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
  );
}

export interface QqStatInput {
  sample: Float64Array;
  groups: readonly number[];
  carried?: Readonly<Record<string, readonly CellValue[]>>;
}

export interface QqStatResult {
  /** Theoretical quantiles (after_stat x / theoretical). */
  theoretical: Float64Array;
  /** Sample quantiles (after_stat y / sample). */
  sample: Float64Array;
  groups: number[];
  carried: Record<string, CellValue[]>;
  dropped: number;
}

export function statQq(input: QqStatInput): QqStatResult {
  const { sample, groups } = input;
  const carriedNames = Object.keys(input.carried ?? {});
  const nIn = sample.length;

  // Collect finite values per group (preserve first-seen group order).
  const groupOrder: number[] = [];
  const groupSlot = new Map<number, number>();
  const buckets: number[][] = [];
  const sampleRows: number[] = [];
  let dropped = 0;
  for (let i = 0; i < nIn; i++) {
    const v = sample[i]!;
    const g = groups[i]!;
    if (!groupSlot.has(g)) {
      groupSlot.set(g, groupOrder.length);
      groupOrder.push(g);
      buckets.push([]);
      sampleRows.push(i);
    }
    if (!Number.isFinite(v)) {
      dropped++;
      continue;
    }
    buckets[groupSlot.get(g)!]!.push(v);
  }

  let nOut = 0;
  for (const b of buckets) nOut += b.length;
  const outT = new Float64Array(nOut);
  const outS = new Float64Array(nOut);
  const outGroups: number[] = [];
  const carried: Record<string, CellValue[]> = {};
  for (const name of carriedNames) carried[name] = [];

  let row = 0;
  for (let s = 0; s < groupOrder.length; s++) {
    const vals = buckets[s]!;
    if (vals.length === 0) continue;
    vals.sort((a, b) => a - b);
    const pp = ppoints(vals.length);
    for (let i = 0; i < vals.length; i++) {
      outT[row] = qnorm(pp[i]!);
      outS[row] = vals[i]!;
      outGroups.push(groupOrder[s]!);
      for (const name of carriedNames) {
        carried[name]!.push(input.carried![name]![sampleRows[s]!]!);
      }
      row++;
    }
  }

  return {
    theoretical: outT.subarray(0, row),
    sample: outS.subarray(0, row),
    groups: outGroups,
    carried,
    dropped,
  };
}

export interface QqLineStatInput extends QqStatInput {
  /** Quantile probs for the line (default 0.25, 0.75). */
  probs?: readonly [number, number];
}

export interface QqLineStatResult {
  theoretical: Float64Array;
  sample: Float64Array;
  groups: number[];
  carried: Record<string, CellValue[]>;
  dropped: number;
}

export function statQqLine(input: QqLineStatInput): QqLineStatResult {
  const { sample, groups } = input;
  const probs = input.probs ?? ([0.25, 0.75] as const);
  const carriedNames = Object.keys(input.carried ?? {});
  const nIn = sample.length;

  const groupOrder: number[] = [];
  const groupSlot = new Map<number, number>();
  const buckets: number[][] = [];
  const sampleRows: number[] = [];
  let dropped = 0;
  for (let i = 0; i < nIn; i++) {
    const v = sample[i]!;
    const g = groups[i]!;
    if (!groupSlot.has(g)) {
      groupSlot.set(g, groupOrder.length);
      groupOrder.push(g);
      buckets.push([]);
      sampleRows.push(i);
    }
    if (!Number.isFinite(v)) {
      dropped++;
      continue;
    }
    buckets[groupSlot.get(g)!]!.push(v);
  }

  // Two endpoints per group that has enough finite values.
  const rows: { t: number; s: number; g: number; sampleRow: number }[] = [];
  for (let s = 0; s < groupOrder.length; s++) {
    const vals = buckets[s]!;
    if (vals.length < 2) continue;
    vals.sort((a, b) => a - b);
    const y0 = quantile7(vals, probs[0]);
    const y1 = quantile7(vals, probs[1]);
    const x0 = qnorm(probs[0]);
    const x1 = qnorm(probs[1]);
    const dx = x1 - x0;
    if (!(Math.abs(dx) > 0) || !Number.isFinite(y0) || !Number.isFinite(y1)) continue;
    const slope = (y1 - y0) / dx;
    const intercept = y0 - slope * x0;
    // The outer plotting positions span this group's theoretical range.
    const n = vals.length;
    const pad = defaultPlottingPositionPad(n);
    const denominator = n + 1 - 2 * pad;
    let tMin = qnorm((1 - pad) / denominator);
    let tMax = qnorm((n - pad) / denominator);
    if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMin === tMax) {
      tMin = x0;
      tMax = x1;
    }
    const g = groupOrder[s]!;
    const sampleRow = sampleRows[s]!;
    rows.push(
      { t: tMin, s: intercept + slope * tMin, g, sampleRow },
      { t: tMax, s: intercept + slope * tMax, g, sampleRow },
    );
  }

  const nOut = rows.length;
  const outT = new Float64Array(nOut);
  const outS = new Float64Array(nOut);
  const outGroups: number[] = [];
  const carried: Record<string, CellValue[]> = {};
  for (const name of carriedNames) carried[name] = [];
  for (let i = 0; i < nOut; i++) {
    outT[i] = rows[i]!.t;
    outS[i] = rows[i]!.s;
    outGroups.push(rows[i]!.g);
    for (const name of carriedNames) {
      carried[name]!.push(input.carried![name]![rows[i]!.sampleRow]!);
    }
  }

  return {
    theoretical: outT,
    sample: outS,
    groups: outGroups,
    carried,
    dropped,
  };
}

/**
 * The summary_rolling stat — a centered rolling-window summary over
 * continuous x (ggplot2 has no direct equivalent; closest is zoo::rollapply
 * with align = "center").
 *
 * Stat output contract:
 *  - required inputs: continuous numeric x and quantitative y.
 *  - params.window is REQUIRED (width in x data units, > 0). There is no
 *    silent default width — the spec validator raises
 *    "summary-rolling-window-required" and this module throws as the
 *    pipeline backstop.
 *  - one output row per (group, unique x): y = fun over the rows with
 *    |x − center| ≤ window/2 (both edges inclusive). fun defaults to mean.
 *  - partial windows at the series ends are KEPT (divergence from zoo's
 *    default NA padding): a running line reaches both ends of the data.
 *  - windows never cross groups, even at overlapping x.
 *  - generated columns: `x` (window center) and `y`. No ymin/ymax spread
 *    (v1 — a running line, not a band).
 *  - scale-space: x is already transformed when supplied; y is NOT
 *    re-transformed (summary values live in measure space).
 *  - no weight channel (v1).
 *
 * Complexity: O(n log n) sort per group, then a two-pointer sliding window.
 * mean, sum, min and max add O(n). median adds O(n · w), with w the window row
 * count: each row moves part of one sorted array.
 */
import type { CellValue } from "../table.js";

import { medianOfSorted, type SummaryFunName } from "./summary.js";

export interface SummaryRollingParamsInput {
  window?: number | undefined;
  fun?: SummaryFunName | undefined;
}

export interface SummaryRollingStatInput {
  x: Float64Array;
  y: Float64Array;
  groups: readonly number[];
  carried?: Readonly<Record<string, readonly CellValue[]>>;
  params?: SummaryRollingParamsInput;
}

export interface SummaryRollingStatResult {
  x: Float64Array;
  y: Float64Array;
  groups: number[];
  carried: Record<string, CellValue[]>;
  dropped: number;
}

function collectFiniteRows(input: SummaryRollingStatInput) {
  const { x, y, groups } = input;
  const order: number[] = [];
  const rowsByGroup = new Map<number, number[]>();
  let dropped = 0;
  for (let i = 0; i < x.length; i++) {
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) {
      dropped++;
      continue;
    }
    const group = groups[i]!;
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

/** Summary of rows [lo, hi). Calls must not move lo or hi left, and lo < hi. */
type WindowSummary = (lo: number, hi: number) => number;

/**
 * Fold of an associative op over a window that only moves right: a two-stack
 * queue, O(1) amortized per row. It never subtracts, so an outlier that leaves
 * the window leaves no rounding error, as a running or prefix sum would:
 * (1e300 + 1) - 1e300 is 0.
 */
function slidingFold(
  values: readonly number[],
  op: (left: number, right: number) => number,
): WindowSummary {
  // suffix[i] folds values[i..mid); tail folds values[mid..end).
  const suffix = new Float64Array(values.length);
  let mid = 0;
  let end = 0;
  let tail = 0;
  return (lo, hi) => {
    if (lo >= mid) {
      mid = end = hi;
      suffix[hi - 1] = values[hi - 1]!;
      for (let i = hi - 2; i >= lo; i--) suffix[i] = op(values[i]!, suffix[i + 1]!);
      return suffix[lo]!;
    }
    for (; end < hi; end++) tail = end === mid ? values[end]! : op(tail, values[end]!);
    return end === mid ? suffix[lo]! : op(suffix[lo]!, tail);
  };
}

function lowerBound(sorted: Float64Array, size: number, value: number): number {
  let lo = 0;
  let hi = size;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ponytail: copyWithin is O(w) per row, two heaps with lazy deletion if median windows reach 100k rows.
function slidingMedian(values: readonly number[]): WindowSummary {
  const sorted = new Float64Array(values.length);
  let start = 0;
  let end = 0;
  let size = 0;
  return (lo, hi) => {
    for (; end < hi; end++) {
      const at = lowerBound(sorted, size, values[end]!);
      sorted.copyWithin(at + 1, at, size);
      sorted[at] = values[end]!;
      size++;
    }
    for (; start < lo; start++) {
      const at = lowerBound(sorted, size, values[start]!);
      sorted.copyWithin(at, at + 1, size);
      size--;
    }
    return medianOfSorted(sorted, size);
  };
}

const add = (left: number, right: number) => left + right;
// The left value wins a tie, so a window with 0 and -0 keeps the earlier row.
const smaller = (left: number, right: number) => (right < left ? right : left);
const larger = (left: number, right: number) => (right > left ? right : left);

function windowSummary(fun: SummaryFunName, values: readonly number[]): WindowSummary {
  switch (fun) {
    case "mean": {
      const sum = slidingFold(values, add);
      // `+ 0` gives a window of -0 the same +0 as a sum that starts from zero.
      return (lo, hi) => (sum(lo, hi) + 0) / (hi - lo);
    }
    case "sum": {
      const sum = slidingFold(values, add);
      return (lo, hi) => sum(lo, hi) + 0;
    }
    case "median":
      return slidingMedian(values);
    case "min":
      return slidingFold(values, smaller);
    case "max":
      return slidingFold(values, larger);
    default:
      // A bad cast or a manual keep fun (first, last) must fail, not alias a fun.
      throw new Error(`statSummaryRolling: unknown summary fun "${String(fun)}"`);
  }
}

export function statSummaryRolling(input: SummaryRollingStatInput): SummaryRollingStatResult {
  const { x, y, carried = {}, params = {} } = input;
  const window = params.window;
  if (window === undefined || !Number.isFinite(window) || window <= 0) {
    throw new Error(
      'statSummaryRolling: params.window is required (rolling-window width in x data units, > 0) — e.g. geomLine({ stat: "summary_rolling", window: 30 }).',
    );
  }
  const fun = params.fun ?? "mean";
  const half = window / 2;

  // Row order grouped by group id, x ascending within each group. Groups
  // appear in first-occurrence order (the pipeline's group id order).
  const { order: groupOrder, rowsByGroup: byGroup, dropped } = collectFiniteRows(input);

  const outX: number[] = [];
  const outY: number[] = [];
  const outGroups: number[] = [];
  const carriedKeys = Object.keys(carried);
  const carriedOut: Record<string, CellValue[]> = {};
  for (const key of carriedKeys) carriedOut[key] = [];

  for (const g of groupOrder) {
    const rows = byGroup.get(g)!;
    rows.sort((a, b) => x[a]! - x[b]!);
    const xs = rows.map((i) => x[i]!);
    const summarize = windowSummary(
      fun,
      rows.map((i) => y[i]!),
    );

    // Two pointers bound each centered window; centers are the unique x
    // values in ascending order. lo <= j < hi at each center, so a row enters
    // the window before it leaves and the window is never empty.
    let lo = 0;
    let hi = 0; // exclusive
    let j = 0;
    while (j < xs.length) {
      const center = xs[j]!;
      while (lo < xs.length && xs[lo]! < center - half) lo++;
      while (hi < xs.length && xs[hi]! <= center + half) hi++;
      outX.push(center);
      outY.push(summarize(lo, hi));
      outGroups.push(g);
      for (const key of carriedKeys) {
        carriedOut[key]!.push(carried[key]![rows[j]!]!);
      }
      // Skip duplicate centers (all rows at this x are already in the window).
      while (j < xs.length && xs[j] === center) j++;
    }
  }

  return {
    x: Float64Array.from(outX),
    y: Float64Array.from(outY),
    groups: outGroups,
    carried: carriedOut,
    dropped,
  };
}

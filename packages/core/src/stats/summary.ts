/**
 * The summary stat (ggplot2's stat_summary; R-fixture-tested for mean_se).
 *
 * Stat output contract (plan: "Stat output contracts"):
 *  - required inputs: x and a quantitative y channel.
 *  - generated columns, one output row per (group, x) combination in
 *    first-occurrence order: `y` = fun(group's y values), `ymin`/`ymax` =
 *    funMin/funMax of the same values. DEFAULT (fun "mean", no funMin /
 *    funMax): ymin/ymax = mean ± standard error (sd / sqrt(n)) — ggplot2's
 *    mean_se, its stat_summary default. With any other fun and no explicit
 *    funMin/funMax, ymin/ymax equal y (no spread — DIVERGENCE: ggplot2
 *    emits NA and draws nothing; ggts draws a zero-height bar,
 *    decision 0010).
 *  - grouping behavior: summaries are per (group, x) — a continuous x with
 *    repeated values summarizes each distinct x within its group.
 *  - missing-value policy (ggplot2 na.rm semantics): rows with missing x
 *    or missing / non-finite y are dropped and counted in `dropped`
 *    (pipeline warns `removed-missing`).
 */
import type { CellValue } from "../table.js";
import { encodeKey } from "../scales/state.js";
import { mean, sampleSD } from "./numeric.js";

export type SummaryFunName = "mean" | "median" | "sum" | "min" | "max";

export interface SummaryStatInput {
  /** The x column (post-binding, pre-stat). */
  x: readonly CellValue[];
  /** Numeric y view (NaN = missing). */
  y: Float64Array;
  /** Group id per input row. */
  groups: readonly number[];
  /** Center summary (default "mean"). */
  fun?: SummaryFunName | undefined;
  /** Lower/upper bound summaries (default: mean_se when fun is "mean"). */
  funMin?: SummaryFunName | undefined;
  funMax?: SummaryFunName | undefined;
  /** Discrete carried columns (constant per group). */
  carried?: Readonly<Record<string, readonly CellValue[]>>;
}

export interface SummaryStatResult {
  x: CellValue[];
  y: Float64Array;
  ymin: Float64Array;
  ymax: Float64Array;
  groups: number[];
  carried: Record<string, CellValue[]>;
  dropped: number;
}

/**
 * Apply a summary function to a group of values.
 * - median requires ascending sort (caller must pass sorted).
 * - min/max/mean/sum scan unsorted in O(n).
 */
export function applySummaryFun(
  fun: SummaryFunName,
  values: readonly number[],
  sorted: boolean,
): number {
  switch (fun) {
    case "mean":
      return mean(values);
    case "median": {
      if (!sorted) {
        throw new Error("statSummary: median requires sorted values");
      }
      const n = values.length;
      return n % 2 === 1 ? values[(n - 1) / 2]! : (values[n / 2 - 1]! + values[n / 2]!) / 2;
    }
    case "sum": {
      let s = 0;
      for (const v of values) s += v;
      return s;
    }
    case "min": {
      let m = values[0]!;
      for (let i = 1; i < values.length; i++) if (values[i]! < m) m = values[i]!;
      return m;
    }
    case "max": {
      let m = values[0]!;
      for (let i = 1; i < values.length; i++) if (values[i]! > m) m = values[i]!;
      return m;
    }
    default:
      // Exhaustive over SummaryFunName; an out-of-registry name (the manual
      // keep transforms first/last, or a bad cast) must fail loudly, never
      // silently alias one of the registry funs.
      throw new Error(`applySummaryFun: unknown summary fun "${String(fun)}"`);
  }
}

/** True when any requested fun needs an ascending sort (only median). */
function needsSortedSummaryValues(
  fun: SummaryFunName,
  funMin: SummaryFunName | undefined,
  funMax: SummaryFunName | undefined,
): boolean {
  return fun === "median" || funMin === "median" || funMax === "median";
}

/**
 * Center + ymin/ymax for one group of finite y values (shared by summary and
 * summary_bin so mean_se / median-sort stay identical).
 */
export function summarizeValues(
  values: number[],
  fun: SummaryFunName,
  funMin: SummaryFunName | undefined,
  funMax: SummaryFunName | undefined,
): { y: number; ymin: number; ymax: number } {
  const sortValues = needsSortedSummaryValues(fun, funMin, funMax);
  if (sortValues) values.sort((a, b) => a - b);
  const center = applySummaryFun(fun, values, sortValues);
  if (funMin === undefined && funMax === undefined && fun === "mean") {
    // mean_se: mean ± sd/sqrt(n); a single observation has no spread.
    const se = values.length > 1 ? sampleSD(values) / Math.sqrt(values.length) : 0;
    return { y: center, ymin: center - se, ymax: center + se };
  }
  return {
    y: center,
    ymin: funMin === undefined ? center : applySummaryFun(funMin, values, sortValues),
    ymax: funMax === undefined ? center : applySummaryFun(funMax, values, sortValues),
  };
}

export function statSummary(input: SummaryStatInput): SummaryStatResult {
  const { x, y, groups } = input;
  const fun = input.fun ?? "mean";
  const carriedNames = Object.keys(input.carried ?? {});

  // Bucket rows per (group, x) in first-occurrence order.
  const comboIndex = new Map<string, number>();
  const comboRows: number[][] = [];
  const outX: CellValue[] = [];
  const outGroups: number[] = [];
  const carried: Record<string, CellValue[]> = {};
  for (const name of carriedNames) carried[name] = [];
  let dropped = 0;

  for (let row = 0; row < x.length; row++) {
    const xv = x[row]!;
    if (xv === null || !Number.isFinite(y[row]!)) {
      dropped++;
      continue;
    }
    const group = groups[row]!;
    const key = `${group}|${encodeKey(xv)}`;
    let slot = comboIndex.get(key);
    if (slot === undefined) {
      slot = comboRows.length;
      comboIndex.set(key, slot);
      comboRows.push([]);
      outX.push(xv);
      outGroups.push(group);
      for (const name of carriedNames) {
        carried[name]!.push(input.carried![name]![row]!);
      }
    }
    comboRows[slot]!.push(row);
  }

  const outY = new Float64Array(comboRows.length);
  const outYmin = new Float64Array(comboRows.length);
  const outYmax = new Float64Array(comboRows.length);
  // Default mean_se (and min/max/sum) never need a sort — only median does.
  // Skipping the O(n log n) sort per (group,x) keeps large repeated-x groups linear.
  // mean/sum accumulate in input-row order (ggplot2/R data order), not sort order.
  for (let slot = 0; slot < comboRows.length; slot++) {
    const rows = comboRows[slot]!;
    const values = rows.map((row) => y[row]!);
    const summarized = summarizeValues(values, fun, input.funMin, input.funMax);
    outY[slot] = summarized.y;
    outYmin[slot] = summarized.ymin;
    outYmax[slot] = summarized.ymax;
  }

  return {
    x: outX,
    y: outY,
    ymin: outYmin,
    ymax: outYmax,
    groups: outGroups,
    carried,
    dropped,
  };
}

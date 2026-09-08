/**
 * The smooth stat (ggplot2's stat_smooth; R-fixture-tested).
 *
 * Stat output contract (plan: "Stat output contracts"):
 *  - required inputs: quantitative x and y channels (tier-2
 *    `channel-type-mismatch` enforces it).
 *  - generated columns, params.n (default 80) rows per group evaluated at
 *    equally spaced x over the group's x range: `y` (the fit), `ymin` /
 *    `ymax` (the confidence band when params.se, default level 0.95), `se`
 *    (the pointwise standard error). `x` becomes the positional output.
 *  - grouping behavior: one fit per group (e.g. per color series).
 *  - missing-value policy (ggplot2 na.rm semantics): rows with missing /
 *    non-finite x or y are dropped and counted in `dropped` (pipeline warns
 *    `removed-missing`); groups too small or degenerate to fit are dropped
 *    (`droppedGroups`; pipeline warns `smooth-group-dropped`).
 *  - methods:
 *      "lm"    — exact closed-form least squares. Band: ŷ ± qt((1+level)/2,
 *                n−2) · s·sqrt(1/n + (x0−x̄)²/Sxx) — matches R exactly
 *                (fixtures at 1e-8).
 *      "loess" — see stats/loess.ts. Small groups use R surface="direct" /
 *                statistics="exact" (fixtures 23–24, float-noise parity).
 *                Groups above INTERPOLATE_DIRECT_LIMIT (500) use an
 *                interpolate/approximate surface (1D Hermite blend of vertex
 *                fits; #1422) matching ggplot2's default large-n path in
 *                spirit. Tolerances: decision 0010 + fixture 25.
 *    method omitted -> inferred: "loess" when the largest group has fewer
 *    than 1000 rows, else "lm" (advisory `smooth-method-inferred`;
 *    DIVERGENCE: ggplot2 escalates to mgcv::gam, which ggts does not
 *    ship — lm is the honest large-n fallback, decision 0010).
 */
import type { CellValue } from "../table.js";
import { loessFit } from "./loess.js";
import { qt } from "./numeric.js";

interface SmoothParamsInput {
  method?: "lm" | "loess" | undefined;
  se?: boolean | undefined;
  level?: number | undefined;
  span?: number | undefined;
  degree?: 1 | 2 | undefined;
  n?: number | undefined;
}

export interface SmoothStatInput {
  /** Numeric x view (NaN = missing). */
  x: Float64Array;
  /** Numeric y view (NaN = missing). */
  y: Float64Array;
  /** Group id per input row. */
  groups: readonly number[];
  /** Discrete carried columns (constant per group), e.g. the color field. */
  carried?: Readonly<Record<string, readonly CellValue[]>>;
  params?: SmoothParamsInput;
}

export interface SmoothStatResult {
  /** Evaluation grid per output row (n points per surviving group). */
  x: Float64Array;
  y: Float64Array;
  /** Confidence band (NaN-filled when se is off or a group has no band). */
  ymin: Float64Array;
  ymax: Float64Array;
  se: Float64Array;
  /** True when the band was computed (params.se, default true). */
  hasBand: boolean;
  groups: number[];
  carried: Record<string, CellValue[]>;
  dropped: number;
  droppedGroups: number;
  methodUsed: "lm" | "loess";
  /** True when the method was inferred (advisory material). */
  methodInferred: boolean;
}

type SmoothEvaluator = {
  evaluate: (x: number) => { fit: number; seFit: number };
  ciMult: number;
};

function collectFiniteRows(input: SmoothStatInput) {
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

function groupValues(input: SmoothStatInput, rows: number[]) {
  const x = new Float64Array(rows.length);
  const y = new Float64Array(rows.length);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < rows.length; i++) {
    x[i] = input.x[rows[i]!]!;
    y[i] = input.y[rows[i]!]!;
    if (x[i]! < min) min = x[i]!;
    if (x[i]! > max) max = x[i]!;
  }
  return { x, y, min, max };
}

function lmEvaluator(x: Float64Array, y: Float64Array, level: number): SmoothEvaluator | null {
  const n = x.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i]!;
    sy += y[i]!;
  }
  const xbar = sx / n;
  const ybar = sy / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - xbar;
    sxx += dx * dx;
    sxy += dx * (y[i]! - ybar);
  }
  const slope = sxy / sxx;
  const intercept = ybar - slope * xbar;
  let rss = 0;
  for (let i = 0; i < n; i++) {
    const error = y[i]! - (intercept + slope * x[i]!);
    rss += error * error;
  }
  const sigma = n > 2 ? Math.sqrt(rss / (n - 2)) : NaN;
  return {
    ciMult: qt((1 + level) / 2, n - 2),
    evaluate: (x0) => ({
      fit: intercept + slope * x0,
      seFit: sigma * Math.sqrt(1 / n + ((x0 - xbar) * (x0 - xbar)) / sxx),
    }),
  };
}

function makeEvaluator(
  method: "lm" | "loess",
  x: Float64Array,
  y: Float64Array,
  range: { min: number; max: number },
  options: { level: number; span: number; degree: 1 | 2; wantSE: boolean },
): SmoothEvaluator | null {
  if (method === "lm") {
    return range.min === range.max ? null : lmEvaluator(x, y, options.level);
  }
  const model = loessFit(x, y, {
    span: options.span,
    degree: options.degree,
    statistics: options.wantSE,
  });
  if (model === null) return null;
  return {
    ciMult: options.wantSE ? qt((1 + options.level) / 2, model.df) : NaN,
    evaluate: (x0: number) => ({
      fit: model.predict(x0),
      seFit: options.wantSE ? model.sigma * model.seNorm(x0) : NaN,
    }),
  };
}

type SmoothOutput = {
  x: number[];
  y: number[];
  ymin: number[];
  ymax: number[];
  se: number[];
  groups: number[];
  carried: Record<string, CellValue[]>;
};

function emitGrid(
  output: SmoothOutput,
  evaluator: SmoothEvaluator,
  group: number,
  rows: number[],
  range: { min: number; max: number },
  input: SmoothStatInput,
  options: { evalN: number; wantSE: boolean; carriedNames: string[] },
): void {
  const step = options.evalN === 1 ? 0 : (range.max - range.min) / (options.evalN - 1);
  const hasBand = options.wantSE && Number.isFinite(evaluator.ciMult);
  for (let k = 0; k < options.evalN; k++) {
    const x = range.min + k * step;
    const { fit, seFit } = evaluator.evaluate(x);
    output.x.push(x);
    output.y.push(fit);
    if (hasBand && Number.isFinite(seFit)) {
      output.ymin.push(fit - evaluator.ciMult * seFit);
      output.ymax.push(fit + evaluator.ciMult * seFit);
      output.se.push(seFit);
    } else {
      output.ymin.push(NaN);
      output.ymax.push(NaN);
      output.se.push(NaN);
    }
    output.groups.push(group);
    for (const name of options.carriedNames) {
      output.carried[name]!.push(input.carried![name]![rows[0]!]!);
    }
  }
}

export function statSmooth(input: SmoothStatInput): SmoothStatResult {
  const params = input.params ?? {};
  const level = params.level ?? 0.95;
  const wantSE = params.se ?? true;
  const evalN = params.n ?? 80;
  const span = params.span ?? 0.75;
  const degree = params.degree ?? 2;
  const carriedNames = Object.keys(input.carried ?? {});

  // Partition finite pairs per group (first-seen group order).
  const { order: groupOrder, rowsByGroup: groupRows, dropped } = collectFiniteRows(input);

  let maxGroup = 0;
  for (const rows of groupRows.values()) maxGroup = Math.max(maxGroup, rows.length);
  const methodInferred = params.method === undefined;
  const method = params.method ?? (maxGroup < 1000 ? "loess" : "lm");

  const outX: number[] = [];
  const outY: number[] = [];
  const outYmin: number[] = [];
  const outYmax: number[] = [];
  const outSE: number[] = [];
  const outGroups: number[] = [];
  const carried: Record<string, CellValue[]> = {};
  for (const name of carriedNames) carried[name] = [];
  let droppedGroups = 0;

  for (const g of groupOrder) {
    const rows = groupRows.get(g)!;
    const { x: gx, y: gy, min, max } = groupValues(input, rows);
    const evaluator = makeEvaluator(method, gx, gy, { min, max }, { level, span, degree, wantSE });
    if (evaluator === null) {
      droppedGroups++;
      continue;
    }
    emitGrid(
      {
        x: outX,
        y: outY,
        ymin: outYmin,
        ymax: outYmax,
        se: outSE,
        groups: outGroups,
        carried,
      },
      evaluator,
      g,
      rows,
      { min, max },
      input,
      { evalN, wantSE, carriedNames },
    );
  }

  return {
    x: Float64Array.from(outX),
    y: Float64Array.from(outY),
    ymin: Float64Array.from(outYmin),
    ymax: Float64Array.from(outYmax),
    se: Float64Array.from(outSE),
    hasBand: wantSE,
    groups: outGroups,
    carried,
    dropped,
    droppedGroups,
    methodUsed: method,
    methodInferred,
  };
}

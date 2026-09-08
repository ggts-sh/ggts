/**
 * The density stat (gaussian KDE; R-fixture-tested against stats::density).
 *
 * Stat output contract (plan: "Stat output contracts"):
 *  - required inputs: a CONTINUOUS x channel. y must NOT be mapped to data
 *    (validate() enforces `computed-y-mapped`).
 *  - generated columns: `density` (the KDE), `count` (density × group row
 *    count — ggplot2's count scaling), `scaled` and `ndensity` (density /
 *    max density per group). y defaults to `{ stat: "density" }`.
 *    `x` becomes the positional output (the evaluation grid).
 *  - grouping behavior: bandwidth, grid, and normalization are all PER
 *    GROUP (each group gets its own n-point grid over its own range).
 *  - missing-value policy (ggplot2 na.rm semantics): rows with missing /
 *    non-finite x are dropped and counted in `dropped` (pipeline warns
 *    `removed-missing`); groups with fewer than 2 finite points are dropped
 *    entirely (`droppedGroups`; pipeline warns `density-group-dropped`,
 *    mirroring ggplot2's "Groups with fewer than two data points have been
 *    dropped"). Missing weights count as 0.
 *  - algorithm: bandwidth = adjust × (params.bw ?? bw.nrd0(x)) with R's
 *    bw.nrd0 = 0.9 × min(sd, IQR/1.34) × n^(-1/5); grid = n (default 512)
 *    equally spaced points over [min − cut·bw, max + cut·bw] (cut default
 *    3 — R's density() defaults). The density is evaluated by DIRECT kernel
 *    summation (exact), where R uses a binned FFT approximation — the
 *    R-fixture tolerance quantifies that gap (decision 0010). DIVERGENCE
 *    from ggplot2: ggplot2 evaluates on the scale range (curves cut off at
 *    the data extremes); ggts keeps R's cut·bw tails so curves fall to
 *    ~0 (decision 0010).
 *  - weights (aes.weight): normalized to sum 1 within each group before
 *    estimation (R's requirement); `count` still scales by the unweighted
 *    row count, matching ggplot2.
 */
import type { CellValue } from "../table.js";
import { quantile7, sampleSD } from "./numeric.js";

interface DensityParamsInput {
  bw?: number | undefined;
  adjust?: number | undefined;
  n?: number | undefined;
  cut?: number | undefined;
}

export interface DensityStatInput {
  /** Numeric x view (NaN = missing). */
  x: Float64Array;
  /** Group id per input row. */
  groups: readonly number[];
  /** Optional weights (aes.weight). */
  weights?: Float64Array | null;
  /** Discrete carried columns (constant per group), e.g. the fill field. */
  carried?: Readonly<Record<string, readonly CellValue[]>>;
  params?: DensityParamsInput;
}

export interface DensityStatResult {
  /** Grid x per output row (n points per surviving group). */
  x: Float64Array;
  density: Float64Array;
  count: Float64Array;
  scaled: Float64Array;
  ndensity: Float64Array;
  groups: number[];
  carried: Record<string, CellValue[]>;
  /** Input rows dropped (missing / non-finite x). */
  dropped: number;
  /** Groups dropped for having fewer than two finite points. */
  droppedGroups: number;
}

/** R's bw.nrd0 (x must have >= 2 values). */
export function bwNRD0(sorted: Float64Array): number {
  const hi = sampleSD(sorted);
  const iqr = quantile7(sorted, 0.75) - quantile7(sorted, 0.25);
  let lo = Math.min(hi, iqr / 1.34);
  if (lo === 0) {
    if (hi === 0) {
      lo = Math.abs(sorted[0]!) === 0 ? 1 : Math.abs(sorted[0]!);
    } else {
      lo = hi;
    }
  }
  return 0.9 * lo * Math.pow(sorted.length, -0.2);
}

const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI);

/** Exact direct kernel sum over the ±8·bw window (small groups). */
function directWindowDensities(
  sorted: Float64Array,
  sortedW: Float64Array | null,
  bw: number,
  from: number,
  step: number,
  gridN: number,
  window: number,
  densities: Float64Array,
): void {
  const nx = sorted.length;
  let lo = 0;
  for (let k = 0; k < gridN; k++) {
    const x0 = from + k * step;
    while (lo < nx && sorted[lo]! < x0 - window) lo++;
    let d = 0;
    for (let j = lo; j < nx; j++) {
      const v = sorted[j]!;
      if (v > x0 + window) break;
      const z = (x0 - v) / bw;
      const kern = (INV_SQRT_2PI * Math.exp(-0.5 * z * z)) / bw;
      d += (sortedW === null ? 1 / nx : sortedW[j]!) * kern;
    }
    densities[k] = d;
  }
}

function collectFiniteRows(input: DensityStatInput) {
  const order: number[] = [];
  const rowsByGroup = new Map<number, number[]>();
  let dropped = 0;
  for (let i = 0; i < input.x.length; i++) {
    if (!Number.isFinite(input.x[i]!)) {
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

function normalizedWeights(weights: Float64Array | null | undefined, rows: number[]) {
  if (weights === null || weights === undefined) return null;
  const normalized = new Float64Array(rows.length);
  let sum = 0;
  for (let i = 0; i < rows.length; i++) {
    const weight = weights[rows[i]!]!;
    normalized[i] = Number.isFinite(weight) ? weight : 0;
    sum += normalized[i]!;
  }
  if (!(sum > 0)) return null;
  for (let i = 0; i < normalized.length; i++) normalized[i] = normalized[i]! / sum;
  return normalized;
}

function sortedValues(input: DensityStatInput, rows: number[]) {
  const values = new Float64Array(rows.length);
  for (let i = 0; i < rows.length; i++) values[i] = input.x[rows[i]!]!;
  const weights = normalizedWeights(input.weights, rows);
  const order = Array.from({ length: rows.length }, (_, i) => i).toSorted(
    (a, b) => values[a]! - values[b]!,
  );
  const sorted = new Float64Array(rows.length);
  const sortedWeights = weights === null ? null : new Float64Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    sorted[i] = values[order[i]!]!;
    if (sortedWeights !== null) sortedWeights[i] = weights![order[i]!]!;
  }
  return { sorted, sortedWeights };
}

function binnedDensities(
  sorted: Float64Array,
  sortedWeights: Float64Array | null,
  bw: number,
  from: number,
  step: number,
  gridN: number,
  window: number,
): Float64Array {
  const densities = new Float64Array(gridN);
  const binned = new Float64Array(gridN);
  for (let j = 0; j < sorted.length; j++) {
    const t = (sorted[j]! - from) / step;
    const i0 = Math.floor(t);
    const fraction = t - i0;
    const weight = sortedWeights === null ? 1 / sorted.length : sortedWeights[j]!;
    if (i0 >= 0 && i0 < gridN) binned[i0] = binned[i0]! + weight * (1 - fraction);
    if (fraction > 0 && i0 + 1 < gridN) {
      binned[i0 + 1] = binned[i0 + 1]! + weight * fraction;
    }
  }
  const support = Math.min(gridN - 1, Math.ceil(window / step));
  const taps = new Float64Array(support + 1);
  for (let offset = 0; offset <= support; offset++) {
    const z = (offset * step) / bw;
    taps[offset] = (INV_SQRT_2PI * Math.exp(-0.5 * z * z)) / bw;
  }
  for (let k = 0; k < gridN; k++) {
    const lo = Math.max(0, k - support);
    const hi = Math.min(gridN - 1, k + support);
    let density = 0;
    for (let j = lo; j <= hi; j++) density += binned[j]! * taps[Math.abs(k - j)]!;
    densities[k] = density;
  }
  return densities;
}

function densityGrid(
  sorted: Float64Array,
  sortedWeights: Float64Array | null,
  bw: number,
  from: number,
  step: number,
  gridN: number,
): Float64Array {
  const window = 8 * bw;
  if (sorted.length > 4 * gridN && step > 0 && step <= bw / 4) {
    return binnedDensities(sorted, sortedWeights, bw, from, step, gridN, window);
  }
  const densities = new Float64Array(gridN);
  directWindowDensities(sorted, sortedWeights, bw, from, step, gridN, window, densities);
  return densities;
}

export function statDensity(input: DensityStatInput): DensityStatResult {
  const params = input.params ?? {};
  const gridN = params.n ?? 512;
  const cut = params.cut ?? 3;
  const adjust = params.adjust ?? 1;
  const carriedNames = Object.keys(input.carried ?? {});

  // Partition finite rows per group (first-seen group order).
  const { order: groupOrder, rowsByGroup: groupRows, dropped } = collectFiniteRows(input);

  const outX: number[] = [];
  const outDensity: number[] = [];
  const outCount: number[] = [];
  const outScaled: number[] = [];
  const outGroups: number[] = [];
  const carried: Record<string, CellValue[]> = {};
  for (const name of carriedNames) carried[name] = [];
  let droppedGroups = 0;

  for (const g of groupOrder) {
    const rows = groupRows.get(g)!;
    if (rows.length < 2) {
      droppedGroups++;
      continue;
    }
    const nx = rows.length;
    // Sort values (weights follow) so each grid point only visits the
    // ±8·bw window — the gaussian kernel is < 1.3e-14 beyond it, so the
    // cut is exact to double precision (unlike R's FFT binning).
    const { sorted, sortedWeights } = sortedValues(input, rows);
    const bw = adjust * (params.bw ?? bwNRD0(sorted));
    const from = sorted[0]! - cut * bw;
    const to = sorted[nx - 1]! + cut * bw;
    const step = gridN === 1 ? 0 : (to - from) / (gridN - 1);

    // Density per grid node. Large groups (well above the grid size) use
    // linear binning onto the grid + an exact discrete gaussian
    // convolution — O(nx + gridN × taps) instead of O(nx × gridN) pairwise
    // kernel evaluations. Binning conserves mass; the taps are the same
    // kernel values the direct window sum uses (gauss(m·step/bw)/bw,
    // truncated at ±8·bw), so the paths agree to binning error (well under
    // the 5e-4 R-parity tolerance — R itself approximates by binned FFT).
    // The resolution guard matters as much as the size guard: binning is
    // equivalent to widening the bandwidth by sqrt(bw² + step²/6), so a
    // user-coarsened grid (step ≈ bw) would over-smooth by percent levels.
    // step ≤ bw/4 bounds that widening to ~0.5%; coarse grids are cheap
    // for the direct path anyway (gridN small).
    const densities = densityGrid(sorted, sortedWeights, bw, from, step, gridN);

    let maxDensity = 0;
    for (let k = 0; k < gridN; k++) if (densities[k]! > maxDensity) maxDensity = densities[k]!;
    const base = outX.length;
    for (let k = 0; k < gridN; k++) {
      const d = densities[k]!;
      outX.push(from + k * step);
      outDensity.push(d);
      outCount.push(d * nx);
      outGroups.push(g);
      for (const name of carriedNames) {
        carried[name]!.push(input.carried![name]![rows[0]!]!);
      }
    }
    for (let k = 0; k < gridN; k++) {
      outScaled.push(maxDensity > 0 ? outDensity[base + k]! / maxDensity : 0);
    }
  }

  return {
    x: Float64Array.from(outX),
    density: Float64Array.from(outDensity),
    count: Float64Array.from(outCount),
    scaled: Float64Array.from(outScaled),
    ndensity: Float64Array.from(outScaled),
    groups: outGroups,
    carried,
    dropped,
    droppedGroups,
  };
}

/**
 * Shared numeric helpers for the statistical layer. Float64 throughout.
 *
 * - `quantile7`: R's default quantile algorithm (type 7) — the boxplot stat's
 *   hinge rule and bw.nrd0's IQR both depend on it.
 * - `qt`: Student-t quantile via the inverse regularized incomplete beta
 *   (Numerical Recipes' continued fraction + Halley refinement). Matches R's
 *   qt to ~1e-10 over the df/level ranges the smooth stat uses (unit-tested
 *   against R values).
 * - `resolution`: ggplot2's resolution() — the smallest positive gap between
 *   distinct finite values (jitter's default amount is 40% of it).
 * - `mulberry32`: the repo-standard seeded PRNG (same as examples/rng.ts and
 *   the benchmarks) — the jitter position's determinism source.
 */

/** Seeded PRNG (mulberry32). Deterministic across runs and platforms. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Arithmetic mean of a (non-empty) array. */
export function mean(values: readonly number[] | Float64Array): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i]!;
  return sum / values.length;
}

/** Sample standard deviation (n - 1 denominator, like R's sd). */
export function sampleSD(values: readonly number[] | Float64Array): number {
  const n = values.length;
  if (n < 2) return NaN;
  const m = mean(values);
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i]! - m;
    ss += d * d;
  }
  return Math.sqrt(ss / (n - 1));
}

/**
 * R's type-7 quantile (the R default): h = (n - 1)p + 1 over the SORTED
 * values, linearly interpolated. `sorted` must be ascending and non-empty.
 */
export function quantile7(sorted: readonly number[] | Float64Array, p: number): number {
  const n = sorted.length;
  if (n === 1) return sorted[0]!;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  const frac = h - lo;
  return sorted[lo]! + frac * (sorted[hi]! - sorted[lo]!);
}

/**
 * ggplot2's resolution(): the smallest positive difference between distinct
 * finite values. Returns 0 when there are fewer than two distinct values
 * (jitter then adds no offset — nothing to jitter within).
 *
 * Unique-first (Set) then sort U: O(R + U log U) instead of sorting the full
 * multiset O(R log R). Duplicates never affect the min positive gap.
 */
export function resolution(values: readonly number[] | Float64Array): number {
  const unique: number[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!Number.isFinite(v) || seen.has(v)) continue;
    seen.add(v);
    unique.push(v);
  }
  if (unique.length < 2) return 0;
  unique.sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < unique.length; i++) {
    const d = unique[i]! - unique[i - 1]!;
    if (d > 0 && d < min) min = d;
  }
  return Number.isFinite(min) ? min : 0;
}

/** Default tile span on a quantitative axis, including one-value domains. */
export function tileResolution(values: Float64Array | null): number {
  if (values === null || values.length === 0) return 1;
  return resolution(values) || 1;
}

// ---------------------------------------------------------------------------
// Student-t quantile (qt) via the inverse regularized incomplete beta
// ---------------------------------------------------------------------------

/** ln Γ(x) (Lanczos approximation, |error| < 3e-11 for x > 0). */
function lgamma(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941678, 24.01409824083091, -1.231739572450155,
    1.208650973866179e-3, -5.395239384953e-6,
  ];
  const xx = x;
  let tmp = xx + 5.5;
  tmp -= (xx + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j]! / (xx + 1 + j);
  return -tmp + Math.log((2.5066282746310007 * ser) / xx);
}

/** Continued fraction for the incomplete beta (Numerical Recipes betacf). */
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Inverse of I_x(a, b): find x with I_x(a, b) = p (Halley iteration, NR). */
function inverseIncompleteBeta(p: number, a: number, b: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const a1 = a - 1;
  const b1 = b - 1;
  let x: number;
  if (a >= 1 && b >= 1) {
    const pp = p < 0.5 ? p : 1 - p;
    const t = Math.sqrt(-2 * Math.log(pp));
    let xg = (2.30753 + t * 0.27061) / (1 + t * (0.99229 + t * 0.04481)) - t;
    if (p < 0.5) xg = -xg;
    const al = (xg * xg - 3) / 6;
    const h = 2 / (1 / (2 * a - 1) + 1 / (2 * b - 1));
    const w =
      (xg * Math.sqrt(al + h)) / h -
      (1 / (2 * b - 1) - 1 / (2 * a - 1)) * (al + 5 / 6 - 2 / (3 * h));
    x = a / (a + b * Math.exp(2 * w));
  } else {
    const lna = Math.log(a / (a + b));
    const lnb = Math.log(b / (a + b));
    const t = Math.exp(a * lna) / a;
    const u = Math.exp(b * lnb) / b;
    const w = t + u;
    x = p < t / w ? Math.pow(a * w * p, 1 / a) : 1 - Math.pow(b * w * (1 - p), 1 / b);
  }
  const afac = -lgamma(a) - lgamma(b) + lgamma(a + b);
  for (let j = 0; j < 10; j++) {
    if (x === 0 || x === 1) return x;
    const err = incompleteBeta(a, b, x) - p;
    let t = Math.exp(a1 * Math.log(x) + b1 * Math.log(1 - x) + afac);
    const u = err / t;
    t = u / (1 - 0.5 * Math.min(1, u * (a1 / x - b1 / (1 - x))));
    x -= t;
    if (x <= 0) x = 0.5 * (x + t);
    if (x >= 1) x = 0.5 * (x + t + 1);
    if (Math.abs(t) < 1e-14 * x && j > 0) break;
  }
  return x;
}

/**
 * Student-t quantile: qt(p, df), p in (0, 1), df > 0 — R's qt. Used for
 * confidence multipliers (lm exactly; loess with the documented df).
 */
export function qt(p: number, df: number): number {
  if (Number.isNaN(p) || Number.isNaN(df) || df <= 0) return NaN;
  if (p === 0.5) return 0;
  const tail = p < 0.5 ? p : 1 - p; // one-sided tail mass
  const x = inverseIncompleteBeta(2 * tail, df / 2, 0.5);
  const t = Math.sqrt((df * (1 - x)) / x);
  return p < 0.5 ? -t : t;
}

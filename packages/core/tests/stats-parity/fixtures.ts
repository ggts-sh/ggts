/**
 * Shared helpers for ggplot2/R parity of the M2 statistical layer, against the
 * R-generated fixtures in tests/fixtures/stats (regenerate with
 * `Rscript packages/core/tests/fixtures/stats/generate.R`).
 *
 * Tolerances (measured, decision 0010):
 *  - qt / lm / loess(surface="direct", statistics="exact"): float noise —
 *    asserted at 1e-9 (measured ≤ ~2e-13 abs).
 *  - loess vs ggplot2's DEFAULT loess (surface="interpolate",
 *    statistics="approximate"), small n (still on ggts direct/exact):
 *    measured max relative deviation 0.53% (fit), 0.94% (band), 3.4% (se);
 *    asserted at 1% / 1.5% / 4% relative.
 *  - loess large-n interpolate path (n > INTERPOLATE_DIRECT_LIMIT, fixture
 *    25, n=1200): fit ≤ ~6e-5 rel vs R default; band ≤ ~0.35%; se ≤ ~10%
 *    (approximate δ + blended ‖l‖). Asserted at 0.1% / 1% / 12%.
 *  - density vs R's binned-FFT stats::density(): ggts sums the kernel
 *    directly (exact); measured max relative deviation ~2.6e-4; asserted at
 *    5e-4 relative. Bandwidth (bw.nrd0) and grid endpoints are exact (1e-9).
 *  - bin / boxplot / summary: exact algorithms — 1e-9.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { CellValue } from "../../src/table.ts";

const dir = join(import.meta.dir, "..", "fixtures", "stats");

export interface Fixture {
  case: string;
  data: Record<string, CellValue[]>;
  expected: Record<string, number | string | number[]>[];
}

export function load<T = Fixture>(name: string): T {
  return JSON.parse(readFileSync(join(dir, name), "utf8")) as T;
}

/** Max |a - b| relative to the max |expected| (band-scale-aware tolerance). */
export function maxRelDiff(expected: number[], actual: ArrayLike<number>): number {
  let scale = 0;
  for (const v of expected) scale = Math.max(scale, Math.abs(v));
  let rel = 0;
  for (let i = 0; i < expected.length; i++) {
    rel = Math.max(rel, Math.abs(expected[i]! - (actual[i] as number)) / (scale || 1));
  }
  return rel;
}

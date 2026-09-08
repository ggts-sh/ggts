/**
 * `type: "binned"` position family — pre-stat transformed-space boundaries with
 * a stable integer bin id kept separate from the rendered transformed center.
 *
 * Two-phase contract:
 *  1. Before stats, automatic boundaries are chosen in TRANSFORMED space (or
 *     explicit `breaks`, semantic values transformed exactly once); each valid
 *     transformed input gets (a) a STABLE INTEGER BIN ID and (b) a snap to its
 *     bin's transformed CENTER. Continuous readers (frame-identity, the affine
 *     trainer, geometry) see the transformed center; discrete consumers (count
 *     aggregation, stack/fill/dodge grouping) key off the integer id.
 *  2. Right-closed bins with an inclusive lowest bound are the fixed initial
 *     policy: bin 0 covers [edges[0], edges[1]], bin i>0 covers
 *     (edges[i], edges[i+1]].
 *
 * The integer id never leaves the pipeline: after aggregation, count restores
 * transformed centers (rendered) and their semantic inverse-center values
 * (tooltips/candidates); identity marks keep raw source tooltip values. No bin
 * id reaches the public RenderModel, GuidePlan, candidates, or zoom.
 *
 * Stats that need CONTINUOUS inputs (bin/density/smooth/summary/boxplot)
 * ignore the boundaries entirely and read transformed SOURCE values.
 */
import { MAX_BINNED_BREAKS } from "@ggts-sh/spec";

import { tickStep } from "../layout/ticks.js";
import type { ScaleTransform } from "../scales/transform.js";

import { PipelineError } from "./types.js";

/**
 * Hard cap on automatic/explicit binned bins — re-exported from `@ggts-sh/spec`
 * so the TypeBox schema (`breaks` maxItems), this runtime resolver, and the
 * `binned-scale-break-limit` error share one source of truth (no dependency
 * cycle: spec never imports core).
 */
export { MAX_BINNED_BREAKS };

/** Target automatic bin count before capping (ggplot2-ish default granularity). */
const DEFAULT_BIN_COUNT = 10;

export interface BinnedBoundaries {
  /** Transformed-space bin edges, ascending, length = bin count + 1. */
  readonly edges: readonly number[];
  /** Transformed-space bin centers, length = bin count. */
  readonly centers: readonly number[];
}

/**
 * Resolve transformed-space bin boundaries from either explicit (already
 * forward-transformed once) breaks or the finite extent of the transformed
 * data. Returns `null` for an empty/degenerate extent (no finite evidence).
 */
export function resolveBinnedBoundaries(
  transformedExtent: readonly [number, number] | null,
  explicitEdges: readonly number[] | null,
  axis: "x" | "y" = "x",
): BinnedBoundaries | null {
  if (explicitEdges !== null) {
    const edges = [...new Set(explicitEdges.filter((v) => Number.isFinite(v)))].toSorted(
      (a, b) => a - b,
    );
    if (edges.length < 2) return null;
    if (edges.length - 1 > MAX_BINNED_BREAKS) {
      throw new PipelineError(
        "binned-scale-break-limit",
        `/scales/${axis}`,
        `A binned scale's explicit breaks produce ${edges.length - 1} bins, exceeding the MAX_BINNED_BREAKS limit of ${MAX_BINNED_BREAKS}.`,
      );
    }
    return { edges, centers: centersOf(edges) };
  }
  if (transformedExtent === null) return null;
  const [lo, hi] = transformedExtent;
  if (lo === hi) return { edges: [lo - 0.5, hi + 0.5], centers: [lo] };
  let step = tickStep(lo, hi, DEFAULT_BIN_COUNT);
  if (!Number.isFinite(step) || step <= 0) return { edges: [lo, hi], centers: [(lo + hi) / 2] };
  let edges = edgesFor(lo, hi, step);
  // Widen the step until the automatic grid respects the cap (defensive —
  // DEFAULT_BIN_COUNT is far under MAX_BINNED_BREAKS in practice).
  while (edges.length - 1 > MAX_BINNED_BREAKS) {
    step *= 2;
    edges = edgesFor(lo, hi, step);
  }
  return { edges, centers: centersOf(edges) };
}

function edgesFor(lo: number, hi: number, step: number): number[] {
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const edges: number[] = [];
  for (let e = start; e <= end + step / 2; e += step) edges.push(e);
  return edges;
}

function centersOf(edges: readonly number[]): number[] {
  const centers: number[] = [];
  for (let i = 0; i < edges.length - 1; i++) centers.push((edges[i]! + edges[i + 1]!) / 2);
  return centers;
}

/** Snap every value in a transformed-space column to its bin center. */
export function snapColumnToBins(
  values: Float64Array,
  boundaries: BinnedBoundaries | undefined,
): Float64Array {
  if (boundaries === undefined) return values;
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = assignBinCenter(values[i]!, boundaries);
  return out;
}

/**
 * Assign a transformed value to its stable integer bin id (right-closed,
 * inclusive lowest bound). Returns −1 for non-finite or out-of-range input.
 *
 * The integer id — never the rendered float center — is the discrete identity
 * consumed by count aggregation and stack/fill/dodge grouping, so no bin index
 * ever leaks into rendered positions, tooltips, guides, or zoom.
 */
export function assignBinId(value: number, boundaries: BinnedBoundaries): number {
  if (!Number.isFinite(value)) return -1;
  const { edges } = boundaries;
  const lo = edges[0]!;
  const hi = edges.at(-1)!;
  if (value < lo || value > hi) return -1;
  if (value === lo) return 0;
  // Binary search for the first edge >= value; that edge closes the bin.
  let low = 1;
  let high = edges.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (edges[mid]! < value) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}

/** Snap a transformed value to its bin's transformed center; NaN if unbinned. */
function assignBinCenter(value: number, boundaries: BinnedBoundaries): number {
  const id = assignBinId(value, boundaries);
  return id < 0 ? Number.NaN : boundaries.centers[id]!;
}

/**
 * Smallest transformed bin width — the jitter/resolution proxy for a binned
 * scale. Well-defined even when the data occupies a single bin (where the
 * resolution of the snapped centers would collapse to 0). Matches ggplot2's
 * resolution-of-centers when every bin is occupied.
 */
export function minBinWidth(boundaries: BinnedBoundaries): number {
  const { edges } = boundaries;
  let min = Number.POSITIVE_INFINITY;
  for (let i = 1; i < edges.length; i++) {
    const w = edges[i]! - edges[i - 1]!;
    if (w > 0 && w < min) min = w;
  }
  return Number.isFinite(min) ? min : 0;
}

/** Stable integer bin id per row (−1 = out of range / non-finite). */
export function binIdColumn(values: Float64Array, boundaries: BinnedBoundaries): Int32Array {
  const out = new Int32Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = assignBinId(values[i]!, boundaries);
  return out;
}

/** Resolve explicit `breaks` (semantic) into transformed edges, once. */
export function transformExplicitBreaks(
  breaks: readonly number[] | undefined,
  transform: ScaleTransform,
): readonly number[] | null {
  if (breaks === undefined) return null;
  return breaks
    .filter((v) => Number.isFinite(v) && transform.valid(v))
    .map((v) => transform.forward(v));
}

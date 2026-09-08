/**
 * Shared workload table for the benchmark suite. ONE source of truth for
 * three consumers:
 *
 * - `pipeline.bench.ts` (mitata full suite + BENCH_SMOKE) — groups/benches
 *   are rebuilt from this table with the exact pre-M3 labels.
 * - `bench-json.ts` (M3) — runs the full-size workloads with a bounded
 *   deterministic-ish loop and emits `bench-results.json` (repo root) in
 *   github-action-benchmark customSmallerIsBetter format.
 * - `check-budgets.ts` (M3) — gates those results against
 *   `budgets.json`; `Workload.id` is the stable identifier both files key on.
 *
 * Chart fixtures live in `../workload-specs.ts`. Domain registry slices live
 * in sibling modules here; this file concatenates them in fixed order so
 * mitata group order and budget ids stay byte-stable.
 */
import { registerAll } from "@ggts-sh/core";

// Headless full-grammar benchmarks (#1420): explicit opt-in before the
// workload table builds stats/temporal fixtures.
registerAll();

export type { Workload } from "./shared";

import { registerCanvasWorkloads } from "./canvas";
import { registerColorWorkloads } from "./color";
import { registerCoordFixedWorkloads, registerCoordWorkloads } from "./coord";
import { registerGuideWorkloads } from "./guides";
import { registerScatterWorkloads } from "./scatter";
import { registerSeriesWorkloads } from "./series";
import type { Workload } from "./shared";
import { registerStatsWorkloads } from "./stats";
import { registerStyleWorkloads } from "./style";
import { registerTemporalWorkloads } from "./temporal";
import { registerTransformWorkloads } from "./transform";

/**
 * Build the workload list. `smoke` shrinks sizes (the CI bench-smoke job);
 * the JSON/budget path always uses `smoke = false` so ids are stable.
 * Order and labels mirror the pre-M3 mitata suite exactly.
 *
 * Concatenation order is the contract — do not reorder slices without
 * updating smoke/full catalog freezes and budgets.json.
 */
export function buildWorkloads(smoke: boolean): Workload[] {
  return [
    ...registerScatterWorkloads(smoke),
    ...registerTemporalWorkloads(smoke),
    ...registerSeriesWorkloads(smoke),
    ...registerCanvasWorkloads(smoke),
    ...registerTransformWorkloads(smoke),
    ...registerCoordWorkloads(smoke),
    ...registerColorWorkloads(smoke),
    ...registerStyleWorkloads(smoke),
    ...registerGuideWorkloads(smoke),
    ...registerCoordFixedWorkloads(smoke),
    ...registerStatsWorkloads(smoke),
  ];
}

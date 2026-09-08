import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { registerAll, runPipeline } from "@ggts-sh/core";

// Headless full-grammar fixtures (#1420): explicit opt-in.
registerAll();

import { createInspectionCoordinator } from "../packages/svelte/src/lib/inspection/resolver";
import { buildWorkloads } from "./workloads";

export interface MemoryBaselineFile {
  version: 1;
  baselines: Record<string, MemoryBudget>;
}

export interface MemoryBudget {
  readonly maxRetainedBytes: number;
  readonly baselinePlatform?: string;
  readonly baselineRetainedBytes?: number;
  readonly maxRegressionRatio?: number;
}

export interface MemoryResult {
  name: string;
  unit: "bytes";
  value: number;
  samples: number[];
}

function collect(): void {
  Bun.gc(true);
}

function measuredBytes(): number {
  const memory = process.memoryUsage();
  return memory.heapUsed + memory.external + memory.arrayBuffers;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("median requires at least one sample");
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

interface RetainedWorkload {
  id: string;
  fn: () => unknown;
}

export function findRetainedWorkload(workloads: readonly RetainedWorkload[]): RetainedWorkload {
  const workload = workloads.find(({ id }) => id === "pipeline scatter 100k");
  if (!workload) throw new Error("retained-memory workload is missing");
  return workload;
}

export function findMemoryBudget(baselines: MemoryBaselineFile, resultName: string): MemoryBudget {
  const budget = baselines.baselines[resultName]?.maxRetainedBytes;
  if (budget === undefined) throw new Error(`missing memory baseline for ${resultName}`);
  return baselines.baselines[resultName]!;
}

export function effectiveMemoryBudget(budget: MemoryBudget): number {
  const regressionBudget =
    budget.baselineRetainedBytes === undefined || budget.maxRegressionRatio === undefined
      ? Infinity
      : Math.round(budget.baselineRetainedBytes * budget.maxRegressionRatio);
  return Math.min(budget.maxRetainedBytes, regressionBudget);
}

export function assertWithinBudget(
  result: Pick<MemoryResult, "name" | "value">,
  configuredBudget: MemoryBudget,
): void {
  const budget = effectiveMemoryBudget(configuredBudget);
  if (result.value > budget) {
    throw new Error(`${result.name} retained ${result.value} bytes; budget is ${budget}`);
  }
}

/**
 * Measures bytes retained by a live result after a forced collection. Values
 * are medians because allocator/GC noise makes a single heap delta useless.
 */
export function measureRetainedBytes(
  create: () => unknown,
  sampleCount = 5,
  name = "pipeline scatter 100k retained",
): MemoryResult {
  const samples: number[] = [];
  const retainedValues: unknown[] = [];
  create();
  collect();

  for (let index = 0; index < sampleCount; index++) {
    collect();
    const before = measuredBytes();
    retainedValues.push(create());
    collect();
    samples.push(Math.max(0, measuredBytes() - before));
    retainedValues.pop();
    collect();
  }

  return { name, unit: "bytes", value: median(samples), samples };
}

export function createGroupedInspectionRetentionFixture() {
  type Row = { id: string; x: number; y: number; series: string };
  const rows: Row[] = Array.from({ length: 1_000 }, (_, index) => ({
    id: `row-${String(index)}`,
    x: 1,
    y: index,
    series: `series-${String(index)}`,
  }));
  const model = runPipeline(
    {
      data: { values: rows },
      aes: {
        x: { field: "x" },
        y: { field: "y" },
        group: { field: "series" },
      },
      layers: [{ geom: "point" }],
    },
    { width: 800, height: 500 },
  );
  const seed = model.candidates.candidate(0);
  if (seed === null) throw new Error("grouped inspection retention seed is missing");
  const coordinator = createInspectionCoordinator<Row, string>((index) => {
    const row = model.row(index) as Row | null;
    return row === null ? null : row.id;
  });
  const shared = {
    model,
    seed,
    mode: "x" as const,
    source: "programmatic" as const,
    identityEpoch: "grouped-1k",
    layoutEpoch: model.runId,
  };
  const transient = coordinator.resolve({
    ...shared,
    state: "transient",
    completeness: "transient",
  });
  const pinned = coordinator.resolve({
    ...shared,
    state: "pinned",
    completeness: "complete",
  });
  if (transient === null || pinned === null) {
    model.dispose();
    throw new Error("grouped inspection retention target is missing");
  }
  // Keep the rich values live as one returned object so forced-GC deltas
  // measure the complete two-slot adapter boundary, not temporary locals.
  return { model, coordinator, transient, pinned } as const;
}

function main(): void {
  const workload = findRetainedWorkload(buildWorkloads(false));
  const cases = [
    {
      name: "pipeline scatter 100k retained",
      create: workload.fn,
    },
    {
      name: "grouped inspection 1k two-slot retained",
      create: createGroupedInspectionRetentionFixture,
    },
  ] as const;
  const results = cases.map(({ name, create }) => measureRetainedBytes(create, 5, name));
  const baselines = JSON.parse(
    readFileSync(new URL("./memory-baselines.json", import.meta.url), "utf8"),
  ) as MemoryBaselineFile;
  for (const result of results) {
    const configuredBudget = findMemoryBudget(baselines, result.name);
    const budget = effectiveMemoryBudget(configuredBudget);
    const mib = (result.value / 1024 / 1024).toFixed(2);
    const budgetMib = (budget / 1024 / 1024).toFixed(2);
    console.log(`${result.name}: ${mib} MiB retained (budget ${budgetMib} MiB)`);
    if (process.argv.includes("--check")) assertWithinBudget(result, configuredBudget);
  }

  if (process.argv.includes("--check")) return;

  const output = fileURLToPath(new URL("./results/retained-memory.json", import.meta.url));
  mkdirSync(fileURLToPath(new URL("./results", import.meta.url)), { recursive: true });
  writeFileSync(output, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`wrote ${output}`);
}

if (import.meta.main) main();

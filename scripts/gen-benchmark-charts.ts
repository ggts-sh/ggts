/**
 * Emit bun-style benchmark-vs-peers charts for the docs homepage and README.
 *
 * CLI entry + orchestration; implementation lives in scripts/benchmark-charts/*.
 *
 *   bun scripts/gen-benchmark-charts.ts
 *   bun scripts/gen-benchmark-charts.ts --check
 */

import { benchmarkChartArtifacts } from "./benchmark-charts/artifacts.ts";

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const artifacts = await benchmarkChartArtifacts(
    undefined,
    !check && process.argv.includes("--publish"),
  );
  await artifacts.cli();
}

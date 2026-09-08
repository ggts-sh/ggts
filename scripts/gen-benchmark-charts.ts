/**
 * Emit bun-style benchmark-vs-peers charts for the docs homepage and README.
 *
 * CLI entry + orchestration; implementation lives in scripts/benchmark-charts/*.
 *
 *   bun scripts/gen-benchmark-charts.ts
 *   bun scripts/gen-benchmark-charts.ts --check
 */

import { check } from "./benchmark-charts/check";
import { write } from "./benchmark-charts/write";

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    await check();
  } else {
    await write(process.argv.includes("--publish"));
  }
}

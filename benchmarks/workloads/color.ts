import { runPipeline } from "@ggts-sh/core";

import { nonPositionColorSpec } from "../workload-specs";
import { fmtK, opts, type Workload } from "./shared";

export function registerColorWorkloads(smoke: boolean): Workload[] {
  const workloads: Workload[] = [];

  {
    const n = smoke ? 1_000 : 100_000;
    for (const family of ["log10", "binned", "manual"] as const) {
      const spec = nonPositionColorSpec(n, family);
      workloads.push({
        id: `pipeline color-${family} ${fmtK(n)}`,
        group: `non-position color ${family} ${fmtK(n)}`,
        bench: `runPipeline color ${family} ${fmtK(n)}`,
        fn: () => runPipeline(spec, opts),
      });
    }
  }

  return workloads;
}

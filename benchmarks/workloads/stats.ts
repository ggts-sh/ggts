import { runPipeline } from "@ggts-sh/core";

import { densitySpec, histogramSpec, loessSpec } from "../workload-specs";
import { fmtK, opts, type Workload } from "./shared";

export function registerStatsWorkloads(smoke: boolean): Workload[] {
  const workloads: Workload[] = [];

  {
    const n = smoke ? 1_000 : 100_000;
    const spec = histogramSpec(n);
    workloads.push({
      id: `pipeline histogram ${fmtK(n)}`,
      group: `histogram ${fmtK(n)}`,
      bench: `runPipeline histogram ${fmtK(n)}`,
      fn: () => runPipeline(spec, opts),
    });
  }

  {
    const n = smoke ? 500 : 5_000;
    const spec = loessSpec(n);
    workloads.push({
      id: `pipeline loess ${fmtK(n)}`,
      group: `loess smooth ${n} rows`,
      bench: `runPipeline loess+se ${n} rows`,
      fn: () => runPipeline(spec, opts),
    });
  }

  {
    const n = smoke ? 1_000 : 100_000;
    const spec = densitySpec(n);
    workloads.push({
      id: `pipeline density ${fmtK(n)}`,
      group: `density ${fmtK(n)}`,
      bench: `runPipeline density ${fmtK(n)}`,
      fn: () => runPipeline(spec, opts),
    });
  }

  return workloads;
}

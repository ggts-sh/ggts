import { runPipeline } from "@ggts-sh/core";
import { MAX_BINNED_BREAKS } from "@ggts-sh/spec";

import {
  maxBoundaryBinnedSpec,
  transformedFacetSpec,
  transformedScatterSpec,
  transformedStatsSpec,
} from "../workload-specs";
import { fmtK, opts, type Workload } from "./shared";

export function registerTransformWorkloads(smoke: boolean): Workload[] {
  const workloads: Workload[] = [];

  {
    const n = smoke ? 1_000 : 100_000;
    for (const transform of ["identity", "log10", "sqrt"] as const) {
      const spec = transformedScatterSpec(n, transform);
      workloads.push({
        id: `pipeline transform-${transform} ${fmtK(n)}`,
        group: `position transform ${transform} ${fmtK(n)}`,
        bench: `runPipeline transform ${transform} ${fmtK(n)}`,
        fn: () => runPipeline(spec, opts),
      });
    }
    for (const stat of ["smooth", "bin"] as const) {
      const spec = transformedStatsSpec(n, stat);
      workloads.push({
        id: `pipeline transform-log10 ${stat} ${fmtK(n)}`,
        group: `pre-stat log10 ${stat} ${fmtK(n)}`,
        bench: `runPipeline log10 ${stat} ${fmtK(n)}`,
        fn: () => runPipeline(spec, opts),
      });
    }
    const facets = transformedFacetSpec(n, smoke ? 10 : 100);
    workloads.push({
      id: `pipeline transform-log10 facets-${smoke ? "10" : "100"} ${fmtK(n)}`,
      group: `shared transform cache ${smoke ? "10" : "100"} facets ${fmtK(n)}`,
      bench: `runPipeline log10 shared facets ${fmtK(n)}`,
      fn: () => runPipeline(facets, { ...opts, width: 1_200, height: 900 }),
    });
    const binned = maxBoundaryBinnedSpec(n);
    workloads.push({
      id: `pipeline binned-${MAX_BINNED_BREAKS} ${fmtK(n)}`,
      group: `binned ${MAX_BINNED_BREAKS} boundaries ${fmtK(n)}`,
      bench: `runPipeline max-boundary binned ${fmtK(n)}`,
      fn: () => runPipeline(binned, opts),
    });
  }

  return workloads;
}

import { renderToSVGString, runPipeline } from "@ggts-sh/core";

import { scatterSpec } from "../workload-specs";
import { fmtK, opts, type Workload } from "./shared";

export function registerScatterWorkloads(smoke: boolean): Workload[] {
  const workloads: Workload[] = [];
  const sizes = smoke ? [1_000] : [1_000, 10_000, 100_000];

  for (const n of sizes) {
    const spec = scatterSpec(n);
    const label = `${fmtK(n)} points`;
    workloads.push(
      {
        id: `pipeline scatter ${fmtK(n)}`,
        group: label,
        bench: `runPipeline ${label}`,
        fn: () => runPipeline(spec, opts),
      },
      {
        id: `svg render scatter ${fmtK(n)}`,
        group: label,
        bench: `renderToSVGString ${label}`,
        fn: () => renderToSVGString(spec, opts),
      },
    );
  }

  return workloads;
}

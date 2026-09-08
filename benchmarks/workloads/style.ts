import { runPipeline } from "@ggts-sh/core";

import { mappedStyleSpec } from "../workload-specs";
import { fmtK, opts, type Workload } from "./shared";

export function registerStyleWorkloads(smoke: boolean): Workload[] {
  const workloads: Workload[] = [];

  {
    const n = smoke ? 1_000 : 100_000;
    const spec = mappedStyleSpec(n);
    workloads.push({
      id: `pipeline mapped-style ${fmtK(n)}`,
      group: `mapped style vectors ${fmtK(n)}`,
      bench: `runPipeline mapped style vectors ${fmtK(n)}`,
      fn: () => runPipeline(spec, opts),
    });
  }

  return workloads;
}

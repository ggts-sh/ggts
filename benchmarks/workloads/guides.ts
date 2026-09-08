import { runPipeline } from "@ggts-sh/core";

import { responsiveGuideSpec } from "../workload-specs";
import { fmtK, opts, type Workload } from "./shared";

export function registerGuideWorkloads(smoke: boolean): Workload[] {
  const workloads: Workload[] = [];

  {
    const n = smoke ? 1_000 : 10_000;
    const spec = responsiveGuideSpec(n);
    let narrow = false;
    workloads.push({
      id: `pipeline responsive-guides resize ${fmtK(n)}`,
      group: `responsive guide resize ${fmtK(n)}`,
      bench: `runPipeline responsive guide resize ${fmtK(n)}`,
      fn: () => {
        narrow = !narrow;
        return runPipeline(spec, { ...opts, width: narrow ? 420 : 800 });
      },
    });
  }

  return workloads;
}

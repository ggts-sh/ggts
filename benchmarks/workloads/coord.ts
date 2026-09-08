import { runPipeline } from "@ggts-sh/core";

import { coordFixedSpec, coordPointSpec, coordTessellationSpec } from "../workload-specs";
import { fmtK, opts, type Workload } from "./shared";

/** Post-stat coordinate projection + bounded tessellation (PR 4). */
export function registerCoordWorkloads(smoke: boolean): Workload[] {
  const workloads: Workload[] = [];

  {
    const n = smoke ? 1_000 : 100_000;
    for (const transform of ["identity", "log10"] as const) {
      const spec = coordPointSpec(n, transform);
      workloads.push({
        id: `pipeline coord-${transform} points ${fmtK(n)}`,
        group: `post-stat coordinate ${transform} ${fmtK(n)}`,
        bench: `runPipeline coord ${transform} points ${fmtK(n)}`,
        fn: () => runPipeline(spec, opts),
      });
    }
    const vertices = smoke ? 1_000 : 10_000;
    const tessellated = coordTessellationSpec(vertices);
    workloads.push({
      id: `pipeline coord-tessellation ${fmtK(vertices)}`,
      group: `post-stat coordinate tessellation ${fmtK(vertices)}`,
      bench: `runPipeline worst-case coord tessellation ${fmtK(vertices)}`,
      fn: () => runPipeline(tessellated, opts),
    });
  }

  return workloads;
}

/** Fixed-aspect allocation under responsive resize (PR 8). */
export function registerCoordFixedWorkloads(smoke: boolean): Workload[] {
  const workloads: Workload[] = [];

  {
    const n = smoke ? 1_000 : 10_000;
    const spec = coordFixedSpec(n);
    let narrow = false;
    workloads.push({
      id: `pipeline coord-fixed resize ${fmtK(n)}`,
      group: `fixed-aspect resize ${fmtK(n)}`,
      bench: `runPipeline coord_fixed resize ${fmtK(n)}`,
      fn: () => {
        narrow = !narrow;
        return runPipeline(spec, {
          ...opts,
          width: narrow ? 360 : 900,
          height: narrow ? 640 : 420,
        });
      },
    });
  }

  return workloads;
}

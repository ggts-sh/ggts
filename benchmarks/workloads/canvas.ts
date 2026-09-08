import { buildCandidateStore, planStrata, runPipeline } from "@ggts-sh/core";
import { drawStratum } from "@ggts-sh/core/dom";

import { scatterSpec } from "../workload-specs";
import { fmtK, opts, stubContext, type Workload } from "./shared";

export function registerCanvasWorkloads(smoke: boolean): Workload[] {
  const workloads: Workload[] = [];

  {
    const n = smoke ? 1_000 : 100_000;
    const spec = scatterSpec(n, "canvas");
    const model = runPipeline(spec, opts);
    const strata = planStrata(model.scene, model.layerBackends);
    const canvasStratum = strata.find((s) => s.backend === "canvas");
    if (canvasStratum === undefined) throw new Error("expected a canvas stratum");
    const canvasBatches = canvasStratum.batches;
    const ctx = stubContext();
    const resolve = (c: string) => c;
    const label = fmtK(n);
    const groupLabel = `canvas scatter ${label} (stub ctx: JS command cost, no raster)`;
    workloads.push(
      {
        id: `canvas cold scatter ${label}`,
        group: groupLabel,
        bench: `canvas cold ${label} (pipeline + plan + draw + candidate index)`,
        fn: () => {
          const m = runPipeline(spec, opts);
          const plan = planStrata(m.scene, m.layerBackends);
          for (const stratum of plan) {
            if (stratum.backend === "canvas") drawStratum(ctx, m.scene, stratum.batches, resolve);
          }
          m.candidates.hitTest(400, 250);
        },
      },
      {
        id: `canvas redraw scatter ${label}`,
        group: groupLabel,
        bench: `canvas redraw ${label} (drawStratum only)`,
        fn: () => {
          drawStratum(ctx, model.scene, canvasBatches, resolve);
        },
      },
      {
        id: `hit-index build ${label}`,
        group: groupLabel,
        bench: `candidate index build ${label} points`,
        fn: () => buildCandidateStore(model.scene).hitTest(400, 250),
      },
      {
        id: `candidate lookup ${label}`,
        group: groupLabel,
        bench: `candidate nearest/group/rect ${label}`,
        fn: () => {
          const match = model.candidates.nearest(400, 250, { mode: "xy", maxDistance: 32 });
          if (match !== null && match.xToken !== null) model.candidates.group(match.id, "x");
          model.candidates.queryRect(200, 125, 600, 375);
        },
      },
    );
  }

  return workloads;
}

import type { GeometryBatch } from "../scene.js";

import { buildCountFrame } from "./frame-stats-count.js";
import { buildSumFrame } from "./frame-stats-sum.js";
import { registerBandGuide } from "../layout/register-band-guide.js";
import { registerStatFrame } from "./frame-stats-registry.js";
import { registerGeomBatch, type GeometryBatchBuilder } from "./geometry-registry.js";
import { rectsBatch } from "./geometry-rects.js";

function single(batch: GeometryBatch | null): GeometryBatch[] {
  return batch === null ? [] : [batch];
}

const rects: GeometryBatchBuilder = (frame, fx, _color, fill, styles, warnings) =>
  single(rectsBatch(frame, fx, fill, styles, warnings));

let registered = false;

/** Register col/bar geometry, count/sum stats, and the band-axis planner. Idempotent. */
export function registerBasicBars(): void {
  if (registered) return;
  registered = true;
  registerBandGuide();
  registerGeomBatch("col", rects);
  registerGeomBatch("bar", rects);
  registerStatFrame("count", (binding, table, groups, warnings) =>
    buildCountFrame(binding, table, groups, warnings),
  );
  registerStatFrame("sum", (binding, table, groups, warnings) =>
    buildSumFrame(binding, table, groups, warnings),
  );
}

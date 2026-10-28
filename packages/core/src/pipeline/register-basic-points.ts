import type { GeometryBatch } from "../scene.js";

import { buildCountFrame } from "./frame-stats-count.js";
import { registerStatFrame } from "./frame-stats-registry.js";
import { registerGeomBatch, type GeometryBatchBuilder } from "./geometry-registry.js";
import { pointsBatch } from "./geometry-points.js";

function single(batch: GeometryBatch | null): GeometryBatch[] {
  return batch === null ? [] : [batch];
}

const points: GeometryBatchBuilder = (frame, fx, color, _fill, styles, warnings) =>
  single(pointsBatch(frame, fx, color, styles, warnings));

let registered = false;

/** Register point/count geometry plus the count stat. Idempotent. */
export function registerBasicPoints(): void {
  if (registered) return;
  registered = true;
  registerGeomBatch("point", points);
  registerGeomBatch("count", points);
  registerStatFrame("count", (binding, table, groups, warnings) =>
    buildCountFrame(binding, table, groups, warnings),
  );
}

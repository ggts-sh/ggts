import type { GeometryBatch } from "../scene.js";

import { registerGeomBatch, type GeometryBatchBuilder } from "./geometry-registry.js";
import { areaBatch } from "./geometry-paths-area.js";
import { ribbonBatches } from "./geometry-ribbon.js";

function single(batch: GeometryBatch | null): GeometryBatch[] {
  return batch === null ? [] : [batch];
}

const area: GeometryBatchBuilder = (frame, fx, _color, fill, styles, warnings) =>
  single(areaBatch(frame, fx, fill, styles, warnings));

let registered = false;

/** Register area, density, and ribbon geometry. Idempotent. */
export function registerBasicAreas(): void {
  if (registered) return;
  registered = true;
  registerGeomBatch("area", area);
  registerGeomBatch("density", area);
  registerGeomBatch("ribbon", (frame, fx, color, fill, styles, warnings) =>
    ribbonBatches(frame, fx, color, fill, styles, warnings),
  );
}

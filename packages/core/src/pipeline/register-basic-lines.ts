import type { GeometryBatch } from "../scene.js";

import { registerGeomBatch, type GeometryBatchBuilder } from "./geometry-registry.js";
import { lineBatch } from "./geometry-paths-line.js";

function single(batch: GeometryBatch | null): GeometryBatch[] {
  return batch === null ? [] : [batch];
}

const lineLike: GeometryBatchBuilder = (frame, fx, color, _fill, styles, warnings) => {
  const connectNoSort = frame.binding.layer.stat === "connect";
  return single(
    lineBatch(frame, fx, color, styles, warnings, connectNoSort ? { sortByX: false } : {}),
  );
};

let registered = false;

/** Register line, step, and authored-order path geometry. Idempotent. */
export function registerBasicLines(): void {
  if (registered) return;
  registered = true;
  registerGeomBatch("line", lineLike);
  registerGeomBatch("step", lineLike);
  registerGeomBatch("path", (frame, fx, color, _fill, styles, warnings) =>
    single(lineBatch(frame, fx, color, styles, warnings, { sortByX: false })),
  );
}

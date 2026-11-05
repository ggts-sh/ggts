import type { CellValue } from "../table.js";
import { stackOrFillInspectY } from "./candidate-construction/datum-values.js";
import type { FinalizedLayerFrame } from "./types.js";
import type { Scene } from "../scene.js";

export function sourceBackedRewritesInspectY(
  frame: FinalizedLayerFrame | undefined,
  batchKind: Scene["batches"][number]["kind"] | undefined,
): boolean {
  if (frame === undefined || batchKind === "paths") return false;
  const geom = frame.binding.layer.geom;
  if (geom !== "bar" && geom !== "col") return false;
  const position = frame.binding.layer.position ?? "identity";
  return (position === "stack" || position === "fill") && frame.binding.yTransform === undefined;
}

export function sourceBackedInspectY(
  panelFrames: readonly (readonly FinalizedLayerFrame[])[],
  scene: Scene,
  facts: {
    panelIndex: number;
    layerIndex: number;
    batchIndex: number;
    primitiveIndex: number;
  },
  fallback: CellValue,
): CellValue {
  const batch = scene.batches[facts.batchIndex];
  const frame = panelFrames[facts.panelIndex]?.[facts.layerIndex];
  if (frame === undefined || !sourceBackedRewritesInspectY(frame, batch?.kind)) return fallback;
  // Rects dropped by the emitter carry their frame rows; otherwise the primitive is the row.
  const { primitiveIndex } = facts;
  const frameRow =
    batch?.kind === "rects" && batch.frameRowIndex !== undefined
      ? batch.frameRowIndex[primitiveIndex]!
      : Math.min(primitiveIndex, Math.max(0, frame.n - 1));
  return stackOrFillInspectY(frame, frameRow, fallback);
}

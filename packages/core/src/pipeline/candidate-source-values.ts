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

/** Source row to frame row. Only a compacted batch builds one, on its first miss. */
const frameRowLookups = new WeakMap<Uint32Array, Map<number, number>>();

function frameRowForSourceRow(
  frame: FinalizedLayerFrame,
  sourceRow: number | null,
  primitiveIndex: number,
): number {
  const fallback = Math.min(primitiveIndex, Math.max(0, frame.n - 1));
  if (sourceRow === null) return fallback;
  // Dense path: primitive still indexes the same frame row.
  if (frame.rowIndex[fallback] === sourceRow) return fallback;
  // Compacted rects (dropped earlier slots): recover the original frame row.
  const { rowIndex } = frame;
  let lookup = frameRowLookups.get(rowIndex);
  if (lookup === undefined) {
    lookup = new Map();
    // Backward, so a repeated source row keeps its first frame row.
    for (let row = rowIndex.length - 1; row >= 0; row--) lookup.set(rowIndex[row]!, row);
    frameRowLookups.set(rowIndex, lookup);
  }
  return lookup.get(sourceRow) ?? fallback;
}

export function sourceBackedInspectY(
  panelFrames: readonly (readonly FinalizedLayerFrame[])[],
  scene: Scene,
  facts: {
    panelIndex: number;
    layerIndex: number;
    batchIndex: number;
    primitiveIndex: number;
    sourceRow: number | null;
  },
  fallback: CellValue,
): CellValue {
  const batch = scene.batches[facts.batchIndex];
  const frame = panelFrames[facts.panelIndex]?.[facts.layerIndex];
  if (frame === undefined || !sourceBackedRewritesInspectY(frame, batch?.kind)) return fallback;
  return stackOrFillInspectY(
    frame,
    frameRowForSourceRow(frame, facts.sourceRow, facts.primitiveIndex),
    fallback,
  );
}

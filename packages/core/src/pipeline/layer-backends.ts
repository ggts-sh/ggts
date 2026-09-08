/**
 * Resolve per-layer render backends from hints, thresholds, and a11y.
 */
import type { LayerSpec } from "@ggts-sh/spec";

import type { GeometryBatch } from "../scene.js";

import { batchMarkCount } from "./geometry.js";
import type { Advisory, LayerBackend } from "./types.js";
import { CANVAS_AUTO_THRESHOLD } from "./types.js";

export function resolveLayerBackends(
  layers: readonly LayerSpec[],
  batches: readonly GeometryBatch[],
  a11y: "auto" | "force-svg" | undefined,
  canvasThreshold: number | undefined,
  advisories: Advisory[],
): LayerBackend[] {
  const threshold = canvasThreshold ?? CANVAS_AUTO_THRESHOLD;
  const marksPerLayer: number[] = layers.map(() => 0);
  for (const batch of batches) {
    marksPerLayer[batch.layerIndex] =
      (marksPerLayer[batch.layerIndex] ?? 0) + batchMarkCount(batch);
  }
  return layers.map((layer, index) => {
    if (a11y === "force-svg") return "svg";
    const hint = ("render" in layer ? layer.render : undefined) ?? "auto";
    if (hint === "svg" || hint === "canvas") return hint;
    if ((marksPerLayer[index] ?? 0) > threshold) {
      advisories.push({
        code: "canvas-auto",
        path: `layers.${index}`,
        chosen: `canvas backend (${marksPerLayer[index]} marks > threshold ${threshold}; canvas marks do not expose per-mark accessibility or "copy SVG")`,
        howToOverride: `Set layers[${index}].render to "svg" (or "canvas" to silence this), or set a11y: "force-svg" on the plot.`,
      });
      return "canvas";
    }
    return "svg";
  });
}

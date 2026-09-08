/**
 * Canvas stratum painting and batch focus-mask projection for GGPlot mark
 * compositing. SSR-safe to import; paintCanvasStratum touches the DOM only
 * when called with a live canvas element.
 */

import type { BatchInteractionMask, GeometryBatch, RenderModel } from "@ggts-sh/core";
import { cssColorResolver, drawStratum, sizeCanvasForDpr } from "@ggts-sh/core/dom";

/**
 * Project full-scene interaction masks onto a stratum batch subset using
 * scene batch identity. Builds a batch→index Map once (O(S + B)) rather than
 * `indexOf` per batch (O(B · S)), matching host masksForBatches semantics.
 * Empty interactionMasks → empty result (no focus styling).
 */
export function resolveBatchFocusMasks(
  sceneBatches: readonly GeometryBatch[],
  batches: readonly GeometryBatch[],
  interactionMasks: readonly (BatchInteractionMask | null)[],
): (BatchInteractionMask | null)[] {
  if (interactionMasks.length === 0) return [];
  const indexByBatch = new Map(sceneBatches.map((batch, index) => [batch, index]));
  return batches.map((batch) => {
    const index = indexByBatch.get(batch);
    return index === undefined ? null : (interactionMasks[index] ?? null);
  });
}

export type PaintCanvasStratumInput = {
  readonly canvas: HTMLCanvasElement;
  readonly scene: RenderModel["scene"];
  readonly batches: readonly GeometryBatch[];
  readonly focusMasks: readonly (BatchInteractionMask | null)[];
};

/**
 * Size for DPR and draw one canvas stratum.
 * Returns false when a 2d context is unavailable — callers must not notify
 * the paint ledger in that case (keeps data-gg-ready false).
 */
export function paintCanvasStratum(input: PaintCanvasStratumInput): boolean {
  const ctx = input.canvas.getContext("2d");
  if (ctx === null) return false;
  const dpr = window.devicePixelRatio || 1;
  sizeCanvasForDpr(input.canvas, ctx, input.scene.width, input.scene.height, dpr);
  drawStratum(
    ctx,
    input.scene,
    input.batches,
    cssColorResolver(input.canvas),
    input.focusMasks.length > 0
      ? {
          focusMasks: input.focusMasks,
          mutedAlpha: input.scene.theme.interactionMuted,
        }
      : undefined,
  );
  return true;
}

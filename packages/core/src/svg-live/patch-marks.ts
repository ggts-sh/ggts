/**
 * Positional SVG mark patching for the live-update path (#1471).
 *
 * Each writer computes the exact attribute map the corresponding emitter in
 * ../render-svg-marks.ts would serialize — same names, same px() formatting,
 * same resolvers, same conditional-omission rules — for the previous and next
 * batch, then writes only the differences onto the mounted DOM node. Callers
 * must have proven structural compatibility via sceneSignature (same batch
 * topology, same per-mark element kinds); writers still bail (return false)
 * on any surprise so the caller rebuilds the batch subtree from renderBatch's
 * string. A false return is always safe; a wrong patch never is.
 *
 * Diff inputs are the previously mounted batch and the next batch; raw
 * numbers/strings compare BEFORE px() formatting, so unchanged channels skip
 * both the format and the setAttribute (a same-value write still dirties the
 * node in Chromium's style engine).
 *
 * Per-kind writers live in patch-{attrs,points,paths,rects,segments}.ts; this
 * module keeps the group-level attrs writer and the batch-kind dispatcher.
 */
import type {
  GeometryBatch,
  PathsBatch,
  PointsBatch,
  RectsBatch,
  SegmentsBatch,
} from "../scene.js";
import { px } from "../render-svg-format.js";
import { writeAttrs } from "./patch-attrs.js";
import type { BatchPatchContext } from "./patch-attrs.js";
import { patchPoints } from "./patch-points.js";
import { patchPaths } from "./patch-paths.js";
import { patchRects } from "./patch-rects.js";
import { patchSegments } from "./patch-segments.js";

export type { BatchPatchContext } from "./patch-attrs.js";

/** Group attrs every batch emitter writes (opacity; filter for glow kinds). */
function patchGroupAttrs(
  group: SVGGElement,
  prev: GeometryBatch,
  next: GeometryBatch,
  ctx: BatchPatchContext,
): void {
  const opacity = next.alpha === 1 ? "" : px(next.alpha);
  const prevOpacity = prev.alpha === 1 ? "" : px(prev.alpha);
  writeAttrs(group, { opacity }, { opacity: prevOpacity });
  const glowOf = (b: GeometryBatch): string => {
    if (b.kind !== "paths" && b.kind !== "segments") return "";
    const glow = b.glow;
    return glow === undefined || ctx.paintMode === "fallback"
      ? ""
      : `url(#${ctx.idScope}${glow.id})`;
  };
  writeAttrs(group, { filter: glowOf(next) }, { filter: glowOf(prev) });
}

/**
 * Patch one mounted batch group against the next batch. Returns false when
 * the batch is not positionally patchable (glyphs, or any structural
 * surprise) — the caller rebuilds the group from the emitter string.
 */
export function patchBatchGroup(
  group: SVGGElement,
  prev: GeometryBatch,
  next: GeometryBatch,
  ctx: BatchPatchContext,
): boolean {
  if (prev.kind !== next.kind) return false;
  let ok: boolean;
  switch (next.kind) {
    case "points":
      ok = patchPoints(group, prev as PointsBatch, next, ctx);
      break;
    case "paths":
      ok = patchPaths(group, prev as PathsBatch, next, ctx);
      break;
    case "rects":
      ok = patchRects(group, prev as RectsBatch, next, ctx);
      break;
    case "segments":
      ok = patchSegments(group, prev as SegmentsBatch, next, ctx);
      break;
    case "glyphs":
      return false;
  }
  if (ok) patchGroupAttrs(group, prev, next, ctx);
  return ok;
}

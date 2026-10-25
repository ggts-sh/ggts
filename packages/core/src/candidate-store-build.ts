import { createHitGeometry } from "./candidate-hit-geometry.js";
import { resolveTopmostHit } from "./candidate-hit-resolve.js";
import { buildCandidateStoreIndexes } from "./candidate-store-indexes.js";
import { buildSpatialIndex } from "./candidate-store-spatial-index.js";
import { findNearest, traverseCandidate } from "./candidate-store-nearest.js";
import type { CandidateStore, CandidateStoreOptions } from "./candidate-store-types.js";
import type { Scene } from "./scene.js";

/** Shared empty anchors returned by disposed / uninitialized stores. */
export const EMPTY_FLOAT32 = new Float32Array(0);
export const EMPTY_UINT32 = new Uint32Array(0);

/**
 * Assembled candidate store: compact indexes + query methods.
 * Construction phases:
 * - candidate-store-indexes.ts — typed arrays, traversal, group buckets
 * - candidate-store-spatial-index.ts — spatial shortlist trees + shortlist APIs
 * - candidate-hit-geometry.ts — one ops table per mark kind; probe handles
 * - candidate-hit-resolve.ts — topmost-hit + tie-break policy
 * - candidate-path-geometry.ts — path AABB / edge helpers
 */
export function assembleCandidateStore(
  scene: Scene,
  options: CandidateStoreOptions = {},
): CandidateStore {
  const indexes = buildCandidateStoreIndexes(scene, options);
  const {
    epoch,
    n,
    flip,
    hitTolerance,
    batchIds,
    primitiveIds,
    panelIds,
    autoModes,
    xs,
    ys,
    xTokenIds,
    yTokenIds,
    traversal,
    traversalRank,
    orderByX,
    coincidentStack,
    coincidentAt,
  } = indexes;
  const hit = createHitGeometry(indexes);
  const query = buildSpatialIndex(indexes, hit);
  const { spatial, isPoint, pointBatchIndexes, isFilledPath, filledSpanStart, filledSpanEnd } =
    query;

  return {
    epoch,
    size: n,
    x: xs,
    y: ys,
    candidate: (id) => indexes.fact(id),
    hitTest(px, py) {
      return resolveTopmostHit(
        {
          scene,
          hitTolerance,
          batchIds,
          primitiveIds,
          panelIds,
          xs,
          ys,
          pointBatchIndexes,
          filledSpanStart,
          filledSpanEnd,
          isFilledPath,
          addExtendedIntersecting: (loX, loY, hiX, hiY, into) => {
            query.addExtendedIntersecting(loX, loY, hiX, hiY, into);
          },
          probePoint: (x, y) => hit.probePoint(x, y),
          fact: (id) => indexes.fact(id),
        },
        px,
        py,
      );
    },
    nearest(px, py, search) {
      return findNearest(
        {
          flip,
          autoModes,
          xTokenIds,
          yTokenIds,
          xs,
          ys,
          filledSpanStart,
          filledSpanEnd,
          probe: hit.probePoint(px, py),
          panelIds,
          scene,
          query,
          indexesFact: (id) => indexes.fact(id),
          isFilledPath,
        },
        px,
        py,
        search,
      );
    },
    group: indexes.group,
    traverse(startId, direction = "next", step) {
      return traverseCandidate(
        startId,
        direction,
        step,
        n,
        traversal,
        traversalRank,
        panelIds,
        orderByX,
        xs,
        ys,
      );
    },
    cycle(seedId, step = 1) {
      if (!Number.isInteger(seedId) || seedId < 0 || seedId >= n) return null;
      const stack = coincidentStack[seedId];
      // No multi-member stack → singleton; step is a no-op.
      if (stack === undefined) return seedId;
      const at = coincidentAt[seedId]!;
      const next = (((at + step) % stack.length) + stack.length) % stack.length;
      // Non-finite / non-integral step yields a non-element index; fall back to seed.
      return stack[next] ?? seedId;
    },
    queryRect(x0, y0, x1, y1, panelId) {
      const loX = Math.min(x0, x1);
      const hiX = Math.max(x0, x1);
      const loY = Math.min(y0, y1);
      const hiY = Math.max(y0, y1);
      if (n === 0) return EMPTY_UINT32;
      // Point anchors: exact rect membership via the tree. Extended geometry
      // (rects/segments/paths) can intersect far from the anchor — always refine.
      // Collect hits then order by traversal rank (preserves prior contract).
      const hits: number[] = [];
      if (spatial !== null) {
        for (const id of spatial.queryRect(loX, loY, hiX, hiY)) {
          if (isPoint[id] !== 1) continue;
          if (panelId !== undefined && scene.panels[panelIds[id]!]!.id !== panelId) continue;
          hits.push(id);
        }
      }
      const extendedHits: number[] = [];
      query.addExtendedIntersecting(loX, loY, hiX, hiY, extendedHits);
      const probe = hit.probeRect(loX, loY, hiX, hiY);
      for (const id of extendedHits) {
        if (panelId !== undefined && scene.panels[panelIds[id]!]!.id !== panelId) continue;
        // Filled subpath: one AABB shortlist entry, then per-vertex membership
        // (anchor / adjacent edges / fill-center). Do not expand the whole
        // span from a rep-only graze — that over-selects and under-selects
        // mid-band brushes (Devin review on #1342).
        if (isFilledPath[id] === 1) {
          const start = filledSpanStart[id]!;
          const end = filledSpanEnd[id]!;
          for (let cid = start; cid < end; cid++) {
            if (probe.intersects(cid)) hits.push(cid);
          }
          continue;
        }
        if (probe.intersects(id)) hits.push(id);
      }
      hits.sort((a, b) => traversalRank[a]! - traversalRank[b]!);
      return Uint32Array.from(hits);
    },
    dispose() {},
  };
}

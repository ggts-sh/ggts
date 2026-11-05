/**
 * Spatial shortlist indexes for an assembled candidate store: anchor quadtree,
 * per-batch point trees, size-classed extended AABB trees, and shortlist APIs.
 * Size-class layout stays closure-private.
 *
 * Filled paths (#1342): one extended AABB entry per subpath (not per vertex).
 * Filled candidates are omitted from the main anchor tree so strip shortlists
 * stay O(non-filled + subpaths) instead of O(all area vertices).
 */
import { pathRange } from "./candidate-geometry.js";
import { StaticQuadtree } from "./dom/quadtree.js";
import type { HitGeometry } from "./candidate-hit-geometry.js";
import type { CandidateInspectMode } from "./candidate-store-types.js";
import { AUTO_MODE_CODE, type CandidateStoreIndexes } from "./candidate-store-indexes.js";

type PointBatchIndex = {
  readonly batchIndex: number;
  readonly ids: number[];
  readonly spatial: StaticQuadtree;
  /** max(batch.size, …batch.sizes) * 1.25 — query pad without hitTolerance. */
  readonly maxRadius: number;
};

export type SpatialIndex = {
  readonly spatial: StaticQuadtree | null;
  readonly isPoint: Uint8Array;
  /** 1 when the candidate is a filled-path vertex (area / ribbon / band). */
  readonly isFilledPath: Uint8Array;
  /**
   * Inclusive-exclusive candidate id span of the filled subpath containing `id`.
   * `-1` when `isFilledPath[id] === 0`. All members of a subpath share the same span.
   */
  readonly filledSpanStart: Int32Array;
  readonly filledSpanEnd: Int32Array;
  readonly maxPointReach: number;
  readonly pointBatchIndexes: readonly PointBatchIndex[];
  addExtendedIntersecting(
    loX: number,
    loY: number,
    hiX: number,
    hiY: number,
    into: Set<number> | number[],
  ): void;
  shortlistNearest(
    px: number,
    py: number,
    mode: CandidateInspectMode,
    maxDistance: number,
  ): number[];
  firstNearestRadius(mode: CandidateInspectMode, maxDistance: number): number;
};

type ExtendedBuild = {
  readonly extendedIds: number[];
  readonly extMinX: number[];
  readonly extMinY: number[];
  readonly extMaxX: number[];
  readonly extMaxY: number[];
};

function classifySpatialCandidates(
  scene: CandidateStoreIndexes["scene"],
  n: number,
  hitTolerance: number,
  batchIds: Uint32Array,
  primitiveIds: Uint32Array,
  spatialXs: Float64Array,
  spatialYs: Float64Array,
  isPoint: Uint8Array,
  isFilledPath: Uint8Array,
): { pointIdsByBatch: Map<number, number[]>; maxPointReach: number } {
  const pointIdsByBatch = new Map<number, number[]>();
  let maxPointReach = 0;
  for (let id = 0; id < n; id++) {
    const batch = scene.batches[batchIds[id]!]!;
    if (batch.kind === "points") {
      isPoint[id] = 1;
      const primitive = primitiveIds[id]!;
      maxPointReach = Math.max(
        maxPointReach,
        (batch.sizes?.[primitive] ?? batch.size) * 1.25 + hitTolerance,
      );
      const ids = pointIdsByBatch.get(batchIds[id]!);
      if (ids === undefined) pointIdsByBatch.set(batchIds[id]!, [id]);
      else ids.push(id);
      continue;
    }
    if (batch.kind === "paths" && batch.fills !== undefined) {
      isFilledPath[id] = 1;
      spatialXs[id] = Number.NaN;
      spatialYs[id] = Number.NaN;
    }
  }
  return { pointIdsByBatch, maxPointReach };
}

function collectExtendedBuild(
  scene: CandidateStoreIndexes["scene"],
  n: number,
  batchIds: Uint32Array,
  primitiveIds: Uint32Array,
  isPoint: Uint8Array,
  isFilledPath: Uint8Array,
  hit: HitGeometry,
  filledSpanStart: Int32Array,
  filledSpanEnd: Int32Array,
): ExtendedBuild {
  const extendedIds: number[] = [];
  const extMinX: number[] = [];
  const extMinY: number[] = [];
  const extMaxX: number[] = [];
  const extMaxY: number[] = [];
  const pathAabbCache = new Map<string, readonly [number, number, number, number]>();
  for (let id = 0; id < n;) {
    if (isPoint[id] === 1) {
      id++;
      continue;
    }
    if (isFilledPath[id] === 1) {
      const batchIndex = batchIds[id]!;
      const batch = scene.batches[batchIndex]!;
      if (batch.kind !== "paths") {
        id++;
        continue;
      }
      const range = pathRange(batch, primitiveIds[id]!);
      const range0 = range?.[0] ?? -1;
      const range1 = range?.[1] ?? -1;
      const startId = id;
      id++;
      while (id < n && isFilledPath[id] === 1 && batchIds[id] === batchIndex) {
        const next = pathRange(batch, primitiveIds[id]!);
        if (next === null || next[0] !== range0 || next[1] !== range1) break;
        id++;
      }
      const endId = id;
      for (let j = startId; j < endId; j++) {
        filledSpanStart[j] = startId;
        filledSpanEnd[j] = endId;
      }
      extendedIds.push(startId);
      const [minX, minY, maxX, maxY] = hit.aabb(startId, pathAabbCache);
      extMinX.push(minX);
      extMinY.push(minY);
      extMaxX.push(maxX);
      extMaxY.push(maxY);
      continue;
    }
    extendedIds.push(id);
    const [minX, minY, maxX, maxY] = hit.aabb(id, pathAabbCache);
    extMinX.push(minX);
    extMinY.push(minY);
    extMaxX.push(maxX);
    extMaxY.push(maxY);
    id++;
  }
  pathAabbCache.clear();
  return { extendedIds, extMinX, extMinY, extMaxX, extMaxY };
}

/** Build shortlist indexes and shortlist helpers for an eager store. */
export function buildSpatialIndex(indexes: CandidateStoreIndexes, hit: HitGeometry): SpatialIndex {
  const { scene, n, hitTolerance, flip, batchIds, primitiveIds, xs, ys, autoModes } = indexes;

  // Spatial index over plot-px anchors (reuse StaticQuadtree). Point-like
  // candidates shortlist via the tree; rects/segments/paths/glyphs use
  // size-classed AABB-center trees so hit regions far from anchors still
  // shortlist without force-adding every extended id. Classes bucket by
  // log2(max half-extent) so one giant AABB cannot expand every query to O(E).
  // Filled path vertices use NaN so StaticQuadtree skips them (#1342).
  const spatialXs = Float64Array.from(xs);
  const spatialYs = Float64Array.from(ys);
  const isPoint = new Uint8Array(n);
  const isFilledPath = new Uint8Array(n);
  const filledSpanStart = new Int32Array(n);
  const filledSpanEnd = new Int32Array(n);
  filledSpanStart.fill(-1);
  filledSpanEnd.fill(-1);
  const { pointIdsByBatch, maxPointReach } = classifySpatialCandidates(
    scene,
    n,
    hitTolerance,
    batchIds,
    primitiveIds,
    spatialXs,
    spatialYs,
    isPoint,
    isFilledPath,
  );
  const {
    extendedIds,
    extMinX: extMinXBuild,
    extMinY: extMinYBuild,
    extMaxX: extMaxXBuild,
    extMaxY: extMaxYBuild,
  } = collectExtendedBuild(
    scene,
    n,
    batchIds,
    primitiveIds,
    isPoint,
    isFilledPath,
    hit,
    filledSpanStart,
    filledSpanEnd,
  );
  const spatial = n > 0 ? new StaticQuadtree(spatialXs, spatialYs) : null;

  // Pointer hit testing preserves reverse paint order and per-batch point
  // radius without expanding every query by the largest point in the scene.
  // This mirrors paint batches while remaining private to CandidateStore.
  // maxRadius is fixed at build so hitTest never O(P)-scans batch.sizes (#978).
  const pointBatchIndexes = [...pointIdsByBatch.entries()].map(([batchIndex, ids]) => {
    // When one points batch covers every candidate, its tree is coordinate-
    // identical to the main anchor tree (ids[j] === j, no filled-path NaN
    // stripping possible) — reuse it instead of building a second O(n) tree
    // over the same points.
    const reuseMain = ids.length === n && spatial !== null;
    let batchSpatial = spatial;
    if (!reuseMain) {
      const pointXs = new Float64Array(ids.length);
      const pointYs = new Float64Array(ids.length);
      for (let i = 0; i < ids.length; i++) {
        pointXs[i] = xs[ids[i]!]!;
        pointYs[i] = ys[ids[i]!]!;
      }
      batchSpatial = new StaticQuadtree(pointXs, pointYs);
    }
    const batch = scene.batches[batchIndex]!;
    let maxRadius = 0;
    if (batch.kind === "points") {
      maxRadius = batch.size;
      if (batch.sizes !== undefined) {
        for (const radius of batch.sizes) maxRadius = Math.max(maxRadius, radius);
      }
      maxRadius *= 1.25;
    }
    return {
      batchIndex,
      ids,
      spatial: batchSpatial!,
      maxRadius,
    };
  });
  pointIdsByBatch.clear();

  const extN = extendedIds.length;
  const extMinX = Float64Array.from(extMinXBuild);
  const extMinY = Float64Array.from(extMinYBuild);
  const extMaxX = Float64Array.from(extMaxXBuild);
  const extMaxY = Float64Array.from(extMaxYBuild);
  extMinXBuild.length = 0;
  extMinYBuild.length = 0;
  extMaxXBuild.length = 0;
  extMaxYBuild.length = 0;

  // Size-class trees: class key = ceil(log2(max half-extent)).
  type ExtendedClass = {
    readonly eis: readonly number[];
    readonly maxHalfW: number;
    readonly maxHalfH: number;
    readonly spatial: StaticQuadtree;
  };
  const buildSizeClasses = (eisFilter: (ei: number) => boolean): ExtendedClass[] => {
    const classBuckets = new Map<number, number[]>();
    for (let ei = 0; ei < extN; ei++) {
      if (!eisFilter(ei)) continue;
      const halfW = (extMaxX[ei]! - extMinX[ei]!) / 2;
      const halfH = (extMaxY[ei]! - extMinY[ei]!) / 2;
      const m = Math.max(halfW, halfH, 1e-9);
      const key = Math.min(31, Math.ceil(Math.log2(m)));
      const bucket = classBuckets.get(key);
      if (bucket === undefined) classBuckets.set(key, [ei]);
      else bucket.push(ei);
    }
    const classes: ExtendedClass[] = [];
    for (const eis of classBuckets.values()) {
      const cxs = new Float64Array(eis.length);
      const cys = new Float64Array(eis.length);
      let maxHalfW = 0;
      let maxHalfH = 0;
      for (let j = 0; j < eis.length; j++) {
        const ei = eis[j]!;
        const halfW = (extMaxX[ei]! - extMinX[ei]!) / 2;
        const halfH = (extMaxY[ei]! - extMinY[ei]!) / 2;
        cxs[j] = (extMinX[ei]! + extMaxX[ei]!) / 2;
        cys[j] = (extMinY[ei]! + extMaxY[ei]!) / 2;
        if (halfW > maxHalfW) maxHalfW = halfW;
        if (halfH > maxHalfH) maxHalfH = halfH;
      }
      classes.push({
        eis,
        maxHalfW,
        maxHalfH,
        spatial: new StaticQuadtree(cxs, cys),
      });
    }
    return classes;
  };
  const extendedClasses = buildSizeClasses(() => true);
  // Filled-path reps only — strip shortlists for axis modes must not pull every
  // bar/segment whose tall AABB crosses an infinite strip (Devin #1342 review).
  const filledExtendedClasses = buildSizeClasses((ei) => isFilledPath[extendedIds[ei]!] === 1);

  const addFromClasses = (
    classes: readonly ExtendedClass[],
    loX: number,
    loY: number,
    hiX: number,
    hiY: number,
    into: Set<number> | number[],
  ): void => {
    for (const cls of classes) {
      // Intersecting AABBs have centers inside query expanded by *this class's*
      // half-extents — not the global max (avoids one giant bar scanning all E).
      for (const j of cls.spatial.queryRect(
        loX - cls.maxHalfW,
        loY - cls.maxHalfH,
        hiX + cls.maxHalfW,
        hiY + cls.maxHalfH,
      )) {
        const ei = cls.eis[j]!;
        if (extMaxX[ei]! < loX || extMinX[ei]! > hiX || extMaxY[ei]! < loY || extMinY[ei]! > hiY)
          continue;
        const id = extendedIds[ei]!;
        if (Array.isArray(into)) into.push(id);
        else into.add(id);
      }
    }
  };

  /** Add extended ids whose AABB intersects the axis-aligned query box. */
  const addExtendedIntersecting = (
    loX: number,
    loY: number,
    hiX: number,
    hiY: number,
    into: Set<number> | number[],
  ): void => {
    addFromClasses(extendedClasses, loX, loY, hiX, hiY, into);
  };

  /** Filled-subpath reps only — for axis-strip shortlists that omit filled anchors. */
  const addFilledPathIntersecting = (
    loX: number,
    loY: number,
    hiX: number,
    hiY: number,
    into: Set<number> | number[],
  ): void => {
    addFromClasses(filledExtendedClasses, loX, loY, hiX, hiY, into);
  };
  // Far-plane strip bounds: StaticQuadtree prunes on the finite axis only.
  const STRIP = 1e30;

  // In auto mode a candidate matches away from the pointer only along its own
  // axis, so each strip searches only the anchors that can match on that axis.
  // A chart whose anchors all match, such as a line chart on x, reuses `spatial`.
  const autoStripTree = (matches: (autoMode: number) => boolean): StaticQuadtree | null => {
    let matched = false;
    let masked = false;
    const snapXs = spatialXs.map((x, id) => {
      if (Number.isNaN(x)) return x;
      if (matches(autoModes[id]!)) {
        matched = true;
        return x;
      }
      masked = true;
      return Number.NaN;
    });
    if (!matched) return null;
    return masked ? new StaticQuadtree(snapXs, spatialYs) : spatial;
  };
  const { x: autoX, y: autoY, xy: autoXY } = AUTO_MODE_CODE;
  const autoXStrip = autoStripTree((mode) => mode === autoXY || mode === (flip ? autoY : autoX));
  const autoYStrip = autoStripTree((mode) => mode === autoXY || mode === (flip ? autoX : autoY));

  /**
   * Radius of the first nearest pass, which holds about the same number of
   * candidates at any chart size. `maxDistance` means one full pass, for searches
   * where a narrow pass cannot help: exact-only anchors match at any radius, and
   * each pass scans every vertex of each filled span that crosses a strip.
   */
  const firstNearestRadius = (mode: CandidateInspectMode, maxDistance: number): number => {
    if (
      mode === "exact" ||
      filledExtendedClasses.length > 0 ||
      (mode === "auto" && autoXStrip === null && autoYStrip === null)
    )
      return maxDistance;
    let radius = maxDistance;
    for (let count = n; count > 4096; count /= 4) radius /= 4;
    return radius;
  };

  /** Shortlist candidate ids for a nearest query (reverse-id order for topmost ties). */
  const shortlistNearest = (
    px: number,
    py: number,
    mode: CandidateInspectMode,
    maxDistance: number,
  ): number[] => {
    if (n === 0) return [];
    const consider = new Set<number>();
    const addRect = (
      tree: StaticQuadtree | null,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
    ) => {
      if (tree === null) return;
      for (const id of tree.queryRect(x0, y0, x1, y1)) consider.add(id);
    };
    // Dominant-axis distance is along semantic x (screen y when coord_flip).
    // Axis token maps stay for group(); nearest uses spatial strips.
    // Filled path verts are not in spatial (#1342) — filled-only strip AABBs.
    const addXStrip = (tree: StaticQuadtree | null) => {
      addRect(tree, px - maxDistance, -STRIP, px + maxDistance, STRIP);
      addFilledPathIntersecting(px - maxDistance, -STRIP, px + maxDistance, STRIP, consider);
    };
    const addYStrip = (tree: StaticQuadtree | null) => {
      addRect(tree, -STRIP, py - maxDistance, STRIP, py + maxDistance);
      addFilledPathIntersecting(-STRIP, py - maxDistance, STRIP, py + maxDistance, consider);
    };
    if (mode === "xy") {
      addRect(spatial, px - maxDistance, py - maxDistance, px + maxDistance, py + maxDistance);
      // Filled areas omit anchors from `spatial`; full extended tree still
      // holds one rep per filled subpath plus rects/segments/stroked paths.
      addExtendedIntersecting(
        px - maxDistance,
        py - maxDistance,
        px + maxDistance,
        py + maxDistance,
        consider,
      );
    } else if (mode === "x") {
      if (flip) addYStrip(spatial);
      else addXStrip(spatial);
    } else if (mode === "y") {
      if (flip) addXStrip(spatial);
      else addYStrip(spatial);
    } else {
      // exact / auto: point anchors within hit reach + extended geometry whose
      // AABB meets the probe (rects/segments/paths can sit far from anchors).
      // Filled path verts are NaN-skipped in spatial; reps arrive via extended.
      const r = maxPointReach;
      addRect(spatial, px - r, py - r, px + r, py + r);
      if (mode === "auto") {
        addXStrip(autoXStrip);
        addYStrip(autoYStrip);
      }
      // exact containment uses the point AABB; auto still needs maxDistance pad
      // for dominant-axis extended matches that refine after shortlist.
      // Filled-path reps also need a pad on exact when the probe is outside the
      // subpath AABB but within maxDistance of an anchor (rare for areas).
      const pad = mode === "auto" ? maxDistance : 0;
      addExtendedIntersecting(px - pad, py - pad, px + pad, py + pad, consider);
    }
    return [...consider].toSorted((a, b) => b - a);
  };

  return {
    spatial,
    isPoint,
    isFilledPath,
    filledSpanStart,
    filledSpanEnd,
    maxPointReach,
    pointBatchIndexes,
    addExtendedIntersecting,
    shortlistNearest,
    firstNearestRadius,
  };
}

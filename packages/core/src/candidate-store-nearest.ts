import { directionalNearestInOrder, panelRangeInOrder } from "./candidate-geometry-nearest.js";
import { AUTO_MODES } from "./candidate-store-indexes.js";
import type {
  CandidateFacts,
  CandidateInspectMode,
  CandidateMatch,
  ResolvedCandidateInspectMode,
} from "./candidate-store-types.js";
import type { Scene } from "./scene.js";

type PointProbe = { distance(id: number): number | null };
type FilledSpanResult = {
  id: number;
  distance: number;
  orth: number;
  mode: ResolvedCandidateInspectMode;
};

type FilledSpanContext = {
  readonly flip: boolean;
  readonly autoModes: Uint8Array;
  readonly xTokenIds: Int32Array;
  readonly yTokenIds: Int32Array;
  readonly xs: Float32Array;
  readonly ys: Float32Array;
  readonly filledSpanStart: Int32Array;
  readonly filledSpanEnd: Int32Array;
  readonly probe: PointProbe;
};

function candidateMode(
  id: number,
  isAuto: boolean,
  explicitMode: ResolvedCandidateInspectMode,
  autoModes: Uint8Array,
): ResolvedCandidateInspectMode {
  return isAuto ? AUTO_MODES[autoModes[id]!]! : explicitMode;
}

function hasAxisToken(
  id: number,
  mode: ResolvedCandidateInspectMode,
  xTokenIds: Int32Array,
  yTokenIds: Int32Array,
): boolean {
  return (mode !== "x" || xTokenIds[id] !== -1) && (mode !== "y" || yTokenIds[id] !== -1);
}

function snapDistance(
  id: number,
  mode: ResolvedCandidateInspectMode,
  flip: boolean,
  px: number,
  py: number,
  xs: Float32Array,
  ys: Float32Array,
  maxDistance: number,
): { distance: number; orth: number } | null {
  const distance =
    mode === "x"
      ? Math.abs((flip ? ys[id] : xs[id])! - (flip ? py : px))
      : mode === "y"
        ? Math.abs((flip ? xs[id] : ys[id])! - (flip ? px : py))
        : Math.hypot(xs[id]! - px, ys[id]! - py);
  if (distance > maxDistance) return null;
  const orth =
    mode === "x"
      ? Math.abs((flip ? xs[id] : ys[id])! - (flip ? px : py))
      : mode === "y"
        ? Math.abs((flip ? ys[id] : xs[id])! - (flip ? py : px))
        : 0;
  return { distance, orth };
}

function scanFilledExact(
  start: number,
  end: number,
  ctx: FilledSpanContext,
  px: number,
  py: number,
  isAuto: boolean,
  explicitMode: ResolvedCandidateInspectMode,
): FilledSpanResult | null {
  if (!isAuto && explicitMode !== "exact") return null;
  if (ctx.probe.distance(start) === null) return null;
  let bestId = -1;
  let bestDistance = Infinity;
  for (let id = end - 1; id >= start; id--) {
    if (candidateMode(id, isAuto, explicitMode, ctx.autoModes) !== "exact") continue;
    if (!hasAxisToken(id, "exact", ctx.xTokenIds, ctx.yTokenIds)) continue;
    const distance = Math.hypot(ctx.xs[id]! - px, ctx.ys[id]! - py);
    if (distance < bestDistance) {
      bestId = id;
      bestDistance = distance;
    }
  }
  return bestId < 0 ? null : { id: bestId, distance: bestDistance, orth: 0, mode: "exact" };
}

function scanFilledSnap(
  start: number,
  end: number,
  ctx: FilledSpanContext,
  px: number,
  py: number,
  isAuto: boolean,
  explicitMode: ResolvedCandidateInspectMode,
  maxDistance: number,
): FilledSpanResult | null {
  let best: FilledSpanResult | null = null;
  for (let id = end - 1; id >= start; id--) {
    const mode = candidateMode(id, isAuto, explicitMode, ctx.autoModes);
    if (mode === "exact" || !hasAxisToken(id, mode, ctx.xTokenIds, ctx.yTokenIds)) continue;
    const measured = snapDistance(id, mode, ctx.flip, px, py, ctx.xs, ctx.ys, maxDistance);
    if (measured === null) continue;
    if (
      best === null ||
      measured.distance < best.distance ||
      (measured.distance === best.distance && measured.orth < best.orth)
    ) {
      best = { id, ...measured, mode };
    }
  }
  return best;
}

function bestFilledInSpan(
  repId: number,
  isAuto: boolean,
  explicitMode: ResolvedCandidateInspectMode,
  px: number,
  py: number,
  maxDistance: number,
  ctx: FilledSpanContext,
): FilledSpanResult | null {
  const start = ctx.filledSpanStart[repId]!;
  const end = ctx.filledSpanEnd[repId]!;
  if (start < 0 || end <= start) return null;
  return (
    scanFilledExact(start, end, ctx, px, py, isAuto, explicitMode) ??
    scanFilledSnap(start, end, ctx, px, py, isAuto, explicitMode, maxDistance)
  );
}

type NearestContext = FilledSpanContext & {
  readonly panelIds: Uint32Array;
  readonly scene: Scene;
  readonly query: {
    shortlistNearest(
      px: number,
      py: number,
      mode: CandidateInspectMode,
      maxDistance: number,
    ): number[];
    firstNearestRadius(mode: CandidateInspectMode, maxDistance: number): number;
  };
  readonly indexesFact: (id: number) => CandidateFacts | null;
  readonly isFilledPath: Uint8Array;
};

function resolveNearestCandidate(
  ctx: NearestContext,
  id: number,
  px: number,
  py: number,
  isAuto: boolean,
  mode: ResolvedCandidateInspectMode,
  maxDistance: number,
): FilledSpanResult | null {
  if (ctx.isFilledPath[id] === 1) {
    if (ctx.filledSpanStart[id] !== id) return null;
    return bestFilledInSpan(id, isAuto, mode, px, py, maxDistance, ctx);
  }
  const candidateModeValue = candidateMode(id, isAuto, mode, ctx.autoModes);
  if (!hasAxisToken(id, candidateModeValue, ctx.xTokenIds, ctx.yTokenIds)) return null;
  if (candidateModeValue === "exact") {
    const distance = ctx.probe.distance(id);
    return distance === null ? null : { id, distance, orth: 0, mode: candidateModeValue };
  }
  const measured = snapDistance(
    id,
    candidateModeValue,
    ctx.flip,
    px,
    py,
    ctx.xs,
    ctx.ys,
    maxDistance,
  );
  return measured === null ? null : { id, ...measured, mode: candidateModeValue };
}

type NearestSearch = {
  readonly mode: CandidateInspectMode;
  readonly maxDistance: number;
  readonly panelId?: string;
};

function bestOnShortlist(
  ctx: NearestContext,
  px: number,
  py: number,
  search: NearestSearch,
  radius: number,
): FilledSpanResult | null {
  const isAuto = search.mode === "auto";
  const mode: ResolvedCandidateInspectMode = search.mode === "auto" ? "exact" : search.mode;
  let best: FilledSpanResult | null = null;
  let bestGeometric = false;
  for (const id of ctx.query.shortlistNearest(px, py, search.mode, radius)) {
    if (search.panelId !== undefined && ctx.scene.panels[ctx.panelIds[id]!]!.id !== search.panelId)
      continue;
    const candidate = resolveNearestCandidate(ctx, id, px, py, isAuto, mode, search.maxDistance);
    if (candidate === null) continue;
    const geometric = isAuto && candidate.mode === "exact";
    if (geometric && !bestGeometric) {
      best = candidate;
      bestGeometric = true;
      continue;
    }
    if (!geometric && bestGeometric) continue;
    if (
      best === null ||
      candidate.distance < best.distance ||
      (candidate.distance === best.distance && candidate.orth < best.orth)
    )
      best = candidate;
  }
  return best;
}

export function findNearest(
  ctx: NearestContext,
  px: number,
  py: number,
  search: NearestSearch,
): CandidateMatch | null {
  const { mode, maxDistance } = search;
  if (mode === "auto" && Number.isNaN(maxDistance)) return null;
  // Search a narrow radius first. A candidate outside the radius is farther than
  // the radius, so a closer match ends the search. Exact hits are in every shortlist.
  // ponytail: many candidates in one column can fill both passes, which costs twice
  // one full pass. An index sorted per axis removes that limit.
  const narrow = ctx.query.firstNearestRadius(mode, maxDistance);
  let best = narrow < maxDistance ? bestOnShortlist(ctx, px, py, search, narrow) : null;
  if (best === null || !((mode === "auto" && best.mode === "exact") || best.distance < narrow))
    best = bestOnShortlist(ctx, px, py, search, maxDistance);
  if (best === null) return null;
  const found = ctx.indexesFact(best.id);
  return found === null ? null : { ...found, distance: best.distance, mode: best.mode };
}

function traverseSequential(
  startId: number | null,
  direction: "next" | "previous",
  step: number | undefined,
  n: number,
  traversal: Uint32Array,
  traversalRank: Uint32Array,
): number | null {
  if (startId !== null && (!Number.isInteger(startId) || startId < 0 || startId >= n))
    return traversal[0]!;
  if (startId === null && step === undefined) return traversal[0]!;
  const resolvedStep = step ?? 1;
  if (!Number.isInteger(resolvedStep) || !Number.isFinite(resolvedStep)) return startId;
  const at = startId === null ? -1 : traversalRank[startId]!;
  const delta = direction === "next" ? resolvedStep : -resolvedStep;
  return traversal[(((at + delta) % n) + n) % n]!;
}

function traverseDirectional(
  startId: number,
  direction: "left" | "right" | "up" | "down",
  panelIds: Uint32Array,
  traversal: Uint32Array,
  orderByX: Uint32Array,
  xs: Float32Array,
  ys: Float32Array,
): number {
  const panel = panelIds[startId]!;
  const horizontal = direction === "left" || direction === "right";
  const order = horizontal ? orderByX : traversal;
  const primary = horizontal ? xs : ys;
  const orth = horizontal ? ys : xs;
  const [panelStart, panelEnd] = panelRangeInOrder(order, panelIds, panel);
  return directionalNearestInOrder(
    order,
    primary,
    orth,
    panelStart,
    panelEnd,
    startId,
    primary[startId]!,
    orth[startId]!,
    direction === "right" || direction === "down",
  );
}

export function traverseCandidate(
  startId: number | null,
  direction: "next" | "previous" | "first" | "last" | "left" | "right" | "up" | "down",
  step: number | undefined,
  n: number,
  traversal: Uint32Array,
  traversalRank: Uint32Array,
  panelIds: Uint32Array,
  orderByX: Uint32Array,
  xs: Float32Array,
  ys: Float32Array,
): number | null {
  if (n === 0) return null;
  if (direction === "first") return traversal[0]!;
  if (direction === "last") return traversal[n - 1]!;
  if (direction === "next" || direction === "previous")
    return traverseSequential(startId, direction, step, n, traversal, traversalRank);
  if (startId === null) return traversal[0]!;
  if (!Number.isInteger(startId) || startId < 0 || startId >= n) return traversal[0]!;
  return traverseDirectional(startId, direction, panelIds, traversal, orderByX, xs, ys);
}

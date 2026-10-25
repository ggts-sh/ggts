import type { CanonicalAxisToken } from "./candidate-axis-token.js";
import { buildCandidateCoincidence } from "./candidate-store-coincidence.js";
import { createLazyCandidateAxisGroups } from "./candidate-store-axis-groups.js";
import {
  populateCandidateBuffers,
  type CandidateBufferState,
} from "./candidate-store-index-build.js";
import type { CandidateStoreIndexes } from "./candidate-store-index-types.js";
import { candidatePrimitiveCount } from "./candidate-geometry.js";
import type {
  CandidateFacts,
  CandidateStoreOptions,
  ResolvedCandidateInspectMode,
} from "./candidate-store-types.js";
import type { Scene } from "./scene.js";
import type { CellValue } from "./table.js";

export type { CandidateStoreIndexes } from "./candidate-store-index-types.js";

const NO_ROW = 0xffffffff;

/** ResolvedCandidateInspectMode → compact code; shared with pipeline candidate resolvers. */
export const AUTO_MODE_CODE = { exact: 0, x: 1, y: 2, xy: 3 } as const;

export const AUTO_MODES = [
  "exact",
  "x",
  "y",
  "xy",
] as const satisfies readonly ResolvedCandidateInspectMode[];

/**
 * Build candidate identity tables, traversal orders, coincident stacks, and
 * group() bucket permutations. Growable construction buffers are cleared at
 * the end of this function (retained-memory budget boundary).
 */

export function buildCandidateStoreIndexes(
  scene: Scene,
  options: CandidateStoreOptions = {},
): CandidateStoreIndexes {
  const epoch = options.epoch ?? 0;
  const flip = options.flip ?? false;
  const hitTolerance = options.hitTolerance ?? 3;
  const uninspectable = options.uninspectableLayers;
  // Capacity-first construction: growable number[] buffers paid a push
  // (with capacity doubling) plus a full typed-array conversion copy per
  // candidate column. Upper-bound the candidate count up front and write
  // the final typed arrays directly; trim to the exact count at the end.
  let capacity = 0;
  for (const batch of scene.batches) {
    if (scene.panels[batch.panelIndex] === undefined) continue;
    if (uninspectable?.has(batch.layerIndex) === true) continue;
    // Exact candidate count (not primitiveCount): path batches reserve per
    // ANCHOR, not per tessellated vertex, and candidates:false batches
    // reserve nothing — otherwise map/area layers briefly reserve memory
    // for every vertex and pay 15 slice() copies to shrink it back.
    capacity += candidatePrimitiveCount(batch);
  }
  const batchIdsBuf = new Uint32Array(capacity);
  const primitiveIdsBuf = new Uint32Array(capacity);
  const panelIdsBuf = new Uint32Array(capacity);
  const rowsBuf = new Uint32Array(capacity);
  const seriesBuf = new Uint32Array(capacity);
  const ranksBuf = new Uint32Array(capacity);
  const sourcesBuf = new Uint32Array(capacity);
  const lineagesBuf = new Uint32Array(capacity);
  const autoModesBuf = new Uint8Array(capacity);
  const xsBuf = new Float32Array(capacity);
  const ysBuf = new Float32Array(capacity);
  const xTokenIdsBuf = new Int32Array(capacity);
  const yTokenIdsBuf = new Int32Array(capacity);
  const xDatesBuf = new Uint8Array(capacity);
  const yDatesBuf = new Uint8Array(capacity);
  const invalidX = new Map<number, CellValue>();
  const invalidY = new Map<number, CellValue>();
  // NaN / ±Infinity plot-px anchors make the traversal comparator's
  // subtraction unstable; tracked here so coincident grouping can pick a
  // finite-only fast path.
  let anyNonFiniteAnchor = false;
  const sizeValues: CellValue[] = [];
  const linewidthValues: CellValue[] = [];
  const alphaValues: CellValue[] = [];
  const shapeValues: CellValue[] = [];
  const linetypeValues: CellValue[] = [];
  const tokens: CanonicalAxisToken[] = [];
  // Kind-dispatched interning: the previous single Map keyed on tokenKey()
  // strings paid one `n:${value}` / `s:${len}:${value}` allocation per
  // candidate per axis; per-kind maps key on the value itself. Intern order
  // (first-seen id) is unchanged, so downstream token ids are identical.
  const numberTokenIndex = new Map<number, number>();
  const stringTokenIndex = new Map<string, number>();
  const booleanTokenIndex = new Map<boolean, number>();
  // Peek by raw value before allocating a CanonicalAxisToken: a repeat hit
  // (dense plots repeat axis values constantly) then costs one Map lookup
  // and no object allocation. Misses allocate the same token
  // canonicalAxisToken would build (Date → epoch number, -0 → 0).
  const remember = (value: CellValue): number => {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return -1;
      const canonical = Object.is(value, -0) ? 0 : value;
      const prior = numberTokenIndex.get(canonical);
      if (prior !== undefined) return prior;
      const id = tokens.length;
      tokens.push({ kind: "number", value: canonical });
      numberTokenIndex.set(canonical, id);
      return id;
    }
    if (typeof value === "string") {
      const prior = stringTokenIndex.get(value);
      if (prior !== undefined) return prior;
      const id = tokens.length;
      tokens.push({ kind: "string", value });
      stringTokenIndex.set(value, id);
      return id;
    }
    if (typeof value === "boolean") {
      const prior = booleanTokenIndex.get(value);
      if (prior !== undefined) return prior;
      const id = tokens.length;
      tokens.push({ kind: "boolean", value });
      booleanTokenIndex.set(value, id);
      return id;
    }
    if (value instanceof Date) {
      const time = value.getTime();
      if (!Number.isFinite(time)) return -1;
      const prior = numberTokenIndex.get(time);
      if (prior !== undefined) return prior;
      const id = tokens.length;
      tokens.push({ kind: "number", value: time });
      numberTokenIndex.set(time, id);
      return id;
    }
    return -1;
  };

  const buildState: CandidateBufferState = {
    n: 0,
    anyNonFiniteAnchor: false,
    batchIds: batchIdsBuf,
    primitiveIds: primitiveIdsBuf,
    panelIds: panelIdsBuf,
    rows: rowsBuf,
    series: seriesBuf,
    ranks: ranksBuf,
    sources: sourcesBuf,
    lineages: lineagesBuf,
    autoModes: autoModesBuf,
    xs: xsBuf,
    ys: ysBuf,
    xTokenIds: xTokenIdsBuf,
    yTokenIds: yTokenIdsBuf,
    xDates: xDatesBuf,
    yDates: yDatesBuf,
    invalidX,
    invalidY,
    sizeValues,
    linewidthValues,
    alphaValues,
    shapeValues,
    linetypeValues,
    remember,
  };
  const n = populateCandidateBuffers(scene, options, uninspectable, buildState);
  anyNonFiniteAnchor = buildState.anyNonFiniteAnchor;

  // Exact-count trim: when eligibility skipped primitives the capacity was
  // an upper bound, so slice the tails off (a view when exact — the common
  // all-candidates case — a copy otherwise).
  const trim = <T extends { slice(start: number, end: number): T; length: number }>(arr: T): T =>
    n === arr.length ? arr : arr.slice(0, n);
  const batchIds = trim(batchIdsBuf);
  const primitiveIds = trim(primitiveIdsBuf);
  const panelIds = trim(panelIdsBuf);
  const rows = trim(rowsBuf);
  const series = trim(seriesBuf);
  const ranks = trim(ranksBuf);
  const sources = trim(sourcesBuf);
  const lineages = trim(lineagesBuf);
  const autoModes = trim(autoModesBuf);
  const xs = trim(xsBuf);
  const ys = trim(ysBuf);
  const xTokenIds = trim(xTokenIdsBuf);
  const yTokenIds = trim(yTokenIdsBuf);
  const xDates = trim(xDatesBuf);
  const yDates = trim(yDatesBuf);

  const logicalValue = (id: number, axis: "x" | "y"): CellValue => {
    const ids = axis === "x" ? xTokenIds : yTokenIds;
    const tokenId = ids[id]!;
    if (tokenId === -1) return (axis === "x" ? invalidX : invalidY).get(id) ?? null;
    const token = tokens[tokenId]!;
    if ((axis === "x" ? xDates : yDates)[id] === 1 && token.kind === "number")
      return new Date(token.value);
    return token.value;
  };

  const fact = (id: number): CandidateFacts | null => {
    if (!Number.isInteger(id) || id < 0 || id >= n) return null;
    const batchIndex = batchIds[id]!;
    const batch = scene.batches[batchIndex]!;
    const panelIndex = panelIds[id]!;
    const raw = rows[id]!;
    return {
      candidateIndex: id,
      id,
      epoch,
      batchIndex,
      primitiveIndex: primitiveIds[id]!,
      layerIndex: batch.layerIndex,
      panelIndex,
      panelId: scene.panels[panelIndex]!.id,
      rowIndex: raw === NO_ROW ? null : raw,
      kind: batch.kind,
      x: xs[id]!,
      y: ys[id]!,
      xValue: logicalValue(id, "x"),
      yValue: logicalValue(id, "y"),
      sizeValue: sizeValues[id] ?? null,
      linewidthValue: linewidthValues[id] ?? null,
      alphaValue: alphaValues[id] ?? null,
      shapeValue: shapeValues[id] ?? null,
      linetypeValue: linetypeValues[id] ?? null,
      xToken: xTokenIds[id] === -1 ? null : tokens[xTokenIds[id]!]!,
      yToken: yTokenIds[id] === -1 ? null : tokens[yTokenIds[id]!]!,
      seriesId: series[id]!,
      seriesRank: ranks[id]!,
      sourceOrder: sources[id]!,
      lineage: lineages[id]!,
      autoMode: AUTO_MODES[autoModes[id]!]!,
    };
  };

  const order = Array.from({ length: n }, (_, id) => id);
  const traversal = Uint32Array.from(
    order.toSorted(
      (a, b) =>
        panelIds[a]! - panelIds[b]! ||
        ys[a]! - ys[b]! ||
        xs[a]! - xs[b]! ||
        batchIds[a]! - batchIds[b]! ||
        primitiveIds[a]! - primitiveIds[b]!,
    ),
  );
  // Dense inverse of `traversal`: candidate id → sequential rank (O(1) next/previous).
  const traversalRank = new Uint32Array(n);
  for (let i = 0; i < n; i++) traversalRank[traversal[i]!] = i;

  // Panel-then-x order for left/right directional traverse (O(log n + k)).
  // Up/down reuses `traversal` (already sorted panel → y → x → …).
  // Non-finite primary coords sort after finite so lower_bound stays valid.
  const orderByX = Uint32Array.from({ length: n }, (_, id) => id);
  orderByX.sort((a, b) => {
    const panelDelta = panelIds[a]! - panelIds[b]!;
    if (panelDelta !== 0) return panelDelta;
    const xa = xs[a]!;
    const xb = xs[b]!;
    const aFinite = Number.isFinite(xa);
    const bFinite = Number.isFinite(xb);
    if (aFinite && bFinite) {
      const d = xa - xb;
      if (d !== 0) return d;
    } else if (aFinite !== bFinite) return aFinite ? -1 : 1;
    return a - b;
  });

  const { coincidentStack, coincidentAt } = buildCandidateCoincidence({
    n,
    panelIds,
    xs,
    ys,
    traversal,
    anyNonFiniteAnchor,
  });
  const group = createLazyCandidateAxisGroups({
    scene,
    n,
    flip,
    tokens,
    batchIds,
    panelIds,
    ranks,
    series,
    sources,
    xTokenIds,
    yTokenIds,
    xs,
    ys,
    logicalValue,
  });

  // Do not retain construction scratch beside the store (the 100k-candidate
  // retained-memory budget is measured after this boundary). The per-
  // candidate columns were written into their final typed arrays directly,
  // so only the permutation scratch order and the interning maps remain.
  order.length = 0;
  numberTokenIndex.clear();
  stringTokenIndex.clear();
  booleanTokenIndex.clear();
  return {
    scene,
    epoch,
    flip,
    hitTolerance,
    n,
    batchIds,
    primitiveIds,
    panelIds,
    rows,
    series,
    ranks,
    sources,
    lineages,
    autoModes,
    xs,
    ys,
    xTokenIds,
    yTokenIds,
    xDates,
    yDates,
    tokens,
    invalidX,
    invalidY,
    traversal,
    traversalRank,
    orderByX,
    coincidentStack,
    coincidentAt,
    group,
    fact,
  };
}

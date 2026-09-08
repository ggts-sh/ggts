/**
 * Inspection coordinator: two-slot memo (transient + pinned), semantic /
 * presentation fingerprints, and pin rebind across layout/identity epochs.
 *
 * Snapshot materialization lives in `./resolver.ts`. This module owns identity
 * tokens, cache keys, and the mutable coordinator factory only.
 */
import type { CandidateFacts, CanonicalAxisToken, CellValue, RenderModel } from "@ggts-sh/core";

import type {
  InteractionSource,
  PlotInspectionChange,
  ResolvedInspectMode,
} from "../interaction/interaction.js";
import {
  materializeInspection,
  resolvedTarget,
  selectTransientMembers,
  type InspectionSnapshotCompleteness,
  type ResolveInspectionInput,
} from "./resolver.js";
import { compositionGroupTotal } from "./group-total.js";

export interface CoordinatedInspectionInput<
  Row extends Record<string, CellValue>,
  Key extends PropertyKey,
> extends ResolveInspectionInput<Row, Key> {
  /** Changes only when source identity/order changes, never for layout-only renders. */
  readonly identityEpoch: PropertyKey;
  /** Changes whenever layout/geometry changes. */
  readonly layoutEpoch: PropertyKey;
  /** Complete is required for pins, custom content, and public callbacks. */
  readonly completeness?: InspectionSnapshotCompleteness;
}

export interface CoordinatedInspection<Row, Key> {
  /** Internal seed retained by the chart-local coordinator, never emitted. */
  readonly seed: CandidateFacts;
  readonly snapshot: PlotInspectionChange<Row, Key>;
  readonly semanticFingerprint: string;
  readonly presentationIdentity: string;
  readonly semanticChanged: boolean;
  readonly presentationChanged: boolean;
}

/**
 * Stable emit-dedupe token for inspection clear events.
 * Non-clear emissions must use the coordinator's `semanticFingerprint`
 * (type-aware key identity); hosts must not invent a second fingerprint.
 */
export function clearInspectionFingerprint(source: InteractionSource): string {
  return `clear:${source}`;
}

const PRESENTATION_ORDERING_VERSION = 1;

function axisToken(token: CanonicalAxisToken | null): string {
  if (token === null) return "invalid";
  return `${token.kind}:${String(token.value)}`;
}

function cellToken(value: CellValue): string {
  if (value === null) return "null";
  if (value instanceof Date) return `date:${value.getTime()}`;
  if (typeof value === "number") return `number:${Object.is(value, -0) ? 0 : value}`;
  return `${typeof value}:${String(value)}`;
}

/**
 * Stable cell payload for semantic fingerprints. Insertion order of Object.keys
 * is used (no O(F log F) sort): same row object is stable; content-equal clones
 * with different key order may re-emit (safe over-emit, not under-emit).
 */
function rowCellPayload(row: Record<string, CellValue>): string {
  const parts: string[] = [];
  for (const field of Object.keys(row)) {
    parts.push(`${field}=${cellToken(row[field] ?? null)}`);
  }
  return parts.join(",");
}

/**
 * Per-batch role token within one layer's batches of the same geometry kind.
 * Absolute scene batch indices can shift when unrelated layers change; the
 * role still distinguishes composite pieces (smooth ribbon/line, boxplot
 * whisker/median). Built once per model — O(B) prep, O(1) lookup (#1329).
 */
function buildBatchRoles(model: RenderModel): readonly string[] {
  const batches = model.scene.batches;
  const roles: string[] = [];
  const ordinalByLayerKind = new Map<string, number>();
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index]!;
    const layerKind = `${String(batch.layerIndex)}\0${batch.kind}`;
    const ordinal = ordinalByLayerKind.get(layerKind) ?? 0;
    roles.push(`${batch.kind}:${ordinal}`);
    ordinalByLayerKind.set(layerKind, ordinal + 1);
  }
  return roles;
}

/** O(1) role for a candidate against a precomputed per-model role table. */
function candidateBatchRole(
  model: RenderModel,
  candidate: CandidateFacts,
  roles: readonly string[],
): string {
  const batch = model.scene.batches[candidate.batchIndex];
  if (
    batch === undefined ||
    batch.layerIndex !== candidate.layerIndex ||
    batch.kind !== candidate.kind
  )
    return `${candidate.kind}:missing`;
  return roles[candidate.batchIndex] ?? `${candidate.kind}:missing`;
}

function exactGroupTotalToken(
  mode: ResolvedInspectMode,
  model: RenderModel,
  seed: CandidateFacts,
): string {
  if (mode !== "exact" && mode !== "xy") return "";
  return String(compositionGroupTotal(model, seed));
}

/**
 * Internal adapter coordinator. It owns exactly one transient and one pinned
 * immutable snapshot; replacement, release, and invalidation drop references
 * immediately instead of growing a scene-wide rich-object cache.
 */
export function createInspectionCoordinator<
  Row extends Record<string, CellValue>,
  Key extends PropertyKey,
>(keyAt: (index: number) => Key | null) {
  type Slot = Readonly<{
    key: string;
    value: CoordinatedInspection<Row, Key>;
    /** Candidate id at pin time — O(1) rebind when identityEpoch is unchanged. */
    seedId: number;
    seedKey: Key | null;
    seedRow: number | null;
    seedKind: CandidateFacts["kind"];
    seedBatchRole: string;
    seedPrimitiveIndex: number;
    seedLogicalIdentity: string;
    layerIndex: number;
    identityEpoch: PropertyKey;
    mode: ResolvedInspectMode;
  }>;
  let transient: Slot | null = null;
  let pinned: Slot | null = null;
  let lastSemanticFingerprint: string | null = null;
  let lastPresentationIdentity: string | null = null;
  let lastSlot: "transient" | "pinned" | null = null;
  /** Last model whose batch-role table is cached (identity compare). */
  let batchRoleModel: RenderModel | null = null;
  let batchRoles: readonly string[] = [];
  const rolesFor = (model: RenderModel): readonly string[] => {
    if (batchRoleModel === model) return batchRoles;
    batchRoles = buildBatchRoles(model);
    batchRoleModel = model;
    return batchRoles;
  };
  const symbolIds = new Map<symbol, number>();
  const epochIds = new Map<symbol, number>();
  const epochToken = (value: PropertyKey): string => {
    if (typeof value !== "symbol") return `${typeof value}:${String(value)}`;
    let id = epochIds.get(value);
    if (id === undefined) {
      id = epochIds.size;
      epochIds.set(value, id);
    }
    return `symbol:${id}`;
  };
  const semanticKeyToken = (key: PropertyKey | null, fallback: string): string => {
    if (key === null) return fallback;
    if (typeof key === "symbol") {
      let id = symbolIds.get(key);
      if (id === undefined) {
        id = symbolIds.size;
        symbolIds.set(key, id);
      }
      return `symbol:${id}`;
    }
    return `${typeof key}:${String(key)}`;
  };

  const resolve = (
    input: Omit<CoordinatedInspectionInput<Row, Key>, "keyOf">,
  ): CoordinatedInspection<Row, Key> | null => {
    const target = resolvedTarget(input.model, input.seed, input.mode);
    if (target === null) return null;
    const completeness =
      input.state === "pinned" ? "complete" : (input.completeness ?? "transient");
    // Pin/complete fingerprints the full group; transient matches materialize's
    // top-k window so pointer inspect is O(min(M,8)·F), not O(M·F log F) (#1274).
    const fingerprintMembers =
      completeness === "complete"
        ? target.members
        : selectTransientMembers(target.members, target.group?.focusId ?? input.seed.id, {
            groupAxis: input.mode === "y" ? "y" : "x",
          });
    const semanticMembers = fingerprintMembers.map((candidate) => {
      const row = candidate.rowIndex === null ? null : input.model.row(candidate.rowIndex);
      const key = row === null || candidate.rowIndex === null ? null : keyAt(candidate.rowIndex);
      const fallback = `lineage:${input.model.lineage.keys(candidate.lineage).join(",")}`;
      const payload =
        row === null
          ? `${axisToken(candidate.xToken)},${axisToken(candidate.yToken)}`
          : rowCellPayload(row);
      return `${semanticKeyToken(key, fallback)}{${payload}}`;
    });
    const focusRow = input.seed.rowIndex === null ? null : input.model.row(input.seed.rowIndex);
    const focusKey =
      focusRow === null || input.seed.rowIndex === null ? null : keyAt(input.seed.rowIndex);
    const focusIdentity = semanticKeyToken(
      focusKey,
      `lineage:${input.model.lineage.keys(input.seed.lineage).join(",")}`,
    );
    const logicalToken =
      input.mode === "x"
        ? axisToken(input.seed.xToken)
        : input.mode === "y"
          ? axisToken(input.seed.yToken)
          : `${axisToken(input.seed.xToken)}|${axisToken(input.seed.yToken)}`;
    const semanticFingerprint = [
      input.mode,
      input.seed.panelId,
      logicalToken,
      focusIdentity,
      semanticMembers.join(";"),
      input.state,
      exactGroupTotalToken(input.mode, input.model, input.seed),
    ].join("|");

    const range = target.group?.range;
    // Mirror fingerprintMembers: transient pinches presentation id to the same
    // member window as materialize (layoutEpoch + range already cover the bucket).
    const presentationMembers = fingerprintMembers;
    const presentationIdentity = [
      epochToken(input.layoutEpoch),
      PRESENTATION_ORDERING_VERSION,
      range === undefined
        ? `candidate:${input.seed.id}`
        : `${range.axis}:${range.start}:${range.end}`,
      presentationMembers
        .map((candidate) => `${candidate.id}@${candidate.x},${candidate.y}`)
        .join(";"),
    ].join("|");
    const cacheKey = `${epochToken(input.layoutEpoch)}|${presentationIdentity}|${semanticFingerprint}|${completeness}|${input.source}`;
    const current = input.state === "pinned" ? pinned : transient;
    if (current?.key === cacheKey) return current.value;
    const snapshot = materializeInspection<Row, Key>(input, target, completeness, keyAt);
    const value = Object.freeze({
      seed: input.seed,
      snapshot,
      semanticFingerprint,
      presentationIdentity,
      semanticChanged: semanticFingerprint !== lastSemanticFingerprint,
      presentationChanged: presentationIdentity !== lastPresentationIdentity,
    });
    const slot: Slot = {
      key: cacheKey,
      value,
      seedId: input.seed.id,
      seedKey: focusKey,
      seedRow: input.seed.rowIndex,
      seedKind: input.seed.kind,
      seedBatchRole: candidateBatchRole(input.model, input.seed, rolesFor(input.model)),
      seedPrimitiveIndex: input.seed.primitiveIndex,
      seedLogicalIdentity: `${axisToken(input.seed.xToken)}|${axisToken(input.seed.yToken)}|${input.model.lineage.keys(input.seed.lineage).join(",")}`,
      layerIndex: input.seed.layerIndex,
      identityEpoch: input.identityEpoch,
      mode: input.mode,
    };
    if (input.state === "pinned") pinned = slot;
    else transient = slot;
    lastSemanticFingerprint = semanticFingerprint;
    lastPresentationIdentity = presentationIdentity;
    lastSlot = input.state === "pinned" ? "pinned" : "transient";
    return value;
  };

  /** Keyless pin match: cheap filters then O(L) logical identity (#229). */
  const keylessPinMatch = (
    model: RenderModel,
    prior: Slot,
    candidate: CandidateFacts,
    roles: readonly string[],
  ): boolean => {
    if (candidate.layerIndex !== prior.layerIndex) return false;
    if (candidate.rowIndex !== prior.seedRow) return false;
    if (candidate.kind !== prior.seedKind) return false;
    if (candidate.primitiveIndex !== prior.seedPrimitiveIndex) return false;
    if (candidateBatchRole(model, candidate, roles) !== prior.seedBatchRole) return false;
    const logicalIdentity = `${axisToken(candidate.xToken)}|${axisToken(candidate.yToken)}|${model.lineage.keys(candidate.lineage).join(",")}`;
    return logicalIdentity === prior.seedLogicalIdentity;
  };

  /**
   * Keyed pin match: layer + non-null row whose key equals the pinned key.
   * Key first — `model.row` allocates a full Record (O(F)). Identity-change
   * full-scans must not pay that for every candidate in the layer (#1318 /
   * #1329). Live-row gate stays: key bag can outlive a dropped source index.
   */
  const keyedPinMatch = (model: RenderModel, prior: Slot, candidate: CandidateFacts): boolean => {
    if (candidate.layerIndex !== prior.layerIndex || candidate.rowIndex === null) return false;
    if (keyAt(candidate.rowIndex) !== prior.seedKey) return false;
    return model.row(candidate.rowIndex) !== null;
  };

  /**
   * Strict keyed rebind for the seedId fast path: key match plus kind / batch
   * role / primitive (same filters as multi-match disambiguation). Same-epoch
   * is not always pure layout — layer-prop swaps can keep the identity token
   * while changing primitives that reuse an id (Codex #272 P2).
   */
  const keyedPinRoleMatch = (
    model: RenderModel,
    prior: Slot,
    candidate: CandidateFacts,
    roles: readonly string[],
  ): boolean =>
    keyedPinMatch(model, prior, candidate) &&
    candidate.kind === prior.seedKind &&
    candidate.primitiveIndex === prior.seedPrimitiveIndex &&
    candidateBatchRole(model, candidate, roles) === prior.seedBatchRole;

  const preferredPinnedSeed = (
    model: RenderModel,
    prior: Slot,
    identityEpoch: PropertyKey,
    roles: readonly string[],
  ): CandidateFacts | null => {
    if (prior.identityEpoch !== identityEpoch) return null;
    const preferred = model.candidates.candidate(prior.seedId);
    if (preferred === null) return null;
    if (prior.seedKey === null)
      return keylessPinMatch(model, prior, preferred, roles) ? preferred : null;
    return keyedPinRoleMatch(model, prior, preferred, roles) ? preferred : null;
  };

  const uniqueKeylessPinnedSeed = (
    model: RenderModel,
    prior: Slot,
    roles: readonly string[],
  ): CandidateFacts | null => {
    const matches: CandidateFacts[] = [];
    for (let id = 0; id < model.candidates.size; id++) {
      const candidate = model.candidates.candidate(id);
      if (candidate !== null && keylessPinMatch(model, prior, candidate, roles))
        matches.push(candidate);
    }
    return matches.length === 1 ? matches[0]! : null;
  };

  const uniqueKeyedPinnedSeed = (
    model: RenderModel,
    prior: Slot,
    roles: readonly string[],
  ): CandidateFacts | null => {
    const matches: CandidateFacts[] = [];
    for (let id = 0; id < model.candidates.size; id++) {
      const candidate = model.candidates.candidate(id);
      if (candidate !== null && keyedPinMatch(model, prior, candidate)) matches.push(candidate);
    }
    if (matches.length === 1) return matches[0]!;
    if (matches.length < 2) return null;
    const sourceRows = new Set(matches.map((candidate) => candidate.rowIndex));
    if (sourceRows.size !== 1) return null;
    const sameRole = matches.filter(
      (candidate) =>
        candidate.kind === prior.seedKind &&
        candidateBatchRole(model, candidate, roles) === prior.seedBatchRole &&
        candidate.primitiveIndex === prior.seedPrimitiveIndex,
    );
    return sameRole.length === 1 ? sameRole[0]! : null;
  };

  const clearPinned = (): void => {
    pinned = null;
    if (lastSlot !== "pinned") return;
    lastSemanticFingerprint = null;
    lastPresentationIdentity = null;
    lastSlot = null;
  };

  const reconcilePinned = (
    input: Readonly<{
      model: RenderModel;
      identityEpoch: PropertyKey;
      layoutEpoch: PropertyKey;
      source?: InteractionSource;
      completeness?: InspectionSnapshotCompleteness;
    }>,
  ): CoordinatedInspection<Row, Key> | null => {
    const prior = pinned;
    if (prior === null) return null;
    const roles = rolesFor(input.model);
    // Same identityEpoch: O(1) seedId revalidation when id + role still match.
    // Keyed path requires kind/batch/primitive (not only layer+key) so geom
    // swaps that reuse seedId cannot pin the wrong primitive. Fall through to
    // full scan on miss. Identity-change keyed still full-scans for ambiguity;
    // keyless identity-change clears immediately below.
    let seed = preferredPinnedSeed(input.model, prior, input.identityEpoch, roles);
    if (seed === null && prior.seedKey === null) {
      if (prior.identityEpoch !== input.identityEpoch) {
        clearPinned();
        return null;
      }
      seed = uniqueKeylessPinnedSeed(input.model, prior, roles);
    } else {
      seed ??= uniqueKeyedPinnedSeed(input.model, prior, roles);
    }
    if (seed === null) {
      clearPinned();
      return null;
    }
    return resolve({
      model: input.model,
      seed,
      mode: prior.mode,
      state: "pinned",
      source: input.source ?? "programmatic",
      identityEpoch: input.identityEpoch,
      layoutEpoch: input.layoutEpoch,
      completeness: input.completeness ?? "complete",
    });
  };

  return {
    resolve,
    reconcilePinned,
    release(slot: "transient" | "pinned"): void {
      if (slot === "transient") transient = null;
      else pinned = null;
      if (lastSlot === slot) {
        lastSemanticFingerprint = null;
        lastPresentationIdentity = null;
        lastSlot = null;
      }
    },
    invalidate(): void {
      transient = null;
      pinned = null;
      lastSemanticFingerprint = null;
      lastPresentationIdentity = null;
      lastSlot = null;
      batchRoleModel = null;
      batchRoles = [];
      symbolIds.clear();
      epochIds.clear();
    },
    get memoSize(): number {
      return Number(transient !== null) + Number(pinned !== null);
    },
  };
}

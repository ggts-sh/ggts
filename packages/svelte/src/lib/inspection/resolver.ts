/**
 * Pure inspection snapshot materialization.
 *
 * Builds immutable PlotInspectionChange snapshots from a seed candidate.
 * The two-slot coordinator (fingerprints, pin rebind, memo) lives in
 * `./coordinator.ts` and is re-exported below for the stable `resolver.js`
 * import path used by production + tests.
 */
import type { CandidateFacts, CandidateGroup, CellValue, RenderModel } from "@ggsvelte/core";

import type {
  InteractionSource,
  PlotDatum,
  PlotInspectionChange,
  ResolvedInspectMode,
} from "../interaction/interaction.js";
import { uniqueKeysFromRowIndexes } from "../selection/selection.js";
import {
  candidateValueContribution,
  compositionGroupTotal,
  contributionIdentity,
  groupHasAdditivePosition,
  groupMagnitudeTotal,
  valueFieldName,
} from "./group-total.js";

export interface ResolveInspectionInput<
  Row extends Record<string, CellValue>,
  Key extends PropertyKey,
> {
  readonly model: RenderModel;
  readonly seed: CandidateFacts;
  readonly mode: ResolvedInspectMode;
  readonly state: "transient" | "pinned";
  readonly source: InteractionSource;
  readonly keyOf: (row: Row, index: number) => Key | null;
}

export type InspectionSnapshotCompleteness = "transient" | "complete";

export interface ResolvedTarget {
  readonly seed: CandidateFacts;
  readonly members: readonly CandidateFacts[];
  readonly group: CandidateGroup | null;
}

/**
 * Shared with the coordinator so transient fingerprint windows match
 * materialize's member cap (single source — do not duplicate the literal).
 */
export const TRANSIENT_MEMBER_LIMIT = 8;

/**
 * Magnitude used to rank hover slots for high-n stacks (#1274).
 * Group by x → rank on |y|; group by y → rank on |x|. Non-numeric → 0.
 */
function candidateValueMagnitude(candidate: CandidateFacts, groupAxis: "x" | "y"): number {
  const value = groupAxis === "x" ? candidate.yValue : candidate.xValue;
  if (typeof value === "number" && Number.isFinite(value)) return Math.abs(value);
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? Math.abs(time) : 0;
  }
  return 0;
}

/**
 * Unique series-contribution count in the full axis group (#1274 / #1389).
 * Drives "+N more" after display collapse; must span layers so a thin
 * overlay focus does not hide truncation of a large stack beneath it.
 */
function groupSeriesCount(
  model: RenderModel,
  members: readonly CandidateFacts[],
  groupAxis: "x" | "y",
): number {
  const seen = new Set<string>();
  for (const member of members) {
    const contribution = candidateValueContribution(member, groupAxis);
    // Count series even when the value is non-numeric so overflow still
    // reflects listed display rows (Total may be null separately).
    seen.add(contributionIdentity(member, contribution, valueFieldName(model, member, groupAxis)));
  }
  return seen.size;
}

/**
 * Select ≤ `limit` axis-group candidates for a transient hover snapshot (#1274).
 *
 * - When the group fits in the limit, preserve input (stack / series) order.
 * - When over the limit: force-include `focusId`, fill remaining slots with
 *   the largest |value| on the orthogonal axis, focus first then by magnitude.
 */
export function selectTransientMembers(
  members: readonly CandidateFacts[],
  focusId: number,
  options: {
    readonly groupAxis: "x" | "y";
    readonly limit?: number;
  },
): readonly CandidateFacts[] {
  const limit = options.limit ?? TRANSIENT_MEMBER_LIMIT;
  if (limit <= 0) return [];
  if (members.length <= limit) return members;

  const groupAxis = options.groupAxis;
  let focus: CandidateFacts | null = null;
  const others: CandidateFacts[] = [];
  for (const member of members) {
    if (member.id === focusId) focus = member;
    else others.push(member);
  }

  others.sort((left, right) => {
    const delta =
      candidateValueMagnitude(right, groupAxis) - candidateValueMagnitude(left, groupAxis);
    if (delta !== 0) return delta;
    // Stable-ish: lower candidate id wins ties (deterministic, not stack order).
    return left.id - right.id;
  });

  if (focus === null) {
    return others.slice(0, limit);
  }
  if (limit === 1) return [focus];
  return [focus, ...others.slice(0, limit - 1)];
}

export function resolvedTarget(
  model: RenderModel,
  seed: CandidateFacts,
  mode: ResolvedInspectMode,
): ResolvedTarget | null {
  if (mode === "exact" || mode === "xy") return { seed, members: [seed], group: null };
  const group = model.candidates.group(seed.id, mode);
  if (group === null) return null;
  const members = [...group.memberIds]
    .map((id) => model.candidates.candidate(id))
    .filter((candidate): candidate is CandidateFacts => candidate !== null);
  return { seed, members: members.length === 0 ? [seed] : members, group };
}

function datum<Row extends Record<string, CellValue>, Key extends PropertyKey>(
  model: RenderModel,
  candidate: CandidateFacts,
  keyAt: (index: number) => Key | null,
): PlotDatum<Row, Key> {
  const row = candidate.rowIndex === null ? null : (model.row(candidate.rowIndex) as Row | null);
  // The row gate stays: a member whose row does not resolve has no key, even
  // when the resolver would hand one back for that index.
  const key = row === null || candidate.rowIndex === null ? null : keyAt(candidate.rowIndex);
  // Set-based first-seen dedup (O(R)) — same pattern as selection helpers.
  // Array#includes here was O(R²) for large aggregate/stat lineages (#200).
  // Resolving by index keeps this O(R) lookups rather than O(R) row copies:
  // model.row rebuilds an object per call, and the key never needed it.
  const sourceKeys = uniqueKeysFromRowIndexes(
    model.lineage.keys(candidate.lineage),
    keyAt,
  ) as Key[];
  // CandidateFacts only bag position + size channels. Discrete series
  // aesthetics (fill/color) and weight live on source rows; for stat
  // aggregates those rows are reachable via lineage only (#1526).
  const candidateValue = (channel: string): CellValue | undefined => {
    switch (channel) {
      case "x":
        return candidate.xValue;
      case "y":
        return candidate.yValue;
      case "size":
        return candidate.sizeValue;
      case "linewidth":
        return candidate.linewidthValue;
      case "alpha":
        return candidate.alphaValue;
      case "shape":
        return candidate.shapeValue;
      case "linetype":
        return candidate.linetypeValue;
      default:
        return undefined;
    }
  };
  /**
   * Recover a non-CandidateFacts field from lineage source rows.
   * - fill/color/group when discrete (ordinal/manual/identity scale, or group):
   *   first source row, O(1) — grouping makes the value constant.
   * - fill/color when continuous (sequential/binned) and multi-row lineage:
   *   null — continuous channels do not participate in grouping, so values
   *   can disagree and we refuse to invent a series identity.
   * - Everything else (weight, …): only when lineage has exactly one row.
   *
   * Indexes + first row are memoized for this datum so multi-field tooltips
   * do not re-materialize the same source row per channel.
   */
  let lineageIndexes: readonly number[] | undefined;
  let firstLineageRow: Record<string, CellValue> | null | undefined;
  const seriesConstantByConstruction = (channel: string): boolean => {
    if (channel === "group") return true;
    if (channel !== "fill" && channel !== "color") return false;
    const scale = channel === "fill" ? model.scales.fill : model.scales.color;
    if (scale === null) return true;
    return scale.kind === "ordinal" || scale.kind === "manual" || scale.kind === "identity";
  };
  const lineageFieldValue = (channel: string, fieldName: string): CellValue => {
    lineageIndexes ??= model.lineage.keys(candidate.lineage);
    if (lineageIndexes.length === 0) return null;
    const seriesIdentity = channel === "fill" || channel === "color" || channel === "group";
    if (seriesIdentity) {
      if (lineageIndexes.length > 1 && !seriesConstantByConstruction(channel)) return null;
    } else if (lineageIndexes.length !== 1) {
      return null;
    }
    if (firstLineageRow === undefined) {
      firstLineageRow = model.row(lineageIndexes[0]!);
    }
    if (firstLineageRow === null) return null;
    return firstLineageRow[fieldName] ?? null;
  };
  const fields = (model.layerFields[candidate.layerIndex] ?? []).map((field) => {
    // after_stat channels never live on the source table under their generated
    // names (bindot keeps real source rowIndex for color/lineage while x/y are
    // bin center + stackpos — #803). Prefer CandidateFacts position values;
    // do not look up "x"/"stackpos" on the observation row.
    if (field.source === "stat") {
      const fromCandidate = candidateValue(field.channel);
      if (fromCandidate !== undefined) return { ...field, value: fromCandidate };
      return { ...field, value: null };
    }
    // Stack/fill publish the post-position measure on the candidate. The source
    // row still holds the pre-position column (counts / raw y), so identity
    // cols would otherwise show 873 while Total sums shares.
    const position = model.layerPositions?.[candidate.layerIndex];
    if ((position === "stack" || position === "fill") && field.channel === "y") {
      const fromCandidate = candidateValue(field.channel);
      if (fromCandidate !== undefined) return { ...field, value: fromCandidate };
    }
    if (row !== null) {
      return { ...field, value: row[field.field] ?? null };
    }
    const fromCandidate = candidateValue(field.channel);
    if (fromCandidate !== undefined) return { ...field, value: fromCandidate };
    return { ...field, value: lineageFieldValue(field.channel, field.field) };
  });
  return Object.freeze({
    key,
    row,
    sourceKeys: Object.freeze(sourceKeys),
    lineageCount: model.lineage.count(candidate.lineage),
    layerIndex: candidate.layerIndex,
    panelId: candidate.panelId,
    fields: Object.freeze(fields),
    anchor: Object.freeze({ x: candidate.x, y: candidate.y }),
  });
}

function axisLabel(model: RenderModel, mode: "x" | "y", value: CellValue): string {
  if (value === null) return "–";
  return model.axisFormatters[mode](value);
}

/**
 * The only rich inspection constructor. Tooltip, crosshair, narration, and
 * callbacks all consume this immutable snapshot; none regroup independently.
 */
export function resolveInspection<Row extends Record<string, CellValue>, Key extends PropertyKey>(
  input: ResolveInspectionInput<Row, Key>,
): PlotInspectionChange<Row, Key> {
  const { model, seed, mode, state, source, keyOf } = input;
  // This entry point takes a row-shaped keyOf, so it materializes each row to
  // ask for its key. The coordinated path passes an index-keyed resolver and
  // skips that entirely.
  //
  // One slot of memo, because datum reads a member's own row for the gate and
  // then asks for its key by index — without this the legacy path would copy
  // that row twice. Distinct lineage indexes miss the slot and materialize as
  // they always did.
  let lastIndex = -1;
  let lastRow: Row | null = null;
  const keyAt = (index: number): Key | null => {
    if (index !== lastIndex) {
      lastIndex = index;
      lastRow = model.row(index) as Row | null;
    }
    return lastRow === null ? null : keyOf(lastRow, index);
  };
  const target = resolvedTarget(model, seed, mode);
  // The legacy direct constructor remains total for callers that already hold
  // a seed. Coordinated dominant-axis lookup rejects invalid buckets instead.
  if (target === null) {
    // resolvedTarget only returns null for axis modes when the group bucket
    // is missing; exact/xy always yield a single-member target.
    const single = datum<Row, Key>(model, seed, keyAt);
    if (mode === "exact" || mode === "xy") {
      return Object.freeze({
        type: "inspect",
        phase: "change",
        state,
        source,
        mode,
        panelId: seed.panelId,
        focus: single,
        members: [single] as const,
        groupTotal: compositionGroupTotal(model, seed),
      });
    }

    const axisValue = mode === "x" ? seed.xValue : seed.yValue;
    // Same stack/fill gate as groupMagnitudeTotal so oninspect consumers
    // never see a composition total for identity/dodge seeds.
    const additive = groupHasAdditivePosition(model, [seed]);
    return Object.freeze({
      type: "inspect",
      phase: "change",
      state,
      source,
      mode,
      panelId: seed.panelId,
      focus: single,
      members: [single] as const,
      axisValue,
      axisLabel: axisLabel(model, mode, axisValue),
      groupTotal: additive ? candidateValueContribution(seed, mode) : null,
      // Single-member fallback — one series on the seed layer.
      groupMemberCount: 1,
    });
  }
  return materializeInspection(input, target, "complete", keyAt);
}

/** Package-internal: coordinator reuses the same materialize path as resolve. */
export function materializeInspection<
  Row extends Record<string, CellValue>,
  Key extends PropertyKey,
>(
  /** keyOf is deliberately absent: keys arrive through `keyAt`. */
  input: Omit<ResolveInspectionInput<Row, Key>, "keyOf">,
  target: ResolvedTarget,
  completeness: InspectionSnapshotCompleteness,
  /** Source-row key by index. The coordinated path passes its own index-keyed
   * bag; resolveInspection passes an adapter over its row-shaped keyOf. */
  keyAt: (index: number) => Key | null,
): PlotInspectionChange<Row, Key> {
  const { model, seed, mode, state, source } = input;
  const single = datum<Row, Key>(model, seed, keyAt);
  if (mode === "exact" || mode === "xy") {
    return Object.freeze({
      type: "inspect",
      phase: "change",
      state,
      source,
      mode,
      panelId: seed.panelId,
      focus: single,
      members: [single] as const,
      groupTotal: compositionGroupTotal(model, seed),
    });
  }

  const group = target.group!;
  const completeCandidates = target.members;
  const groupAxis: "x" | "y" = mode === "y" ? "y" : "x";
  const memberCandidates =
    completeness === "transient"
      ? selectTransientMembers(completeCandidates, group.focusId, {
          groupAxis,
          limit: TRANSIENT_MEMBER_LIMIT,
        })
      : completeCandidates;
  const members = memberCandidates.map((candidate) => datum<Row, Key>(model, candidate, keyAt));
  const focusIndex = memberCandidates.findIndex((candidate) => candidate.id === group.focusId);
  const focus =
    focusIndex >= 0
      ? members[focusIndex]!
      : datum<Row, Key>(model, model.candidates.candidate(group.focusId) ?? seed, keyAt);
  const nonempty = (members.length === 0 ? [focus] : members) as [
    PlotDatum<Row, Key>,
    ...PlotDatum<Row, Key>[],
  ];
  return Object.freeze({
    type: "inspect",
    phase: "change",
    state,
    source,
    mode,
    panelId: seed.panelId,
    focus,
    members: Object.freeze(nonempty),
    axisValue: group.axisValue,
    axisLabel: axisLabel(model, mode, group.axisValue),
    // Full-group series total + count (deduped across layers) — independent of
    // the hover cap so Total and "+N more" stay honest when members were
    // truncated or the focus layer is a thin overlay (#1274 / #1389).
    groupTotal: groupMagnitudeTotal(model, completeCandidates, groupAxis),
    groupMemberCount: groupSeriesCount(model, completeCandidates, groupAxis),
  });
}

// ---------------------------------------------------------------------------
// Stable import path: re-export coordinator surface from this module.
// ---------------------------------------------------------------------------
export { clearInspectionFingerprint, createInspectionCoordinator } from "./coordinator.js";

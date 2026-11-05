/**
 * Pure legend-focus identity helpers for GGPlot.
 *
 * Owns identity keying, interactive entry listing, key-set equality, source
 * mapping, entry key lookup, and roving-index math.
 *
 * Related pure modules:
 * - `entry-key-index.ts` — entry → semantic-key index builders
 * - `focus-emphasis.ts` — pressed / preview / effective emphasis
 * - `focus-plans.ts` — host `$effect` pure plans
 *
 * Hosts own local/controller emphasis state, DOM handlers, announcements,
 * and event emission (`focus-state.svelte.ts`).
 */
import type { SceneLegend, SceneLegendEntry } from "./index.js";

import type { InteractionSource, LegendFocusChange } from "./interaction-types.js";

/** Stable renderer identity for one entry in one discrete legend. */
export interface LegendEntryIdentity {
  scale: LegendFocusChange["scale"];
  entryIndex: number;
}

export type LegendInteractionSource = "pointer" | "touch" | "focus" | "keyboard";

export interface LegendEntryAction {
  identity: LegendEntryIdentity;
  entry: SceneLegendEntry;
  source: LegendInteractionSource;
}

/** One discrete legend entry flattened for hit targets / roving focus. */
export interface InteractiveLegendEntry {
  readonly legend: Extract<SceneLegend, { type: "discrete" }>;
  readonly entry: SceneLegendEntry;
  readonly identity: LegendEntryIdentity;
}

/** Map identity to the stable index key used by the entry-key map. */
export function legendIdentityKey(identity: LegendEntryIdentity): string {
  return `${identity.scale}:${String(identity.entryIndex)}`;
}

/**
 * Flatten discrete scene legends into interactive targets.
 * Ramp legends are excluded. Order is legend order, then entryIndex order.
 */
export function buildInteractiveLegendEntries(
  legends: readonly SceneLegend[],
): InteractiveLegendEntry[] {
  return legends.flatMap((sceneLegend) =>
    sceneLegend.type === "discrete" && sceneLegend.interactive !== false
      ? sceneLegend.entries.map((entry, entryIndex) => ({
          legend: sceneLegend,
          entry,
          identity: { scale: sceneLegend.scale, entryIndex },
        }))
      : [],
  );
}

/**
 * Set equality for PropertyKey collections (order-insensitive, duplicate-tolerant).
 * Distinct Symbols never equal even when descriptions match.
 */
export function samePropertyKeySet(
  left: readonly PropertyKey[],
  right: readonly PropertyKey[],
): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) return false;
  for (const key of leftSet) if (!rightSet.has(key)) return false;
  return true;
}

/** Map a legend interaction source to the public InteractionSource surface. */
export function legendInteractionSource(source: LegendInteractionSource): InteractionSource {
  if (source === "pointer" || source === "touch") return source;
  return "keyboard";
}

/** Look up frozen semantic keys for a legend entry identity. */
export function keysForLegendEntry(
  index: ReadonlyMap<string, readonly PropertyKey[]>,
  identity: LegendEntryIdentity,
): readonly PropertyKey[] {
  return index.get(legendIdentityKey(identity)) ?? [];
}

export type FindLegendPressedIdentityInput = {
  readonly keys: readonly PropertyKey[];
  readonly entries: readonly InteractiveLegendEntry[];
  readonly keyIndex: ReadonlyMap<string, readonly PropertyKey[]>;
  readonly committed: {
    readonly identity: LegendEntryIdentity;
    readonly keys: readonly PropertyKey[];
  } | null;
};

/**
 * Whether a first-seen-unique key array matches a Set's membership.
 * Used by pressed-identity resolution so entry compares stay O(K) without
 * allocating a Set per legend entry. Entry-key index values and committed
 * keys are frozen unique arrays from `buildLegendEntryKeyIndex`.
 */
function uniqueKeysMatchSet(
  keys: readonly PropertyKey[],
  keySet: ReadonlySet<PropertyKey>,
): boolean {
  if (keys.length !== keySet.size) return false;
  for (const key of keys) if (!keySet.has(key)) return false;
  return true;
}

/**
 * Resolve which legend entry should appear pressed.
 * Committed identity wins when its key set still matches (even if multiple
 * entries share the same keys). Otherwise require exactly one matching entry.
 *
 * Complexity: O(K + E) — one Set for the emphasis keys, then per-entry size
 * short-circuit + membership (no Set rebuild per entry). Multi-match returns
 * null as soon as a second hit is found. Empty keys, or empty entries with no
 * committed identity, return before allocating the Set.
 */
export function findLegendPressedIdentity(
  input: FindLegendPressedIdentityInput,
): LegendEntryIdentity | null {
  if (input.keys.length === 0) return null;
  // Ramp-only / no discrete legends and no commit: nothing to match (issue #209).
  if (input.entries.length === 0 && input.committed === null) return null;
  const inputSet = new Set(input.keys);
  if (input.committed !== null && uniqueKeysMatchSet(input.committed.keys, inputSet))
    return input.committed.identity;
  let match: LegendEntryIdentity | null = null;
  for (const entry of input.entries) {
    const entryKeys = keysForLegendEntry(input.keyIndex, entry.identity);
    if (!uniqueKeysMatchSet(entryKeys, inputSet)) continue;
    if (match !== null) return null;
    match = entry.identity;
  }
  return match;
}

/**
 * Clamp a roving tabindex index into [0, count).
 * Empty lists return 0 so hosts can store a stable default.
 */
export function clampLegendRovingIndex(current: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isFinite(current)) return 0;
  return Math.min(Math.max(0, Math.trunc(current)), count - 1);
}

/**
 * Non-wrapping roving navigation for Arrow/Home/End.
 * Unknown keys return the clamped current index. Empty lists return 0.
 */
export function moveLegendRovingIndex(current: number, key: string, count: number): number {
  if (count <= 0) return 0;
  const last = count - 1;
  const index = clampLegendRovingIndex(current, count);
  if (key === "ArrowRight" || key === "ArrowDown") return Math.min(last, index + 1);
  if (key === "ArrowLeft" || key === "ArrowUp") return Math.max(0, index - 1);
  if (key === "Home") return 0;
  if (key === "End") return last;
  return index;
}

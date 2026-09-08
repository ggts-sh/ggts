/**
 * Host-derived reconcile effects for the legend-focus controller (S5).
 *
 * Hosts the four reconcile effects previously registered inside
 * focus-state.installHostDerivedEffects: roving-index sync ($effect.pre),
 * committed reconcile, preview reconcile, and focus-disabled clear.
 *
 * Registration happens synchronously inside installHostDerivedEffects — the
 * late-hook ordering is intentional: these effects must not register before
 * the host declares the entry/pressed deriveds that the controller's compute*
 * methods feed (#627).
 *
 * Ports are LIVE getters/setters over the controller's rune state — never
 * snapshots. Shared controller emphasis survives disable while local emphasis
 * clears (planLegendFocusDisabledClear "clear-host" vs "clear-host-local").
 */
import type { PlotInteractionController } from "../interaction/controller.svelte.js";
import type { LegendFocusEvent } from "../interaction/interaction.js";
import type { ScopedStore } from "../interaction/scoped-store.svelte.js";
import {
  samePropertyKeySet,
  type InteractiveLegendEntry,
  type LegendEntryAction,
  type LegendEntryIdentity,
} from "./focus.js";
import { reconcileLegendPreview } from "./focus-emphasis.js";
import {
  planLegendCommittedReconcile,
  planLegendFocusDisabledClear,
  planLegendRovingFocusSync,
} from "./focus-plans.js";
import type { LegendEntryKeyAccess } from "./entry-key-index.svelte.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LegendFocusPreviewState = {
  action: LegendEntryAction;
  keys: readonly PropertyKey[];
} | null;

export type LegendFocusCommittedState = {
  identity: LegendEntryIdentity;
  keys: readonly PropertyKey[];
} | null;

export type LegendFocusReconcilePorts = {
  readonly entries: () => readonly InteractiveLegendEntry[];
  readonly entryKeys: () => LegendEntryKeyAccess;
  readonly root: () => HTMLElement | null;
  readonly interaction: () => PlotInteractionController | undefined;
  readonly legendFocusEnabled: () => boolean;
  /** Emphasis store — local shadow when controller-driven, source of truth local. */
  readonly emphasisKeys: ScopedStore<readonly PropertyKey[]>;
  /** Live accessors over the controller's rune state (never snapshotted). */
  readonly rovingIndex: () => number;
  readonly setRovingIndex: (next: number) => void;
  readonly committed: () => LegendFocusCommittedState;
  readonly setCommitted: (next: LegendFocusCommittedState) => void;
  readonly preview: () => LegendFocusPreviewState;
  readonly setPreview: (next: LegendFocusPreviewState) => void;
  readonly emitLegendFocus: (event: LegendFocusEvent) => void;
  readonly previewLegend: (action: LegendEntryAction | null) => void;
};

// ---------------------------------------------------------------------------
// Effect registration
// ---------------------------------------------------------------------------

/**
 * Register the four reconcile effects. Called synchronously from
 * `installHostDerivedEffects` while the component initializes — never from a
 * callback or after init.
 */
export function installLegendFocusReconcileEffects(ports: LegendFocusReconcilePorts): void {
  $effect.pre(() => {
    const count = ports.entries().length;
    const active = document.activeElement;
    // Number(dataset.index) may be NaN — pure plan maps non-finite → 0.
    const focusedIndex =
      active instanceof HTMLElement &&
      active.matches("[data-gg-legend-target]") &&
      (ports.root()?.contains(active) ?? false)
        ? Number(active.dataset["index"])
        : null;
    const currentRoving = ports.rovingIndex();
    const plan = planLegendRovingFocusSync({
      currentRoving,
      entryCount: count,
      focusedIndex,
    });
    if (plan.nextIndex !== currentRoving) ports.setRovingIndex(plan.nextIndex);
    if (plan.type !== "refocus") return;
    const returnIndex = plan.returnIndex;
    queueMicrotask(() => {
      ports
        .root()
        ?.querySelector<HTMLElement>(`[data-gg-legend-target][data-index="${String(returnIndex)}"]`)
        ?.focus();
    });
  });

  $effect(() => {
    const usesLocalEmphasis = ports.interaction() === undefined;
    const plan = planLegendCommittedReconcile({
      committed: ports.committed(),
      entries: ports.entries(),
      keyIndex: ports.entryKeys().legendEntryKeyIndex,
      usesLocalEmphasis,
      // Only consulted when usesLocalEmphasis; store value is the local shadow.
      localEmphasisCount: usesLocalEmphasis ? ports.emphasisKeys.value.length : 0,
    });
    switch (plan.type) {
      case "noop":
        return;
      case "clear-committed":
        ports.setCommitted(null);
        break;
      case "clear-committed-local-emit":
        ports.setCommitted(null);
        ports.emphasisKeys.clear("programmatic");
        ports.emitLegendFocus({
          type: "legend-focus",
          phase: "clear",
          source: "programmatic",
        });
        break;
    }
  });

  // Reconcile transient preview when data/domain reshuffles entry membership.
  $effect(() => {
    const preview = ports.preview();
    if (preview === null) return;
    const next = reconcileLegendPreview({
      preview: { identity: preview.action.identity, keys: preview.keys },
      entries: ports.entries(),
      keyIndex: ports.entryKeys().legendEntryKeyIndex,
    });
    if (next === null) {
      ports.previewLegend(null);
      return;
    }
    if (samePropertyKeySet(next.keys, preview.keys)) return;
    ports.setPreview({
      action: { ...preview.action, identity: next.identity },
      keys: next.keys,
    });
  });

  // Drop chart-local emphasis when legend focus is turned off at runtime.
  // Shared controller emphasis is intentionally retained (clear-host only).
  $effect(() => {
    const usesLocalEmphasis = ports.interaction() === undefined;
    const plan = planLegendFocusDisabledClear({
      legendFocusEnabled: ports.legendFocusEnabled(),
      hasPreview: ports.preview() !== null,
      hasCommitted: ports.committed() !== null,
      hasLocalEmphasis: usesLocalEmphasis && ports.emphasisKeys.value.length > 0,
      usesLocalEmphasis,
    });
    switch (plan.type) {
      case "noop":
        return;
      case "clear-host":
        ports.setPreview(null);
        ports.setCommitted(null);
        break;
      case "clear-host-local":
        ports.setPreview(null);
        ports.setCommitted(null);
        ports.emphasisKeys.clear("programmatic");
        break;
    }
  });
}

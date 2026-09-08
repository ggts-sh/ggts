/**
 * Interval-selection controller extracted from GGPlot for S5.
 *
 * Owns committedInterval / committedIntervalRecord, the interval ScopedStore
 * (local vs controller records), construction-time deriveds
 * (effectiveIntervals, effectiveIntervalKeys, currentInterval* family,
 * intervalBoundsTargetAvailable), the interval-reconcile effect, private
 * helpers, and the public clear/commit/bounds methods. The bounds-editor
 * state machine (boundsEditor, boundsReturnFocus, boundsEditorInput, cancel
 * effect, open/cancel actions) lives in interval-bounds-state.svelte.ts;
 * pure helpers live in interval-state-helpers.ts.
 *
 * Construction-time deriveds may legitimately read model / effectiveZoomDomains
 * (factory sits after the runtime). Armed later-declared / handler-only deps
 * for the construction guard: emitSelection, commitZoom, announce,
 * inspectionPanel, candidateSemanticKeys.
 *
 * The host constructs semantic-key resolution before this factory
 * (construction-order convention; deriveds are lazy at the 5.33.1 floor, so
 * interval projection evaluates on first read, not at construction).
 * Semantic diagnostics retain their later effect-registration position
 * through the service's phased `registerEffects()` API (#165).
 */
import { encodeKey, type ScenePanel } from "@ggts-sh/core";

import type { InteractionContext } from "../interaction/interaction-context.svelte.js";
import type {
  InteractionSource,
  IntervalSelection,
  PlotInteractionInterval,
  PlotSelection,
  ReadonlyIntervalDomains,
  SemanticIntervalAxis,
} from "../interaction/interaction.js";
import { createIntervalScopedStore } from "../interaction/scoped-store.svelte.js";
import type { BoundsEditorInput, PreciseBoundsApplyEvent } from "./bounds-editor.js";
import { frozenZoomDomains, type ContinuousZoomDomains } from "../scene/geometry.js";
import {
  buildIntervalSelection,
  clearIntervalSelectionEvent,
  persistentSelectionOrNull,
} from "./interval.js";
import {
  consumeIntervalKeys,
  recomputePanelIntervalFromLookup,
  sameIntervalRecord,
  type IntervalConsumptionCandidate,
} from "./consumption.js";
import { semanticAxisFromBounds } from "./precise-bounds.js";
import { facetIdentityValueLabel, viewportSelection } from "./interval-state-helpers.js";
import { createIntervalBoundsEditor } from "./interval-bounds-state.svelte.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Interval-specific ports beyond the shared InteractionContext. Sibling
 * controllers are wired by the assembly (interaction-states.svelte.ts).
 */
export type IntervalStateOptions = {
  /** Alias over the zoom controller (construction-safe). */
  readonly effectiveZoomDomains: () => ContinuousZoomDomains | null;
  /** Zoom controller write path for the bounds-editor zoom branch (stable fn). */
  readonly commitZoom: (domains: ContinuousZoomDomains | null, source: InteractionSource) => void;
  /**
   * Deferred semantic Candidate view for non-union interval consumption.
   * Projection ownership stays outside interval behavior.
   */
  readonly consumptionCandidates: () => readonly IntervalConsumptionCandidate<PropertyKey>[];
  /**
   * Handler-only: `openBoundsEditor` select branch reads the inspection
   * controller's panel id as its fallback target.
   */
  readonly inspectionPanel: () => Readonly<{ id: string }> | null;
  /** Selection controller write path (stable fn). */
  readonly emitSelection: (event: PlotSelection) => void;
};

export type IntervalState = {
  readonly committedInterval: IntervalSelection | null;
  readonly effectiveIntervals: readonly PlotInteractionInterval<PropertyKey>[];
  readonly effectiveIntervalKeys: readonly PropertyKey[];
  readonly currentIntervalTargetLabel: string | undefined;
  readonly boundsEditorInput: BoundsEditorInput | null;
  readonly boundsReturnFocus: HTMLElement | null;
  /**
   * Narrow boolean for ToolRail `canSetIntervalBounds` — equivalent to
   * `currentIntervalRecord === null || currentIntervalPanel !== undefined`.
   * Does NOT expose the private record/panel deriveds.
   */
  readonly intervalBoundsTargetAvailable: boolean;
  clearIntervalSelection(source: InteractionSource): void;
  clearCurrentPanelInterval(source: InteractionSource): void;
  /**
   * Brush select-end: commit writes (committedInterval + conditional record)
   * then emit. Snapshots `selectConfig()?.persistent` once. Always emits the
   * end event (including non-persistent) so callers need no post-hook emit.
   */
  finishBrushSelect(eventValue: IntervalSelection, source: InteractionSource): void;
  openBoundsEditor(action: "select" | "zoom", axis: "x" | "y", trigger: HTMLElement): void;
  applyPreciseBounds(event: PreciseBoundsApplyEvent): void;
  cancelBoundsEditor(): void;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the interval-selection controller. Both effects register at
 * construction (original host positions relative to the runtime model effects
 * and the later semantic-key diagnostics effects).
 */
export function createIntervalState(
  context: InteractionContext,
  options: IntervalStateOptions,
): IntervalState {
  let committedInterval = $state<IntervalSelection | null>(null);
  // Semantic snapshot of the record backing `committedInterval`, so external
  // same-panel replacements are detected by content, not just presence.
  let committedIntervalRecord = $state<PlotInteractionInterval<PropertyKey> | null>(null);
  const committedIntervals = createIntervalScopedStore({
    controller: context.interaction,
    scope: context.resolvedInteractionScope,
  });

  const effectiveIntervals = $derived(committedIntervals.value);

  const effectiveIntervalKeys: readonly PropertyKey[] = $derived.by(() => {
    const model = context.model();
    if (model === null || effectiveIntervals.length === 0) return [];
    // Union consumes only stored record keys, and this derived re-runs on
    // every controller revision — skip the O(candidates) semantic projection
    // whenever the preset never reads it.
    const preset = effectiveIntervals[0]?.preset;
    if (preset === "union")
      return consumeIntervalKeys({
        records: effectiveIntervals,
        panels: model.scene.panels,
        candidates: [],
      });
    return consumeIntervalKeys({
      records: effectiveIntervals,
      panels: model.scene.panels,
      candidates: options.consumptionCandidates(),
    });
  });

  const currentIntervalRecord = $derived.by(() => {
    const intervalPanelId = committedInterval?.panelId;
    return (
      (intervalPanelId === null || intervalPanelId === undefined
        ? undefined
        : effectiveIntervals.find((record) => record.panelId === intervalPanelId)) ??
      effectiveIntervals[0] ??
      null
    );
  });

  const currentIntervalPanel = $derived.by((): ScenePanel | undefined => {
    const model = context.model();
    if (currentIntervalRecord === null || model === null) {
      // Explicit undefined keeps consistent-return happy on the .ts surface
      // (host .svelte used bare `return`; type-aware lint only runs on .ts).
      return undefined;
    }
    return model.scene.panels.find((candidate) => candidate.id === currentIntervalRecord.panelId);
  });

  // A shared controller can clear or replace this chart's interval from
  // outside (a linked plot, programmatic reconcile). The local pixel
  // rectangle must not outlive its semantic record — including a same-panel
  // record whose domains or keys were replaced under it.
  $effect(() => {
    const current = committedInterval;
    if (current === null) return;
    const record = effectiveIntervals.find((candidate) => candidate.panelId === current.panelId);
    if (
      record !== undefined &&
      (committedIntervalRecord === null || sameIntervalRecord(committedIntervalRecord, record))
    )
      return;
    committedInterval = null;
    committedIntervalRecord = null;
  });

  function intervalPanelLabel(panel: ScenePanel): string {
    const display = panel.strip.trim() || "panel";
    const model = context.model();
    if (
      model === null ||
      model.scene.panels.filter((candidate) => candidate.strip.trim() === panel.strip.trim())
        .length < 2
    )
      return display;
    const identity = panel.identity.values
      .map((value) => `${value.field}: ${facetIdentityValueLabel(value.encodedValue)}`)
      .join(", ");
    return identity.length > 0 ? `${display} (${identity})` : display;
  }

  const currentIntervalTargetLabel = $derived.by((): string | undefined => {
    if (currentIntervalRecord === null || context.model() === null) {
      return undefined;
    }
    if (currentIntervalPanel === undefined) return "unavailable panel";
    if (
      currentIntervalPanel.strip.trim().length === 0 &&
      currentIntervalPanel.identity.values.length === 0
    ) {
      return undefined;
    }
    return intervalPanelLabel(currentIntervalPanel);
  });

  const intervalBoundsTargetAvailable = $derived(
    currentIntervalRecord === null || currentIntervalPanel !== undefined,
  );

  const bounds = createIntervalBoundsEditor({
    model: context.model,
    captureSurface: context.captureSurface,
    announce: context.announce,
    effectiveZoomDomains: options.effectiveZoomDomains,
    currentIntervalRecord: () => currentIntervalRecord,
    currentIntervalPanel: () => currentIntervalPanel,
    inspectionPanel: options.inspectionPanel,
    intervalPanelLabel,
  });

  function clearIntervalSelection(source: InteractionSource): void {
    const current = committedInterval;
    if (current === null && effectiveIntervals.length === 0) return;
    committedIntervals.clear(source);
    const event = clearIntervalSelectionEvent(
      current ?? {
        mode: context.selectConfig()?.mode ?? "xy",
        panelId: null,
        pixels: { x0: 0, y0: 0, x1: 0, y1: 0 },
      },
      source,
    );
    committedInterval = null;
    committedIntervalRecord = null;
    options.emitSelection(event);
  }

  function clearCurrentPanelInterval(source: InteractionSource): void {
    const intervalPanelId = committedInterval?.panelId ?? currentIntervalRecord?.panelId;
    if (intervalPanelId === null || intervalPanelId === undefined) return;
    committedIntervals.remove(intervalPanelId, source);
    const event = clearIntervalSelectionEvent(
      committedInterval ?? {
        mode: context.selectConfig()?.mode ?? "xy",
        panelId: intervalPanelId,
        pixels: { x0: 0, y0: 0, x1: 0, y1: 0 },
      },
      source,
    );
    committedInterval = null;
    committedIntervalRecord = null;
    options.emitSelection(event);
  }

  function semanticAxis(
    panelId: string,
    axis: "x" | "y",
    axisBounds: readonly [unknown, unknown] | undefined,
  ): SemanticIntervalAxis | undefined {
    if (axisBounds === undefined || context.model() === null) return undefined;
    const viewportPanel = context.model()!.viewport.panel(panelId);
    if (viewportPanel === null) return undefined;
    const scale = viewportPanel.axisEditModel(axis);
    if (scale.kind === "band") {
      const values = scale.slice(axisBounds);
      if (values === undefined) return undefined;
      return Object.freeze({
        kind: "band",
        values: Object.freeze(values.map((value) => encodeKey(value))),
      });
    }
    return semanticAxisFromBounds(scale.type, scale.transform, [
      Number(axisBounds[0]),
      Number(axisBounds[1]),
    ]);
  }

  /**
   * One full-store pass for precise-bounds apply: semantic keys + lineage row
   * count for the target panel/domains. Domain-filters before lineage
   * expansion and expands each lineage id once among matches (shared smooth /
   * aggregate bags — not once per mark).
   */
  function recomputePanelIntervalSelection(
    targetPanelId: string,
    domains: ReadonlyIntervalDomains,
  ): { readonly keys: readonly PropertyKey[]; readonly lineageCount: number } {
    const model = context.model();
    if (model === null) return { keys: Object.freeze([]), lineageCount: 0 };
    return recomputePanelIntervalFromLookup({
      panelId: targetPanelId,
      domains,
      size: model.candidates.size,
      candidate: (id) => {
        const candidate = model.candidates.candidate(id);
        if (candidate === null) return null;
        return {
          panelId: candidate.panelId,
          xValue: candidate.xValue,
          yValue: candidate.yValue,
          lineage: candidate.lineage,
          rowIndex: candidate.rowIndex,
          // Lazy: pay key resolution only after domain membership passes.
          get keys() {
            return context.candidateSemanticKeys(candidate);
          },
        };
      },
      lineageKeys: (lineageId) => model.lineage.keys(lineageId),
    });
  }

  /** Private — no remaining external consumer (codex P2-7). */
  function commitIntervalSelection(event: IntervalSelection, source: InteractionSource): void {
    const targetPanelId = event.panelId;
    if (targetPanelId === null || context.model() === null) return;
    const model = context.model()!;
    if (model.viewport.panel(targetPanelId) === null) return;
    const x = semanticAxis(targetPanelId, "x", event.domain.x);
    const y = semanticAxis(targetPanelId, "y", event.domain.y);
    // An empty facet panel trains no band domain, so no semantic axis
    // survives the selection mode. The controller rejects axis-less
    // intervals (TypeError) — treat the brush as an empty selection.
    if (x === undefined && y === undefined) return;
    const record: PlotInteractionInterval<PropertyKey> = Object.freeze({
      panelId: targetPanelId,
      preset: context.selectConfig()?.preset ?? "independent",
      domains: Object.freeze({
        ...(x !== undefined && { x }),
        ...(y !== undefined && { y }),
      }),
      keys: Object.freeze([...event.keys]),
    });
    committedIntervalRecord = record;
    committedIntervals.upsert(record, source);
  }

  function finishBrushSelect(eventValue: IntervalSelection, source: InteractionSource): void {
    // Snapshot once (drift-safe under reactive selectConfig replacement).
    const persistent = context.selectConfig()?.persistent;
    committedInterval = persistentSelectionOrNull(persistent, eventValue);
    // TRUTHY guard — untyped JS consumers may pass truthy non-boolean
    // `persistent` values, which the config normalizer forwards unchanged.
    // `?? false` only maps nullish (already falsy) values, so runtime
    // truthiness is identical.
    if (persistent ?? false) commitIntervalSelection(eventValue, source);
    // Emit after writes so listeners observe committed state (load-bearing).
    options.emitSelection(eventValue);
  }

  function applyPreciseZoomBounds(event: PreciseBoundsApplyEvent): void {
    if (event.scale === "band") return;
    options.commitZoom(
      frozenZoomDomains({
        ...options.effectiveZoomDomains(),
        [event.axis]: [...event.bounds],
      }),
      event.inputSource,
    );
    bounds.cancel();
  }

  function applyPreciseSelectionBounds(event: PreciseBoundsApplyEvent): void {
    const prior = currentIntervalRecord;
    const targetPanelId = prior?.panelId ?? bounds.boundsEditor?.panelId;
    if (targetPanelId === null || targetPanelId === undefined || context.model() === null) return;
    const model = context.model()!;
    if (model.viewport.panel(targetPanelId) === null) return;
    const axis = semanticAxis(targetPanelId, event.axis, event.bounds);
    if (axis === undefined) return;
    const domains = Object.freeze({
      ...prior?.domains,
      [event.axis]: axis,
    });
    // Keys + lineageCount from one candidate-store pass (not consumption then
    // a second lineage scan).
    const { keys, lineageCount } = recomputePanelIntervalSelection(targetPanelId, domains);
    const next: PlotInteractionInterval<PropertyKey> = Object.freeze({
      panelId: targetPanelId,
      preset: prior?.preset ?? context.selectConfig()?.preset ?? "independent",
      domains,
      keys,
    });
    // Precise bounds persist exactly like the brush path: with
    // `persistent: false` the end event still fires, but no durable record,
    // committed rectangle, or clear-selection controls appear.
    const persistent = context.selectConfig()?.persistent === true;
    if (persistent) {
      committedIntervalRecord = next;
      committedIntervals.upsert(next, event.inputSource);
    }
    const viewportPanel = model.viewport.panel(targetPanelId);
    if (viewportPanel === null) return;
    const selection = viewportSelection(domains);
    const eventValue = buildIntervalSelection({
      phase: "end",
      mode: context.selectConfig()?.mode ?? "xy",
      panelId: targetPanelId,
      domain: viewportPanel.resolve(selection),
      // The overlay must depict the interval that was actually applied, so
      // project the edited domains back into pixels rather than reusing the
      // pre-edit rectangle (or defaulting to the whole panel).
      pixels: viewportPanel.project(selection),
      keys,
      lineageCount,
      source: event.inputSource,
    });
    committedInterval = persistentSelectionOrNull(context.selectConfig()?.persistent, eventValue);
    options.emitSelection(eventValue);
    bounds.cancel();
  }

  function applyPreciseBounds(event: PreciseBoundsApplyEvent): void {
    if (event.action === "zoom") applyPreciseZoomBounds(event);
    else applyPreciseSelectionBounds(event);
  }

  return {
    get committedInterval() {
      return committedInterval;
    },
    get effectiveIntervals() {
      return effectiveIntervals;
    },
    get effectiveIntervalKeys() {
      return effectiveIntervalKeys;
    },
    get currentIntervalTargetLabel() {
      return currentIntervalTargetLabel;
    },
    get boundsEditorInput() {
      return bounds.boundsEditorInput;
    },
    get boundsReturnFocus() {
      return bounds.boundsReturnFocus;
    },
    get intervalBoundsTargetAvailable() {
      return intervalBoundsTargetAvailable;
    },
    clearIntervalSelection,
    clearCurrentPanelInterval,
    finishBrushSelect,
    openBoundsEditor: (...args: Parameters<typeof bounds.openBoundsEditor>) => {
      bounds.openBoundsEditor(...args);
    },
    applyPreciseBounds,
    cancelBoundsEditor: () => {
      bounds.cancel();
    },
  };
}

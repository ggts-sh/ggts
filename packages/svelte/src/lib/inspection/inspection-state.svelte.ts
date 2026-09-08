/**
 * Inspection controller (extracted from GGPlot). Owns inspection $state,
 * seed/fingerprints/latch, deriveds, coordinator, resolve/emit helpers,
 * public set/toggle/dismiss/close. Reconcile: inspection-reconcile.svelte.ts;
 * traversal: inspection-traversal.svelte.ts; queue: pointer-inspect.ts. #627.
 */
import type { CandidateFacts, CellValue } from "@ggts-sh/core";
import { panelBoundsFrom, type PanelBounds } from "../scene/geometry.js";
import { createInspectionCoordinator } from "./coordinator.js";
import type { InteractionContext } from "../interaction/interaction-context.svelte.js";
import type { createInteractionReducer } from "../interaction/reducer.js";
import type {
  InteractionSource,
  PlotInspection,
  PlotInspectionChange,
} from "../interaction/interaction.js";
import { inspectionLiveText as inspectionLiveTextFor } from "../assembly/labels.js";
import { plotTooltipDomId } from "../assembly/layout.js";
import {
  presentationFocusFromInspection,
  type PresentationInspectionFocus,
} from "../selection/selection.js";
import {
  resolveInspectionCompleteness,
  resolveInspectionMode,
  resolveSetInspectionAction,
  resolveToggleInspectionPinAction,
  shouldAnnounceUnpin,
  shouldClearInspectionAnnouncement,
  shouldFocusPinnedInteractiveTooltip,
} from "./apply.js";
import {
  createPointerInspectQueue,
  type CancelPointerInspectPolicy,
  type InspectPointerFrameAction,
  type SchedulePointerInspectInput,
} from "./pointer-inspect.js";
import {
  planInspectionDismiss,
  resolveInspectionEmitAction,
  type InspectionDismissPlan,
} from "./teardown.js";
import { registerSceneInspectReconcile } from "./inspection-reconcile.svelte.js";
import { createInspectionTraversal } from "./inspection-traversal.svelte.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Component-held reducer shape — factory-only export from interaction/reducer. */
type InteractionReducer = ReturnType<typeof createInteractionReducer>;

/**
 * Inspection-specific ports beyond the shared InteractionContext. The reducer
 * is hoisted by the assembly (constructed before this factory) so inspection
 * does not close over surface.
 */
export type InspectionStateOptions = {
  /** Shared interaction reducer (concrete instance from the assembly). */
  readonly reducer: InteractionReducer | (() => InteractionReducer);
  readonly inspectEnabled: () => boolean;
  readonly dataIdentityEpoch: () => string;
  readonly plotId: () => string;
  readonly clearTooltipHovered: () => void;
  /** Stable sink over the announcer. */
  readonly clearAnnouncement: () => void;
};

function resolveReducer(reducer: InspectionStateOptions["reducer"]): InteractionReducer {
  return typeof reducer === "function" ? reducer() : reducer;
}

/** Panel geometry for crosshairs / keyboard clamp; id for scene lookups. */
type InspectionPanelBounds = PanelBounds & { readonly id: string };

export type InspectionState = {
  readonly inspection: PlotInspectionChange<Record<string, CellValue>, PropertyKey> | null;
  readonly inspectionPanel: InspectionPanelBounds | null;
  /** Seed candidate for presentation chrome (kind); not emitted on public events. */
  readonly inspectionSeed: CandidateFacts | null;
  /**
   * Presentation focus for semantic masks / mute-siblings (#1080).
   * Owned here so plot-engine does not re-assemble focus + seed fields.
   */
  readonly presentationFocus: PresentationInspectionFocus | null;
  setInspection(
    candidate: CandidateFacts | null,
    source: InteractionSource,
    state?: "transient" | "pinned",
    concreteMode?: "exact" | "x" | "y" | "xy",
  ): void;
  toggleInspectionPin(source: InteractionSource): void;
  /**
   * Local dismiss only. Cross-module plan tails (clearBrush / returnToInspect)
   * are applied by `applyInspectionDismissSideEffects` at the call site.
   */
  dismissInspection(
    kind: "escape" | "close",
    source: InteractionSource,
    opts?: { restoreFocus?: boolean; returnToInspect?: boolean },
  ): InspectionDismissPlan;
  closeInspection(source: InteractionSource, restoreFocus?: boolean): InspectionDismissPlan;
  navigate(delta: number): void;
  navigateDirection(dx: number, dy: number): void;
  cycleCoincident(delta: number): void;
  /** Blur-path reset; scene-reconcile does NOT reset the index. */
  resetTraversalIndex(): void;
  /**
   * Schedule a coalesced pointer-inspect frame from pointer intent.
   * Owns nearest/hitTest, queue payload+token, and reducer.queuePointer.
   */
  schedulePointerInspect(input: SchedulePointerInspectInput): void;
  /**
   * Cancel pending inspect schedule + clear queued payload.
   * Does not cancel move-area (typed cancel on the reducer).
   */
  cancelPointerInspect(policy: CancelPointerInspectPolicy): void;
  /**
   * Reducer onPointerFrame inspect branch sink.
   * Returns false when the frame is dropped so the reducer skips dispatch.
   */
  onInspectPointerFrame(action: InspectPointerFrameAction): boolean;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the inspection controller. Construction registers deriveds and the
 * coordinator disposal + scene-reconcile effects (via the reconcile adapter).
 *
 * Construction-order note: deps must not be invoked during construction —
 * construction-read discipline enforced by the armed-getter suite.
 */
export function createInspectionState(
  context: InteractionContext,
  options: InspectionStateOptions,
): InspectionState {
  const reducerOf = (): InteractionReducer => resolveReducer(options.reducer);
  let inspection = $state<PlotInspectionChange<Record<string, CellValue>, PropertyKey> | null>(
    null,
  );
  let inspectionSeed: CandidateFacts | null = null;
  let lastInspectionFingerprint = "";
  let activeCandidateId: number | null = null;
  /** Same-candidate suppression after Escape of a *transient* inspection;
   *  cleared on re-apply, null-clear, and scene invalidate. */
  let dismissedCandidateId: number | null = null;
  let dismissedRunId: number | null = null;

  function clearDismissedLatch(): void {
    dismissedCandidateId = null;
    dismissedRunId = null;
  }

  // Queue factory stores thunks only (armed-getter suite); setInspection is a
  // hoisted declaration so the apply-pending re-entry closes correctly.
  const pointerQueue = createPointerInspectQueue({
    model: () => context.model(),
    reducer: () => reducerOf(),
    inspectionState: () => (inspection === null ? "none" : inspection.state),
    setInspection: (candidate, source, state, concreteMode) => {
      setInspection(candidate, source, state, concreteMode);
    },
  });

  // Key off the snapshot's panelId (seed-authoritative), not focus.anchor (#787).
  const inspectionPanel = $derived.by((): InspectionPanelBounds | null => {
    if (inspection === null || context.model() === null) return null;
    const panelId = inspection.panelId;
    if (panelId === null) return null;
    const viewportPanel = context.model()!.viewport.panel(panelId);
    if (viewportPanel === null) return null;
    return { id: viewportPanel.id, ...panelBoundsFrom(viewportPanel.bounds) };
  });

  // Single owner for the presentation-focus shape (#1080); survives pin toggle.
  const presentationFocus = $derived(presentationFocusFromInspection(inspection, inspectionSeed));

  // Coordinator closes over keyAt — handler-only invocation (deferred).
  const inspectionCoordinator = createInspectionCoordinator<Record<string, CellValue>, PropertyKey>(
    (index) => context.keyAt(index),
  );

  function resolveInspection(
    seed: CandidateFacts,
    source: InteractionSource,
    state: "transient" | "pinned" = "transient",
    concreteMode?: "exact" | "x" | "y" | "xy",
  ) {
    const model = context.model();
    if (model === null) throw new Error("Cannot resolve inspection without a render model");
    const requested = context.inspectConfig()?.mode ?? "auto";
    const mode = resolveInspectionMode({
      concreteMode,
      requested,
      seedAutoMode: seed.autoMode,
    });
    return inspectionCoordinator.resolve({
      model,
      seed,
      mode,
      state,
      source,
      identityEpoch: options.dataIdentityEpoch(),
      layoutEpoch: model.runId,
      completeness: resolveInspectionCompleteness({
        state,
        hasCustomContent: context.inspectConfig()?.content !== undefined,
        hasInspectCallback: context.oninspect() !== undefined,
        hasInteractionCallback: context.oninteraction() !== undefined,
      }),
    });
  }

  function emitInspection(
    next: PlotInspection<Record<string, CellValue>>,
    semanticFingerprint?: string,
  ): void {
    const emit = resolveInspectionEmitAction({
      phase: next.phase,
      source: next.source,
      semanticFingerprint,
      lastFingerprint: lastInspectionFingerprint,
    });
    if (emit.type === "skip") return;
    if (emit.updateFingerprint !== null) lastInspectionFingerprint = emit.updateFingerprint;
    context.oninspect()?.(next);
    context.oninteraction()?.(next);
  }

  function inspectionLiveText(
    value: PlotInspectionChange<Record<string, CellValue>, PropertyKey>,
  ): string {
    return inspectionLiveTextFor(context.model(), value);
  }

  function setInspection(
    candidate: CandidateFacts | null,
    source: InteractionSource,
    state: "transient" | "pinned" = "transient",
    concreteMode?: "exact" | "x" | "y" | "xy",
  ): void {
    // Announcement clear runs before priority gates (even ignored pinned requests).
    if (
      shouldClearInspectionAnnouncement({
        hasHit: candidate !== null,
        source,
      })
    )
      options.clearAnnouncement();
    // Direct applies must cancel queued hover/touch-move frames so a pending
    // rAF cannot override the apply; pointer hover keeps the queue so frames
    // coalesce.
    if (source !== "pointer") {
      pointerQueue.cancel({ pendingPinned: "preserve" });
    }
    const action = resolveSetInspectionAction({
      hasHit: candidate !== null,
      requestedState: state,
      currentState: inspection === null ? "none" : inspection.state,
      tooltipHovered: context.tooltipHovered(),
    });
    switch (action.type) {
      case "ignore":
        return;
      case "clear": {
        // Clear ends the session — discard orphan pending pin stash (#856).
        pointerQueue.cancel({ pendingPinned: "discard" });
        if (action.emitClear) emitInspection({ type: "inspect", phase: "clear", source });
        inspection = null;
        inspectionSeed = null;
        clearDismissedLatch();
        inspectionCoordinator.release("transient");
        return;
      }
      case "apply": {
        // candidate is non-null when action is apply (pure gate).
        const resolved = resolveInspection(candidate!, source, state, concreteMode);
        // Null resolve re-enters clear gates via setInspection(null, source).
        if (resolved === null) {
          setInspection(null, source);
          return;
        }
        const runId = context.model()?.runId ?? 0;
        // Same-candidate dismiss latch (Escape on transient).
        if (
          dismissedCandidateId === resolved.seed.id &&
          dismissedRunId === runId &&
          state === "transient"
        )
          return;
        if (dismissedCandidateId !== null && dismissedCandidateId !== resolved.seed.id)
          clearDismissedLatch();
        inspection = resolved.snapshot;
        inspectionSeed = resolved.seed;
        activeCandidateId = resolved.seed.id;
        if (resolved.semanticChanged)
          emitInspection(resolved.snapshot, resolved.semanticFingerprint);
      }
    }
  }

  function toggleInspectionPin(source: InteractionSource): void {
    pointerQueue.cancel({ pendingPinned: "preserve" });
    const pinAction = resolveToggleInspectionPinAction({
      hasInspection: inspection !== null,
      hasSeed: inspectionSeed !== null,
      currentState: inspection?.state ?? "transient",
      pending: pointerQueue.peekPendingPinned(),
    });
    if (pinAction.type === "ignore") return;
    switch (pinAction.type) {
      case "restore-pending": {
        // Consume stash (read+clear) so a second toggle cannot re-restore.
        pointerQueue.takePendingPinned();
        inspectionCoordinator.release("pinned");
        inspection = null;
        inspectionSeed = null;
        setInspection(
          pinAction.pending.candidate,
          pinAction.pending.source,
          "transient",
          pinAction.pending.concreteMode,
        );
        return;
      }
      case "flip": {
        const nextState = pinAction.state;
        const resolved = resolveInspection(inspectionSeed!, source, nextState, inspection!.mode);
        if (resolved === null) return;
        inspection = resolved.snapshot;
        inspectionSeed = resolved.seed;
        if (nextState === "transient") inspectionCoordinator.release("pinned");
        if (shouldAnnounceUnpin({ state: nextState, source }))
          context.announce(`${inspectionLiveText(resolved.snapshot)}, unpinned`);
        if (resolved.semanticChanged)
          emitInspection(resolved.snapshot, resolved.semanticFingerprint);
        if (
          shouldFocusPinnedInteractiveTooltip({
            state: nextState,
            contentMode: context.inspectConfig()?.contentMode,
          })
        )
          queueMicrotask(() =>
            context
              .root()
              ?.querySelector<HTMLElement>(`#${CSS.escape(plotTooltipDomId(options.plotId()))}`)
              ?.focus(),
          );
      }
    }
  }

  /** Shared dismiss path; Escape also cancels area, close does not. */
  function dismissInspection(
    kind: "escape" | "close",
    source: InteractionSource,
    opts: { restoreFocus?: boolean; returnToInspect?: boolean } = {},
  ): InspectionDismissPlan {
    const plan = planInspectionDismiss({
      kind,
      hasInspection: inspection !== null,
      ...(opts.restoreFocus !== undefined && {
        restoreFocus: opts.restoreFocus,
      }),
      ...(opts.returnToInspect !== undefined && {
        returnToInspect: opts.returnToInspect,
      }),
    });
    // discard policy already clears pending pin stash — no second clear.
    pointerQueue.cancel({
      pendingPinned: plan.clearPendingPinned ? "discard" : "preserve",
    });
    // Latch only when dismissing a *transient* inspection (Escape path).
    if (inspection?.state === "transient" && inspectionSeed !== null) {
      dismissedCandidateId = inspectionSeed.id;
      dismissedRunId = context.model()?.runId ?? null;
    } else if (inspection?.state === "pinned") {
      clearDismissedLatch();
    }
    // Real Escape cancels area + bumps epoch; close does not.
    if (kind === "escape") reducerOf().dispatch({ type: "escape", source });
    if (plan.emitClear) emitInspection({ type: "inspect", phase: "clear", source });
    inspection = null;
    inspectionSeed = null;
    if (plan.clearTooltipHovered) options.clearTooltipHovered();
    if (plan.coordinator === "invalidate") inspectionCoordinator.invalidate();
    else inspectionCoordinator.release("pinned");
    // Cross-module clearBrush/returnToInspect: caller applies the plan tail.
    if (plan.restoreFocus) queueMicrotask(() => context.captureSurface()?.focus());
    return plan;
  }

  function closeInspection(source: InteractionSource, restoreFocus = true): InspectionDismissPlan {
    return dismissInspection("close", source, { restoreFocus });
  }

  // Candidate traversal lives in inspection-traversal.svelte.ts; the
  // activeCandidateId cursor stays here, exposed via live get/set ports.
  const traversal = createInspectionTraversal({
    model: () => context.model(),
    hasInspection: () => inspection !== null,
    getActiveCandidateId: () => activeCandidateId,
    setActiveCandidateId: (id) => {
      activeCandidateId = id;
    },
    applyCandidate: (candidate) => {
      setInspection(candidate, "keyboard", "transient");
    },
  });

  function schedulePointerInspect(input: SchedulePointerInspectInput): void {
    pointerQueue.schedule(input);
  }

  function cancelPointerInspect(policy: CancelPointerInspectPolicy): void {
    pointerQueue.cancel(policy);
  }

  function onInspectPointerFrame(action: InspectPointerFrameAction): boolean {
    return pointerQueue.onFrame(action);
  }

  // Coordinator disposal + scene-run reconcile: registration fn invoked during
  // construction (formerly host-phased registerInspectionEffects, #627).
  registerSceneInspectReconcile({
    model: () => context.model(),
    inspectEnabled: () => options.inspectEnabled(),
    dataIdentityEpoch: options.dataIdentityEpoch,
    getInspectionState: () => (inspection === null ? "none" : inspection.state),
    clearInspection: () => {
      inspection = null;
      inspectionSeed = null;
    },
    setInspectionFromReconcile: ({ snapshot, seed }) => {
      inspection = snapshot;
      inspectionSeed = seed;
    },
    setActiveCandidateId: (id) => {
      activeCandidateId = id;
    },
    clearDismissedLatch,
    dispatchSceneInvalidate: () => {
      reducerOf().dispatch({ type: "invalidate", reason: "scene" });
    },
    cancelPointerDiscardPending: () => {
      pointerQueue.cancel({ pendingPinned: "discard" });
    },
    clearPointerForSceneInvalidate: () => {
      pointerQueue.clearForSceneInvalidate();
    },
    coordinatorInvalidate: () => {
      inspectionCoordinator.invalidate();
    },
    releaseTransient: () => {
      inspectionCoordinator.release("transient");
    },
    reconcilePinned: (input) =>
      inspectionCoordinator.reconcilePinned({
        ...input,
        source: "programmatic",
        completeness: "complete",
      }),
    emitClearProgrammatic: () => {
      emitInspection({ type: "inspect", phase: "clear", source: "programmatic" });
    },
    emitSemanticChange: (snapshot, semanticFingerprint) => {
      emitInspection(snapshot, semanticFingerprint);
    },
  });

  return {
    get inspection() {
      return inspection;
    },
    get inspectionPanel() {
      return inspectionPanel;
    },
    /** Internal seed for presentation chrome (kind); not part of the public inspection event. */
    get inspectionSeed() {
      return inspectionSeed;
    },
    get presentationFocus() {
      return presentationFocus;
    },
    setInspection,
    toggleInspectionPin,
    dismissInspection,
    closeInspection,
    navigate: traversal.navigate,
    navigateDirection: traversal.navigateDirection,
    cycleCoincident: traversal.cycleCoincident,
    resetTraversalIndex: traversal.resetTraversalIndex,
    schedulePointerInspect,
    cancelPointerInspect,
    onInspectPointerFrame,
  };
}

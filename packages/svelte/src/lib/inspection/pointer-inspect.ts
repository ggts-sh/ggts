/**
 * Pointer-inspect queue ownership for InspectionState.
 *
 * Owns queued payload + frame token + pending-pin stash, nearest schedule,
 * typed cancel, and onInspectPointerFrame routing. Pure frame tables stay in
 * frame.ts; the host owns $state inspection snapshot, setInspection, dismiss,
 * and scene-reconcile orchestration.
 *
 * Construction must not invoke deps.model / deps.reducer / deps.setInspection
 * (armed-getter construction discipline on the host factory).
 *
 * onFrame may re-enter the host via setInspection (apply-pending). Snapshot
 * then clear queue fields before pure routing so re-entrant cancel sees empty
 * queue fields — load-bearing for touch-tap override of a pending rAF.
 */

import type { CandidateFacts, RenderModel } from "@ggts-sh/core";

import type { InteractionAction, InteractionFrameToken } from "../interaction/reducer.js";
import type { InteractionSource } from "../interaction/interaction.js";
import { resolveTarget } from "../interaction/target.js";
import {
  buildQueuedInspectFrame,
  resolveQueuedInspectFrameAction,
  type InspectionHostState,
  type QueuedPointerInspection,
} from "./frame.js";

/** Intent for a coalesced pointer-inspect frame (nearest lookup owned here). */
export type SchedulePointerInspectInput = {
  readonly point: Readonly<{ x: number; y: number }>;
  readonly source: InteractionSource;
  readonly mode: "auto" | "exact" | "x" | "y" | "xy";
  readonly maxDistance: number;
};

/**
 * hitTest resurrection when nearest misses.
 *
 * nearest under axis modes measures distance to the **anchor**, not painted
 * geometry. hitTest finds whatever mark is under the pointer:
 * - **rects** (bars/tiles): containment of the bar body — keep rescuing so
 *   wide columns under mode x still tooltips when the pointer is on the fill
 *   but farther than maxDistance from the centre anchor.
 * - **paths/segments** (lines, areas, qq_line): stroke/fill can hit far from
 *   vertex anchors; on a two-vertex path that teleports between ends
 *   mid-stroke. Drop those under axis modes (and auto→axis autoMode).
 *
 * Exact always keeps geometric hits. Auto→exact marks (points, default bars)
 * keep full hitTest. Flip-safe: no re-implementation of nearest's axis swap.
 */
function hitTestFallback(
  model: RenderModel,
  input: SchedulePointerInspectInput,
): CandidateFacts | null {
  const hit = model.candidates.hitTest(input.point.x, input.point.y);
  if (hit === null) return null;
  if (input.mode === "exact") return hit;
  const resolved = input.mode === "auto" ? (hit.autoMode ?? "exact") : input.mode;
  if (resolved === "exact") return hit;
  // Axis mode (explicit or auto→x/y): rect containment only.
  return hit.kind === "rects" ? hit : null;
}

/** Cancel policy for pending pointer-inspect work. */
export type CancelPointerInspectPolicy = {
  /** Leave/clear: discard stash. Cancel/down/blur tool paths: preserve. */
  readonly pendingPinned: "preserve" | "discard";
};

/** Inspect frame action delivered to onPointerFrame (non-move-area branch). */
export type InspectPointerFrameAction = Extract<InteractionAction, { type: "inspect" }>;

/** Reducer methods the queue touches (host may pass a getter). */
type PointerInspectReducer = {
  frameToken(): InteractionFrameToken;
  accepts(token: InteractionFrameToken): boolean;
  queuePointer(action: Extract<InteractionAction, { type: "inspect" | "move-area" }>): void;
  cancelScheduledPointer(kind?: "inspect" | "move-area"): void;
};

export type PointerInspectQueueDeps = {
  model: () => RenderModel | null;
  reducer: () => PointerInspectReducer;
  /** Host: `inspection === null ? "none" : inspection.state`. */
  inspectionState: () => InspectionHostState;
  setInspection: (
    candidate: CandidateFacts | null,
    source: InteractionSource,
    state?: "transient" | "pinned",
    concreteMode?: "exact" | "x" | "y" | "xy",
  ) => void;
};

export type PointerInspectQueue = {
  schedule(input: SchedulePointerInspectInput): void;
  cancel(policy: CancelPointerInspectPolicy): void;
  onFrame(action: InspectPointerFrameAction): boolean;
  /** Read-only peek for pin-toggle gates. */
  peekPendingPinned(): QueuedPointerInspection | null;
  /** Read+clear for restore-pending. */
  takePendingPinned(): QueuedPointerInspection | null;
  /**
   * Scene invalidate-* path: clear queue fields only.
   * Caller owns reducer.dispatch({ type: "invalidate" }) which already cancels
   * all scheduled pointer work — do not call cancelScheduledPointer here.
   */
  clearForSceneInvalidate(): void;
};

/**
 * Create the pointer-inspect queue. Does not invoke deps at construction.
 */
export function createPointerInspectQueue(deps: PointerInspectQueueDeps): PointerInspectQueue {
  let queuedPointerToken: InteractionFrameToken | null = null;
  let queuedPointerInspection: QueuedPointerInspection | null = null;
  let pendingPinnedPointer: QueuedPointerInspection | null = null;

  function schedule(input: SchedulePointerInspectInput): void {
    const model = deps.model();
    // Resolved target owns panel-scoped nearest + hover distance policy (#1080 / #787).
    // panelAtOrOnly keeps single-panel axis-margin hover working.
    const target =
      model === null
        ? null
        : resolveTarget({
            model,
            point: input.point,
            intent: "hover",
            inspect: { mode: input.mode, maxDistance: input.maxDistance },
          });
    const match = target?.match ?? null;
    const frame = buildQueuedInspectFrame({
      match,
      source: input.source,
      epoch: model?.runId ?? 0,
      fallbackCandidate: () => (model === null ? null : hitTestFallback(model, input)),
    });
    const reducer = deps.reducer();
    queuedPointerInspection = frame.queued;
    queuedPointerToken = reducer.frameToken();
    try {
      reducer.queuePointer({
        type: "inspect",
        candidate: frame.candidate,
        source: input.source,
      });
    } catch (error) {
      // No orphan payload if scheduling throws.
      queuedPointerInspection = null;
      queuedPointerToken = null;
      throw error;
    }
  }

  function cancel(policy: CancelPointerInspectPolicy): void {
    queuedPointerInspection = null;
    if (policy.pendingPinned === "discard") pendingPinnedPointer = null;
    deps.reducer().cancelScheduledPointer("inspect");
  }

  /**
   * Inspect branch of onPointerFrame.
   *
   * Snapshot then clear before pure routing — re-entrant setInspection cancel
   * must observe empty queue fields.
   *
   * Boolean return is retained for symmetry with move-area's onPointerFrame
   * contract. For `type === "inspect"` the reducer never dispatches the frame
   * payload (inspection is single-authority in InspectionState); callers that
   * gate on false still get the pure-table "drop" signal for stale tokens.
   */
  function onFrame(action: InspectPointerFrameAction): boolean {
    const pending = queuedPointerInspection;
    const token = queuedPointerToken;
    queuedPointerInspection = null;
    queuedPointerToken = null;
    // Short-circuit tokenAccepted when no pending so accepts() is not
    // called for empty frames.
    const frameAction = resolveQueuedInspectFrameAction({
      hasPending: pending !== null,
      tokenAccepted: pending === null || token === null || deps.reducer().accepts(token),
      currentState: deps.inspectionState(),
      candidateEpochMismatch:
        action.candidate !== null && action.candidate.epoch !== deps.model()?.runId,
    });
    switch (frameAction.type) {
      case "none":
        // Empty frame (payload already cleared; scheduled inspect still flushed).
        return true;
      case "drop":
        // Stale token / epoch mismatch — pure-table drop signal.
        return false;
      case "stash-pending":
        if (pending !== null) pendingPinnedPointer = pending;
        return true;
      case "apply-pending":
        if (pending !== null) {
          deps.setInspection(pending.candidate, pending.source, "transient", pending.concreteMode);
        }
        return true;
    }
    return true;
  }

  function peekPendingPinned(): QueuedPointerInspection | null {
    return pendingPinnedPointer;
  }

  function takePendingPinned(): QueuedPointerInspection | null {
    const pending = pendingPinnedPointer;
    pendingPinnedPointer = null;
    return pending;
  }

  function clearForSceneInvalidate(): void {
    queuedPointerInspection = null;
    pendingPinnedPointer = null;
    queuedPointerToken = null;
  }

  return {
    schedule,
    cancel,
    onFrame,
    peekPendingPinned,
    takePendingPinned,
    clearForSceneInvalidate,
  };
}

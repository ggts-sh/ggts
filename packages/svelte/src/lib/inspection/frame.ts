/**
 * Pure decision tables for capture-surface inspection *frame* policy:
 * pointer-move queue payloads and onPointerFrame routing.
 * InspectionState owns queue mutation and setInspection side effects;
 * these tables stay pure routing helpers.
 */

import type { CandidateFacts, CandidateMatch } from "@ggts-sh/core";

import type { InteractionSource } from "../interaction/interaction.js";
import type { InteractionCandidateRef } from "../interaction/reducer.js";

/** Host inspection lifecycle state used across pure inspection tables. */
export type InspectionHostState = "none" | "transient" | "pinned";

/**
 * Host queue payload for pointer-move / touch-inspect frames and pending pin restore.
 * `concreteMode` is present only when a nearest match supplied the mode.
 * Candidate is the sole hit authority — no parallel SceneHit projection (#1038).
 */
export type QueuedPointerInspection = {
  candidate: CandidateFacts | null;
  source: InteractionSource;
  concreteMode?: "exact" | "x" | "y" | "xy";
};

/**
 * Build the queued pointer-inspect payload.
 * Match is a single object: mode and candidate always come from the same nearest hit.
 */
export function buildQueuedPointerInspection(input: {
  readonly source: InteractionSource;
  readonly match: CandidateMatch | null;
}): QueuedPointerInspection {
  if (input.match === null) {
    return { candidate: null, source: input.source };
  }
  return {
    candidate: input.match,
    source: input.source,
    concreteMode: input.match.mode,
  };
}

/**
 * Cohesive queue-inspect frame payload for host `onPointerMove` queue-inspect.
 *
 * Owns the single `match === null` branch for hit resolution + reducer
 * candidate ref (avoids three separate null checks / eager hitTest).
 * `fallbackCandidate` is evaluated only on the path that needs it.
 * Candidate `panelId` comes from the facts object (no scene index round-trip).
 */
export type QueuedInspectFrameBuild = {
  readonly queued: QueuedPointerInspection;
  readonly candidate: InspectionCandidateRef | null;
};

export function buildQueuedInspectFrame(input: {
  readonly match: CandidateMatch | null;
  readonly source: InteractionSource;
  readonly epoch: number;
  /** Evaluated only when match is null. */
  readonly fallbackCandidate: () => CandidateFacts | null;
}): QueuedInspectFrameBuild {
  if (input.match === null) {
    const fallback = input.fallbackCandidate();
    if (fallback === null)
      return {
        queued: { candidate: null, source: input.source },
        candidate: null,
      };
    return {
      queued: { candidate: fallback, source: input.source },
      candidate: {
        epoch: input.epoch,
        id: fallback.id,
        panelId: fallback.panelId,
        x: fallback.x,
        y: fallback.y,
      },
    };
  }
  const match = input.match;
  return {
    queued: buildQueuedPointerInspection({
      source: input.source,
      match,
    }),
    candidate: {
      epoch: input.epoch,
      id: match.id,
      panelId: match.panelId,
      x: match.x,
      y: match.y,
    },
  };
}

export type QueuedInspectFrameInput = {
  /** True when a snapshotted `queuedPointerInspection` payload exists. */
  readonly hasPending: boolean;
  /**
   * Host: `token === null || reducer.accepts(token)`.
   * Compute only after confirming a pending payload exists (or short-circuit
   * so `reducer.accepts` is not called when `hasPending` is false).
   */
  readonly tokenAccepted: boolean;
  /** Current host inspection: null → `"none"`, else `inspection.state`. */
  readonly currentState: InspectionHostState;
  /**
   * Host: `action.candidate !== null && action.candidate.epoch !== model?.runId`
   * from the reducer frame action (not the queued candidate snapshot).
   * When the frame action has no candidate, pass false.
   */
  readonly candidateEpochMismatch: boolean;
};

export type QueuedInspectFrameAction =
  | { readonly type: "none" }
  | { readonly type: "drop" }
  | { readonly type: "stash-pending" }
  | { readonly type: "apply-pending" };

/**
 * Pure decision for the inspect branch of `onInspectPointerFrame` after
 * InspectionState has snapshotted and cleared queue fields.
 *
 * Priority:
 *   1. none — !hasPending
 *   2. drop — !tokenAccepted (stale frame token) → skip reducer dispatch
 *   3. stash-pending — currentState === "pinned"
 *   4. drop — candidateEpochMismatch → skip reducer dispatch
 *   5. apply-pending
 */
export function resolveQueuedInspectFrameAction(
  input: QueuedInspectFrameInput,
): QueuedInspectFrameAction {
  if (!input.hasPending) return { type: "none" };
  if (!input.tokenAccepted) return { type: "drop" };
  if (input.currentState === "pinned") return { type: "stash-pending" };
  if (input.candidateEpochMismatch) return { type: "drop" };
  return { type: "apply-pending" };
}

/** Reducer inspect payload candidate — same type as InteractionCandidateRef (#1080). */
type InspectionCandidateRef = InteractionCandidateRef;

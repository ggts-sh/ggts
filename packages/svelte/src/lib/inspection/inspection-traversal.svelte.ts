/**
 * Candidate traversal (keyboard candidate navigation) extracted from
 * inspection-state.svelte.ts for S5 (plan §4).
 *
 * The factory receives live accessors only — the model that owns the
 * candidate store, the live inspection-presence check, and the traversal
 * cursor (activeCandidateId) get/set — and applies candidates through the
 * host's `applyCandidate` action. It owns NO mutable state: the cursor stays
 * in the inspection-state lexical owner and is re-read on every call, never
 * cached or snapshotted.
 */
import type { CandidateFacts, RenderModel } from "@ggts-sh/core";

export type InspectionTraversalPorts = {
  /** Candidate-store authority — re-read per call, never cached. */
  readonly model: () => RenderModel | null;
  /** Live inspection presence (directional/cycle start behavior). */
  readonly hasInspection: () => boolean;
  readonly getActiveCandidateId: () => number | null;
  readonly setActiveCandidateId: (id: number | null) => void;
  /** Apply a candidate — host routes to setInspection("keyboard", "transient"). */
  readonly applyCandidate: (candidate: CandidateFacts) => void;
};

export function createInspectionTraversal(ports: InspectionTraversalPorts) {
  function applyCandidateId(id: number | null): void {
    if (id === null) return;
    const candidate = ports.model()?.candidates.candidate(id);
    if (candidate === null || candidate === undefined) return;
    ports.setActiveCandidateId(id);
    ports.applyCandidate(candidate);
  }

  function navigate(delta: number): void {
    const store = ports.model()?.candidates;
    if (store === undefined || store.size === 0) return;
    const direction = delta < 0 ? "previous" : "next";
    applyCandidateId(store.traverse(ports.getActiveCandidateId(), direction, Math.abs(delta)));
  }

  function navigateDirection(dx: number, dy: number): void {
    const store = ports.model()?.candidates;
    if (store === undefined || store.size === 0) return;
    // Live read + local snapshot per call so the store sees the narrowed id.
    const current = ports.getActiveCandidateId();
    if (!ports.hasInspection() || current === null) {
      applyCandidateId(store.traverse(current, "next"));
      return;
    }
    const direction = dx < 0 ? "left" : dx > 0 ? "right" : dy < 0 ? "up" : dy > 0 ? "down" : "next";
    applyCandidateId(store.traverse(current, direction));
  }

  function cycleCoincident(delta: number): void {
    const store = ports.model()?.candidates;
    if (store === undefined || store.size === 0) return;
    const current = ports.getActiveCandidateId();
    if (!ports.hasInspection() || current === null) {
      applyCandidateId(store.traverse(current, "next"));
      return;
    }
    applyCandidateId(store.cycle(current, delta));
  }

  function resetTraversalIndex(): void {
    ports.setActiveCandidateId(null);
  }

  return {
    applyCandidateId,
    navigate,
    navigateDirection,
    cycleCoincident,
    resetTraversalIndex,
  };
}

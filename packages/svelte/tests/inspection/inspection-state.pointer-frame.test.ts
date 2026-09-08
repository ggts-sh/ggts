/**
 * createInspectionState tests — schedulePointerInspect / onInspectPointerFrame queue lifecycle.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import type { CandidateFacts } from "@ggts-sh/core";

import { reactiveBox } from "../helpers/reactive-box.svelte.js";
import {
  candidateHit,
  continuousSpec,
  createInspectionState,
  createInteractionReducer,
  modelFor,
  mountInspectionController,
} from "./inspection-state.harness.js";

describe("createInspectionState schedulePointerInspect / onInspectPointerFrame", () => {
  it("applies on flush, drops stale tokens without reducer dispatch, stashes when pinned, cancels before flush", () => {
    const model = modelFor(continuousSpec());
    const announcements: string[] = [];
    const { state, reducer, flushFrame, destroy } = mountInspectionController({
      model: () => model,
      announce: (message) => {
        announcements.push(message);
      },
      deferredFrames: true,
    });
    const { candidate } = candidateHit(model);

    // Empty frame path: no pending → none; no inspection change.
    expect(
      state.onInspectPointerFrame({
        type: "inspect",
        candidate: null,
        source: "pointer",
      }),
    ).toBe(true);
    flushSync();
    expect(state.inspection).toBeNull();

    // Fresh schedule + flush → InspectionState owns transient lifecycle.
    // Scene-reconcile may have already bumped reducer revision at mount;
    // pin that applying inspect does not advance it further.
    const revisionBeforeInspect = reducer.state.revision;
    state.schedulePointerInspect({
      point: { x: candidate.x, y: candidate.y },
      source: "pointer",
      mode: "xy",
      maxDistance: 1e6,
    });
    flushFrame();
    flushSync();
    expect(state.inspection?.state).toBe("transient");
    // Reducer is not the inspection authority (inspect frames never commit).
    expect(reducer.state.revision).toBe(revisionBeforeInspect);

    // Re-apply empty (queues cleared) keeps transient.
    expect(
      state.onInspectPointerFrame({
        type: "inspect",
        candidate: {
          epoch: model.runId,
          id: candidate.id,
          panelId: candidate.panelId,
          x: candidate.x,
          y: candidate.y,
        },
        source: "pointer",
      }),
    ).toBe(true);
    flushSync();
    expect(state.inspection?.state).toBe("transient");

    // Stale token → drop (no InspectionState apply).
    state.setInspection(null, "pointer");
    flushSync();
    reducer.dispatch({ type: "set-tool", tool: "select-area" });
    state.schedulePointerInspect({
      point: { x: candidate.x, y: candidate.y },
      source: "pointer",
      mode: "xy",
      maxDistance: 1e6,
    });
    const scheduledToken = reducer.frameToken();
    // begin-area bumps revision without cancelling the inspect schedule.
    reducer.dispatch({
      type: "begin-area",
      point: { x: 0, y: 0 },
      panelId: "panel:all",
    });
    expect(reducer.accepts(scheduledToken)).toBe(false);
    flushFrame();
    flushSync();
    expect(state.inspection).toBeNull();

    // Cancel before flush → no apply.
    state.schedulePointerInspect({
      point: { x: candidate.x, y: candidate.y },
      source: "pointer",
      mode: "xy",
      maxDistance: 1e6,
    });
    state.cancelPointerInspect({ pendingPinned: "preserve" });
    flushFrame();
    flushSync();
    expect(state.inspection).toBeNull();

    // Pin + schedule other candidate → stash; single-stash; restore then flip.
    state.schedulePointerInspect({
      point: { x: candidate.x, y: candidate.y },
      source: "pointer",
      mode: "xy",
      maxDistance: 1e6,
    });
    flushFrame();
    flushSync();
    state.toggleInspectionPin("pointer");
    flushSync();
    expect(state.inspection?.state).toBe("pinned");

    let other: CandidateFacts | null = null;
    for (let id = 0; id < model.candidates.size; id++) {
      const c = model.candidates.candidate(id);
      if (c !== null && c.id !== candidate.id) {
        other = c;
        break;
      }
    }
    if (other === null) throw new Error("expected another candidate");

    state.schedulePointerInspect({
      point: { x: other.x, y: other.y },
      source: "pointer",
      mode: "xy",
      maxDistance: 1e6,
    });
    flushFrame();
    flushSync();
    expect(state.inspection?.state).toBe("pinned");
    // Second schedule+flush must not double-stash.
    state.schedulePointerInspect({
      point: { x: other.x, y: other.y },
      source: "pointer",
      mode: "xy",
      maxDistance: 1e6,
    });
    flushFrame();
    flushSync();
    expect(state.inspection?.state).toBe("pinned");

    announcements.length = 0;
    state.toggleInspectionPin("keyboard");
    flushSync();
    expect(state.inspection?.state).toBe("transient");
    expect(state.inspection?.focus.anchor).toEqual({ x: other.x, y: other.y });
    expect(announcements.some((m) => m.includes("unpinned"))).toBe(false);

    state.toggleInspectionPin("keyboard");
    flushSync();
    announcements.length = 0;
    state.toggleInspectionPin("keyboard");
    flushSync();
    expect(state.inspection?.state).toBe("transient");
    expect(announcements.some((m) => m.includes("unpinned"))).toBe(true);

    // cancelPointerInspect({ discard }) drops stash → flip announces.
    state.toggleInspectionPin("keyboard");
    flushSync();
    state.schedulePointerInspect({
      point: { x: candidate.x, y: candidate.y },
      source: "pointer",
      mode: "xy",
      maxDistance: 1e6,
    });
    flushFrame();
    flushSync();
    expect(state.inspection?.state).toBe("pinned");
    state.cancelPointerInspect({ pendingPinned: "discard" });
    announcements.length = 0;
    state.toggleInspectionPin("keyboard");
    flushSync();
    expect(state.inspection?.state).toBe("transient");
    expect(announcements.some((m) => m.includes("unpinned"))).toBe(true);

    destroy();
  });

  it("typed inspect cancel does not cancel a pending move-area schedule", () => {
    let frame: (() => void) | null = null;
    const frames: string[] = [];
    let controller: ReturnType<typeof createInspectionState> | null = null;
    const model = modelFor(continuousSpec());
    const reducer = createInteractionReducer({
      scheduleFrame: (callback) => {
        frame = callback;
        return 1;
      },
      cancelFrame: () => {
        frame = null;
      },
      onPointerFrame: (action) => {
        frames.push(action.type);
        if (action.type === "inspect") return controller!.onInspectPointerFrame(action);
        return true;
      },
    });
    const { state, destroy } = mountInspectionController({
      model: () => model,
      reducer: () => reducer,
    });
    controller = state;

    reducer.queuePointer({ type: "move-area", point: { x: 1, y: 2 } });
    expect(frame).not.toBeNull();
    state.cancelPointerInspect({ pendingPinned: "preserve" });
    expect(frame).not.toBeNull();
    frame?.();
    expect(frames).toEqual(["move-area"]);

    destroy();
  });

  it("clear-disabled discards inspect queue with inspect-only cancel (move-area survives)", () => {
    let frame: (() => void) | null = null;
    const frames: string[] = [];
    let controller: ReturnType<typeof createInspectionState> | null = null;
    const model = modelFor(continuousSpec());
    const enabledBox = reactiveBox(true);
    const reducer = createInteractionReducer({
      scheduleFrame: (callback) => {
        frame = callback;
        return 1;
      },
      cancelFrame: () => {
        frame = null;
      },
      onPointerFrame: (action) => {
        frames.push(action.type);
        if (action.type === "inspect") return controller!.onInspectPointerFrame(action);
        return true;
      },
    });
    const { state, destroy } = mountInspectionController({
      model: () => model,
      reducer: () => reducer,
      inspectEnabled: () => enabledBox.value,
    });
    controller = state;

    const { candidate } = candidateHit(model);
    state.setInspection(candidate, "pointer", "transient", "xy");
    flushSync();
    expect(state.inspection?.state).toBe("transient");

    // Queue move-area, then disable inspect (clear-disabled path).
    reducer.queuePointer({ type: "move-area", point: { x: 3, y: 4 } });
    expect(frame).not.toBeNull();
    enabledBox.set(false);
    flushSync();
    expect(state.inspection).toBeNull();
    // Inspect-only cancel must not kill the move-area schedule.
    expect(frame).not.toBeNull();
    frame?.();
    expect(frames).toEqual(["move-area"]);

    destroy();
  });
});

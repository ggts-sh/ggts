/**
 * createInspectionState tests — presentationFocus projection, setInspection, pin cycle.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import type { CandidateFacts, CellValue } from "@ggts-sh/core";

import type { PlotInspection } from "../../src/lib/interaction/interaction.js";
import {
  candidateHit,
  continuousSpec,
  modelFor,
  mountInspectionController,
} from "./inspection-state.harness.js";

describe("createInspectionState presentationFocus (#1080)", () => {
  it("owns the presentation focus projection so plot-engine does not re-assemble it", () => {
    const model = modelFor(continuousSpec());
    const { state, destroy } = mountInspectionController({ model: () => model });

    expect(state.presentationFocus).toBeNull();

    const { candidate } = candidateHit(model);
    state.setInspection(candidate, "pointer", "transient", "xy");
    flushSync();

    const focus = state.presentationFocus;
    expect(focus).not.toBeNull();
    expect(focus!.sourceKeys).toEqual(state.inspection!.focus.sourceKeys);
    expect(focus!.key).toBe(state.inspection!.focus.key);
    expect(focus!.kind).toBe(candidate.kind);
    expect(focus!.primitives).toEqual([
      { batchIndex: candidate.batchIndex, primitiveIndex: candidate.primitiveIndex },
    ]);

    // Pin flips state; presentation fields from seed + focus stay stable.
    state.toggleInspectionPin("pointer");
    flushSync();
    expect(state.inspection?.state).toBe("pinned");
    expect(state.presentationFocus).toEqual(focus);

    // Pinned null-clear is ignored; dismiss ends the session.
    state.dismissInspection("close", "pointer");
    flushSync();
    expect(state.presentationFocus).toBeNull();
    destroy();
  });
});

describe("createInspectionState setInspection", () => {
  it("applies a transient snapshot and gates re-emits by fingerprint", () => {
    const model = modelFor(continuousSpec());
    const events: PlotInspection<Record<string, CellValue>>[] = [];
    const { state, destroy } = mountInspectionController({
      model: () => model,
      oninspect: () => (event) => {
        events.push(event);
      },
    });

    const { candidate } = candidateHit(model);
    state.setInspection(candidate, "pointer", "transient", "xy");
    flushSync();
    expect(state.inspection).not.toBeNull();
    expect(state.inspection?.state).toBe("transient");
    expect(state.inspection?.phase).toBe("change");
    expect(events).toHaveLength(1);
    expect(events[0]?.phase).toBe("change");

    // Same fingerprint → skip emit.
    state.setInspection(candidate, "pointer", "transient", "xy");
    flushSync();
    expect(events).toHaveLength(1);

    // Clear emits once.
    state.setInspection(null, "pointer");
    flushSync();
    expect(state.inspection).toBeNull();
    expect(events).toHaveLength(2);
    expect(events[1]?.phase).toBe("clear");

    destroy();
  });

  it("cancels queued inspect before applying a touch tap so rAF cannot override", () => {
    const model = modelFor(continuousSpec());
    const { state, flushFrame, destroy } = mountInspectionController({
      model: () => model,
      deferredFrames: true,
      inspectConfig: () => ({ mode: "xy", maxDistance: 1e6, pin: false }),
    });
    const hover = model.candidates.candidate(0);
    const tap = model.candidates.candidate(1);
    if (hover === null || tap === null) throw new Error("expected two candidates");
    expect(hover.id).not.toBe(tap.id);

    // Small touch move schedules inspect for hover candidate.
    state.schedulePointerInspect({
      point: { x: hover.x, y: hover.y },
      source: "touch",
      mode: "xy",
      maxDistance: 1e6,
    });
    // Tap applies a different candidate without waiting for the frame.
    state.setInspection(tap, "touch", "transient", "xy");
    flushSync();
    expect(state.inspection?.focus.anchor).toEqual({ x: tap.x, y: tap.y });

    // Stale queued frame must not re-apply hover after the tap.
    flushFrame();
    flushSync();
    expect(state.inspection?.focus.anchor).toEqual({ x: tap.x, y: tap.y });

    destroy();
  });
});

describe("createInspectionState pin cycle", () => {
  it("transient → pin flip → unpin announcement + release", () => {
    const model = modelFor(continuousSpec());
    const announcements: string[] = [];
    const { state, destroy } = mountInspectionController({
      model: () => model,
      announce: (message) => {
        announcements.push(message);
      },
    });

    const { candidate } = candidateHit(model);
    state.setInspection(candidate, "pointer", "transient", "xy");
    flushSync();
    expect(state.inspection?.state).toBe("transient");

    state.toggleInspectionPin("keyboard");
    flushSync();
    expect(state.inspection?.state).toBe("pinned");

    state.toggleInspectionPin("keyboard");
    flushSync();
    expect(state.inspection?.state).toBe("transient");
    expect(announcements.some((message) => message.includes("unpinned"))).toBe(true);

    destroy();
  });

  it("restore-pending path via schedulePointerInspect while pinned", () => {
    const model = modelFor(continuousSpec());
    const { state, flushFrame, destroy } = mountInspectionController({
      model: () => model,
      deferredFrames: true,
    });

    const first = candidateHit(model);
    state.setInspection(first.candidate, "pointer", "transient", "xy");
    flushSync();
    state.toggleInspectionPin("pointer");
    flushSync();
    expect(state.inspection?.state).toBe("pinned");

    let second: CandidateFacts | null = null;
    for (let id = 0; id < model.candidates.size; id++) {
      const candidate = model.candidates.candidate(id);
      if (candidate !== null && candidate.id !== first.candidate.id) {
        second = candidate;
        break;
      }
    }
    if (second === null) throw new Error("expected a second candidate");

    state.schedulePointerInspect({
      point: { x: second.x, y: second.y },
      source: "pointer",
      mode: "xy",
      maxDistance: 1e6,
    });
    flushFrame();
    flushSync();
    // Still pinned — pending was stashed, not applied.
    expect(state.inspection?.state).toBe("pinned");

    state.toggleInspectionPin("pointer");
    flushSync();
    expect(state.inspection?.state).toBe("transient");
    expect(state.inspection?.focus.anchor).toEqual({
      x: second.x,
      y: second.y,
    });

    destroy();
  });
});

/**
 * createInspectionState tests — construction, scene-reconcile, callback liveness.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import type { CandidateFacts, CellValue, RenderModel } from "@ggts-sh/core";

import type { PlotInspection } from "../../src/lib/interaction/interaction.js";
import { withEffectRoot } from "../helpers/effect-root.svelte.js";
import { testInteractionContext } from "../helpers/interaction-context.js";
import { reactiveBox } from "../helpers/reactive-box.svelte.js";
import {
  applyInspect,
  candidateHit,
  continuousSpec,
  createInspectionState,
  createInteractionReducer,
  defaultInspect,
  modelFor,
  mountInspectionController,
  noInspect,
  noInteraction,
  type InspectCb,
  type InteractionCb,
} from "./inspection-state.harness.js";

describe("createInspectionState construction", () => {
  it("does not invoke armed later-declared getters during construction (before first flush)", () => {
    let reducerCalls = 0;
    let captureSurfaceCalls = 0;
    let tooltipHoveredCalls = 0;
    let clearTooltipHoveredCalls = 0;
    let keyAtCalls = 0;
    let inspectEnabledCalls = 0;
    let oninspectCalls = 0;
    let oninteractionCalls = 0;
    let plotIdCalls = 0;

    const constructionModel = modelFor(continuousSpec());
    const reducer = createInteractionReducer();

    const { value: state, destroy } = withEffectRoot(() =>
      createInspectionState(
        testInteractionContext({
          model: () => constructionModel,
          inspectConfig: defaultInspect,
          keyAt: (index) => {
            keyAtCalls++;
            return String(index);
          },
          root: () => null,
          captureSurface: () => {
            captureSurfaceCalls++;
            return null;
          },
          tooltipHovered: () => {
            tooltipHoveredCalls++;
            return false;
          },
          oninspect: () => {
            oninspectCalls++;
            return noInspect();
          },
          oninteraction: () => {
            oninteractionCalls++;
            return noInteraction();
          },
          announce: () => {},
        }),
        {
          reducer: () => {
            reducerCalls++;
            return reducer;
          },
          inspectEnabled: () => {
            inspectEnabledCalls++;
            return true;
          },
          dataIdentityEpoch: () => "epoch-1",
          plotId: () => {
            plotIdCalls++;
            return "plot";
          },
          clearTooltipHovered: () => {
            clearTooltipHoveredCalls++;
          },
          clearAnnouncement: () => {},
        },
      ),
    );

    expect(reducerCalls).toBe(0);
    expect(captureSurfaceCalls).toBe(0);
    expect(tooltipHoveredCalls).toBe(0);
    expect(clearTooltipHoveredCalls).toBe(0);
    expect(keyAtCalls).toBe(0);
    expect(inspectEnabledCalls).toBe(0);
    expect(oninspectCalls).toBe(0);
    expect(oninteractionCalls).toBe(0);
    expect(plotIdCalls).toBe(0);
    // Accessors before flush must not reach armed getters (construction-read
    // discipline). Scene-reconcile effects may read inspectEnabled after flush.
    expect(state.inspection).toBeNull();
    expect(state.inspectionPanel).toBeNull();
    destroy();
  });
});

describe("createInspectionState scene-reconcile effect", () => {
  it("clears transient on model swap; reconciles pinned; clears when inspect disabled", () => {
    const modelA = modelFor(continuousSpec());
    const modelB = modelFor(
      continuousSpec([
        { id: "x", x: 2, y: 3 },
        { id: "y", x: 4, y: 5 },
      ]),
    );
    // Distinct runIds so reconcile advances.
    Object.defineProperty(modelA, "runId", { value: 1, configurable: true });
    Object.defineProperty(modelB, "runId", { value: 2, configurable: true });

    const modelBox = reactiveBox<RenderModel | null>(modelA);
    const enabledBox = reactiveBox(true);
    const events: PlotInspection<Record<string, CellValue>>[] = [];

    const { state, destroy } = mountInspectionController({
      model: () => modelBox.value,
      inspectEnabled: () => enabledBox.value,
      oninspect: () => (event) => {
        events.push(event);
      },
    });

    const { candidate } = candidateHit(modelA);
    state.setInspection(candidate, "pointer", "transient", "xy");
    flushSync();
    expect(state.inspection?.state).toBe("transient");
    events.length = 0;

    // Model swap → invalidate-clear-transient.
    modelBox.set(modelB);
    flushSync();
    expect(state.inspection).toBeNull();

    // Reconcile-pinned SUCCESS path, deterministic: a "responsive relayout"
    // clone of the SAME model (same data/identity, bumped runId). The pinned
    // snapshot must survive and — because nothing semantic changed — emit
    // NOTHING (duplicate change events after relayouts are the drift this
    // pins).
    const b = candidateHit(modelB);
    applyInspect(state, b.candidate);
    flushSync();
    state.toggleInspectionPin("pointer");
    flushSync();
    expect(state.inspection?.state).toBe("pinned");
    events.length = 0;
    const relayout = Object.create(
      Object.getPrototypeOf(modelB) as object,
      Object.getOwnPropertyDescriptors(modelB),
    ) as RenderModel;
    Object.defineProperty(relayout, "runId", { value: 4, configurable: true });
    modelBox.set(relayout);
    flushSync();
    expect(state.inspection).not.toBeNull();
    expect(state.inspection?.state).toBe("pinned");
    expect(events).toEqual([]);

    // Reconcile-pinned CLEAR path, deterministic: swap to a model with
    // DISJOINT row ids (keyAt cannot find the pinned seed) → one programmatic
    // clear emit + teardown of any queued/pending frames.
    // Queue a pending inspect payload via the intentful schedule API (no flush).
    state.schedulePointerInspect({
      point: { x: b.candidate.x, y: b.candidate.y },
      source: "pointer",
      mode: "xy",
      maxDistance: 1e6,
    });
    events.length = 0;
    Object.defineProperty(modelA, "runId", { value: 5, configurable: true });
    modelBox.set(modelA);
    flushSync();
    expect(state.inspection).toBeNull();
    expect(events.some((event) => event.phase === "clear")).toBe(true);
    // Invalidate teardown cleared the queued frame: a fresh apply is empty.
    state.onInspectPointerFrame({
      type: "inspect",
      candidate: {
        epoch: modelA.runId,
        id: b.candidate.id,
        panelId: b.candidate.panelId,
        x: b.candidate.x,
        y: b.candidate.y,
      },
      source: "pointer",
    });
    flushSync();
    expect(state.inspection).toBeNull();

    // Disable inspect → clear-disabled.
    enabledBox.set(false);
    flushSync();
    expect(state.inspection).toBeNull();

    destroy();
  });

  it("scene invalidate drops stashed pending so unpin does not restore a pre-swap stash", () => {
    const modelA = modelFor(continuousSpec());
    Object.defineProperty(modelA, "runId", { value: 1, configurable: true });
    const modelBox = reactiveBox<RenderModel | null>(modelA);
    const { state, flushFrame, destroy } = mountInspectionController({
      model: () => modelBox.value,
      deferredFrames: true,
    });

    const first = candidateHit(modelA);
    applyInspect(state, first.candidate);
    flushSync();
    state.toggleInspectionPin("pointer");
    flushSync();
    expect(state.inspection?.state).toBe("pinned");

    let second: CandidateFacts | null = null;
    for (let id = 0; id < modelA.candidates.size; id++) {
      const candidate = modelA.candidates.candidate(id);
      if (candidate !== null && candidate.id !== first.candidate.id) {
        second = candidate;
        break;
      }
    }
    if (second === null) throw new Error("expected a second candidate");

    // While pinned, a flushed inspect stashes rather than applying.
    state.schedulePointerInspect({
      point: { x: second.x, y: second.y },
      source: "pointer",
      mode: "xy",
      maxDistance: 1e6,
    });
    flushFrame();
    flushSync();
    expect(state.inspection?.state).toBe("pinned");

    // Responsive relayout (same data, advanced runId) reconciles the pin and
    // must clear the queue stash so a later unpin flips the original seed.
    const relayout = Object.create(
      Object.getPrototypeOf(modelA) as object,
      Object.getOwnPropertyDescriptors(modelA),
    ) as RenderModel;
    Object.defineProperty(relayout, "runId", { value: 2, configurable: true });
    modelBox.set(relayout);
    flushSync();
    expect(state.inspection?.state).toBe("pinned");

    state.toggleInspectionPin("pointer");
    flushSync();
    expect(state.inspection?.state).toBe("transient");
    expect(state.inspection?.focus.anchor).toEqual({
      x: first.candidate.x,
      y: first.candidate.y,
    });
    expect(state.inspection?.focus.anchor).not.toEqual({
      x: second.x,
      y: second.y,
    });

    destroy();
  });
});

describe("createInspectionState callback replacement", () => {
  it("reads current oninspect + oninteraction boxes on each emit", () => {
    const model = modelFor(continuousSpec());
    const inspectBox = reactiveBox<InspectCb>(noInspect());
    const interactionBox = reactiveBox<InteractionCb>(noInteraction());
    const inspectEvents: string[] = [];
    const interactionEvents: string[] = [];

    const { state, destroy } = mountInspectionController({
      model: () => model,
      oninspect: () => inspectBox.value,
      oninteraction: () => interactionBox.value,
    });

    const { candidate } = candidateHit(model);
    // No callbacks → resolve still works; no events.
    state.setInspection(candidate, "pointer", "transient", "xy");
    flushSync();
    expect(inspectEvents).toEqual([]);

    inspectBox.set((event) => {
      inspectEvents.push(event.phase);
    });
    interactionBox.set((event) => {
      interactionEvents.push(event.type);
    });

    // Clear then re-apply so a fresh semantic emit fires.
    state.setInspection(null, "pointer");
    flushSync();
    // Clear may emit to the now-registered sinks.
    inspectEvents.length = 0;
    interactionEvents.length = 0;

    // Force a different candidate if available for a new fingerprint.
    let other: CandidateFacts | null = null;
    for (let id = 0; id < model.candidates.size; id++) {
      const c = model.candidates.candidate(id);
      if (c !== null && c.id !== candidate.id) {
        other = c;
        break;
      }
    }
    if (other === null) {
      // Same seed after clear still emits change when fingerprint differs from clear.
      state.setInspection(candidate, "pointer", "transient", "xy");
    } else {
      state.setInspection(other, "pointer", "transient", "xy");
    }
    flushSync();
    expect(inspectEvents).toContain("change");
    expect(interactionEvents).toContain("inspect");

    destroy();
  });
});

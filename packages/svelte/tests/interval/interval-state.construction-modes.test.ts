/**
 * createIntervalState tests — construction, modes, clear, targets, semanticAxis.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";
import { encodeKey } from "@ggts-sh/core";

import { withEffectRoot } from "../helpers/effect-root.svelte.js";
import { testInteractionContext } from "../helpers/interaction-context.js";
import { reactiveBox } from "../helpers/reactive-box.svelte.js";
import {
  bandXSpec,
  brushEvent,
  buildIntervalSelection,
  continuousSpec,
  createIntervalState,
  createPlotInteraction,
  defaultScope,
  facetSpec,
  identityCandidateKeys,
  modelFor,
  mountIntervalController,
  noController,
  persistentSelect,
  type MaybeController,
  type PlotSelection,
} from "./interval-state.harness.js";

describe("createIntervalState construction", () => {
  it("does not invoke armed later-declared getters during construction (before first flush)", () => {
    let emitCalls = 0;
    let commitZoomCalls = 0;
    let announceCalls = 0;
    let inspectionPanelCalls = 0;
    let candidateSemanticKeysCalls = 0;
    // One stable model, as the host getter supplies (a fresh pipeline run per
    // read is not production-shaped and would defeat identity assertions).
    const constructionModel = modelFor(continuousSpec());

    const { value: state, destroy } = withEffectRoot(() =>
      createIntervalState(
        testInteractionContext({
          model: () => constructionModel,
          interaction: noController,
          resolvedInteractionScope: () => defaultScope,
          selectConfig: persistentSelect,
          captureSurface: () => null,
          // Issue #165 history: under the retired eager-SSR floor, a
          // pre-populated non-union controller + non-null model reached this
          // at construction. Deriveds are lazy at the 5.33.1 floor, so this
          // guard pins the common empty-intervals construction path only.
          candidateSemanticKeys: (candidate) => {
            candidateSemanticKeysCalls++;
            return identityCandidateKeys(candidate);
          },
          announce: () => {
            announceCalls++;
          },
        }),
        {
          effectiveZoomDomains: () => null,
          commitZoom: () => {
            commitZoomCalls++;
          },
          consumptionCandidates: () => {
            throw new Error("consumptionCandidates must remain lazy for empty intervals");
          },
          inspectionPanel: () => {
            inspectionPanelCalls++;
            return null;
          },
          emitSelection: () => {
            emitCalls++;
          },
        },
      ),
    );

    expect(emitCalls).toBe(0);
    expect(commitZoomCalls).toBe(0);
    expect(announceCalls).toBe(0);
    expect(inspectionPanelCalls).toBe(0);
    expect(candidateSemanticKeysCalls).toBe(0);
    // Deriveds are lazy on client and server at the 5.33.1 floor, so this
    // guard proves the exposed accessors reach no armed getter (reads + one
    // flush below) — the construction-read discipline. Direct (non-derived)
    // construction-time reads of armed deps would throw right here.
    expect(state.committedInterval).toBeNull();
    expect(state.effectiveIntervals).toEqual([]);
    expect(state.effectiveIntervalKeys).toEqual([]);
    expect(state.currentIntervalTargetLabel).toBeUndefined();
    expect(state.boundsEditorInput).toBeNull();
    expect(state.boundsReturnFocus).toBeNull();
    expect(state.intervalBoundsTargetAvailable).toBe(true);
    flushSync();
    expect(emitCalls).toBe(0);
    expect(commitZoomCalls).toBe(0);
    expect(announceCalls).toBe(0);
    expect(inspectionPanelCalls).toBe(0);
    expect(candidateSemanticKeysCalls).toBe(0);
    destroy();
  });
});

describe("createIntervalState semantic Candidate consumption", () => {
  it("consumes the supplied projection without resolving Candidate keys", () => {
    const model = modelFor(continuousSpec());
    const panelId = model.scene.panels[0]?.id;
    if (panelId === undefined) throw new Error("expected panel");
    let keyCalls = 0;
    const sharedBag = [
      {
        panelId,
        xValue: 1 as const,
        yValue: 1 as const,
        keys: ["0"] as const,
      },
      {
        panelId,
        xValue: 10 as const,
        yValue: 20 as const,
        keys: ["1"] as const,
      },
    ];
    const { state, destroy } = mountIntervalController({
      model: () => model,
      selectConfig: persistentSelect,
      candidateSemanticKeys: (candidate) => {
        keyCalls++;
        return identityCandidateKeys(candidate);
      },
      consumptionCandidates: () => sharedBag,
    });

    state.finishBrushSelect(brushEvent(model, { keys: ["0", "1"] }), "pointer");
    flushSync();
    keyCalls = 0;
    const keys = state.effectiveIntervalKeys;
    expect(keys.length).toBeGreaterThan(0);
    expect(keyCalls).toBe(0);

    destroy();
  });
});

describe("createIntervalState local mode", () => {
  it("finishBrushSelect (persistent) commits record; clear empties and emits once; second clear is silent", () => {
    const model = modelFor(continuousSpec());
    const events: PlotSelection[] = [];
    const { state, destroy } = mountIntervalController({
      model: () => model,
      selectConfig: persistentSelect,
      emitSelection: (event) => {
        events.push(event);
      },
    });

    const brush = brushEvent(model);
    state.finishBrushSelect(brush, "pointer");
    flushSync();

    const panelId = model.scene.panels[0]?.id;
    expect(panelId).toBeDefined();
    expect(state.committedInterval).not.toBeNull();
    expect(state.committedInterval?.panelId).toBe(panelId);
    expect(state.effectiveIntervals).toHaveLength(1);
    expect(state.effectiveIntervals[0]?.panelId).toBe(panelId);
    expect(state.effectiveIntervals[0]?.domains.x?.kind).toBe("linear");
    // Public keys surface: literal keys from the event are stored.
    expect(state.effectiveIntervals[0]?.keys).toEqual(["0", "1"]);
    expect(state.effectiveIntervalKeys.length).toBeGreaterThan(0);
    // finishBrushSelect emits end after commit (listeners see committed state).
    expect(events).toHaveLength(1);
    expect(events[0]?.phase).toBe("end");
    expect(events[0]?.source).toBe("pointer");

    state.clearIntervalSelection("pointer");
    flushSync();
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      type: "select",
      phase: "clear",
      mode: "xy",
      panelId,
      domain: {},
      keys: [],
      lineageCount: 0,
      source: "pointer",
    });
    expect(state.committedInterval).toBeNull();
    expect(state.effectiveIntervals).toEqual([]);
    expect(state.effectiveIntervalKeys).toEqual([]);

    events.length = 0;
    state.clearIntervalSelection("pointer");
    flushSync();
    expect(events).toEqual([]);

    destroy();
  });
});

describe("createIntervalState controller mode", () => {
  it("commits through setInterval; external clear/replace drops committedInterval pixel rect", () => {
    const model = modelFor(continuousSpec());
    const panelId = model.scene.panels[0]?.id;
    if (panelId === undefined) throw new Error("expected panel");
    const controller = createPlotInteraction();
    const interactionBox = reactiveBox<MaybeController>(controller);

    const { state, destroy } = mountIntervalController({
      model: () => model,
      interaction: () => interactionBox.value,
      selectConfig: persistentSelect,
    });

    const brush = brushEvent(model, { keys: ["k0"] });
    state.finishBrushSelect(brush, "pointer");
    flushSync();
    expect(state.effectiveIntervals).toHaveLength(1);
    expect(state.committedInterval).not.toBeNull();
    expect(controller.intervals(defaultScope)).toHaveLength(1);

    // External clear on the shared controller → reconcile drops pixel rect.
    controller.clearIntervals({ scope: defaultScope, source: "programmatic" });
    flushSync();
    expect(state.effectiveIntervals).toEqual([]);
    expect(state.committedInterval).toBeNull();

    // Re-commit, then same-panel replacement with different domains clears
    // the pixel rect via sameIntervalRecord gate.
    state.finishBrushSelect(brush, "pointer");
    flushSync();
    expect(state.committedInterval).not.toBeNull();

    controller.setInterval(
      Object.freeze({
        panelId,
        preset: "independent" as const,
        domains: Object.freeze({
          x: Object.freeze({ kind: "linear" as const, domain: [1, 3] as const }),
        }),
        keys: Object.freeze(["other"]),
      }),
      { scope: defaultScope, source: "programmatic" },
    );
    flushSync();
    expect(state.committedInterval).toBeNull();
    // Record still present under the host (replacement, not clear).
    expect(state.effectiveIntervals).toHaveLength(1);
    expect(state.effectiveIntervals[0]?.domains.x).toMatchObject({
      kind: "linear",
      domain: [1, 3],
    });

    destroy();
  });

  it("module clear paths write through the controller with the right scope and panel", () => {
    const model = modelFor(facetSpec());
    const north = model.scene.panels[0];
    const south = model.scene.panels[1];
    if (north === undefined || south === undefined) {
      throw new Error("expected two facet panels");
    }
    const controller = createPlotInteraction();
    const events: PlotSelection[] = [];

    const { state, destroy } = mountIntervalController({
      model: () => model,
      interaction: () => controller,
      selectConfig: persistentSelect,
      emitSelection: (event) => {
        events.push(event);
      },
    });

    state.finishBrushSelect(
      brushEvent(model, {
        panelId: north.id,
        domain: { x: [0.5, 1.5], y: [0.5, 1.5] },
        keys: ["n"],
      }),
      "pointer",
    );
    state.finishBrushSelect(
      brushEvent(model, {
        panelId: south.id,
        domain: { x: [1.5, 2.5], y: [1.5, 2.5] },
        keys: ["s"],
      }),
      "pointer",
    );
    flushSync();
    expect(controller.intervals(defaultScope)).toHaveLength(2);

    // clearCurrentPanelInterval → interaction.clearInterval(panelId): only
    // the current (south) record leaves the shared controller.
    events.length = 0;
    state.clearCurrentPanelInterval("pointer");
    flushSync();
    expect(controller.intervals(defaultScope)).toHaveLength(1);
    expect(controller.intervals(defaultScope)[0]?.panelId).toBe(north.id);
    expect(events).toHaveLength(1);
    expect(events[0]?.panelId).toBe(south.id);

    // clearIntervalSelection → interaction.clearIntervals(scope): all gone.
    events.length = 0;
    state.clearIntervalSelection("keyboard");
    flushSync();
    expect(controller.intervals(defaultScope)).toEqual([]);
    expect(state.effectiveIntervals).toEqual([]);
    expect(events).toHaveLength(1);
    expect(events[0]?.phase).toBe("clear");

    destroy();
  });
});

describe("createIntervalState clearCurrentPanelInterval", () => {
  it("clears only the target panel's record and emits once; no-op when nothing current", () => {
    const model = modelFor(facetSpec());
    const north = model.scene.panels[0];
    const south = model.scene.panels[1];
    if (north === undefined || south === undefined) {
      throw new Error("expected two facet panels");
    }
    const events: PlotSelection[] = [];

    const { state, destroy } = mountIntervalController({
      model: () => model,
      selectConfig: persistentSelect,
      emitSelection: (event) => {
        // Write-before-emit (host order: null committed state, THEN emit) —
        // the sink must observe the already-cleared committed rect.
        if (event.phase === "clear") {
          expect(state.committedInterval).toBeNull();
        }
        events.push(event);
      },
    });

    state.finishBrushSelect(
      brushEvent(model, {
        panelId: north.id,
        domain: { x: [0.5, 1.5], y: [0.5, 1.5] },
        keys: ["north"],
      }),
      "pointer",
    );
    state.finishBrushSelect(
      brushEvent(model, {
        panelId: south.id,
        domain: { x: [1.5, 2.5], y: [1.5, 2.5] },
        keys: ["south"],
      }),
      "pointer",
    );
    flushSync();
    expect(state.effectiveIntervals).toHaveLength(2);
    // Last brush is current (committedInterval follows the latest end event).
    expect(state.committedInterval?.panelId).toBe(south.id);

    events.length = 0;
    state.clearCurrentPanelInterval("pointer");
    flushSync();
    expect(events).toHaveLength(1);
    expect(events[0]?.panelId).toBe(south.id);
    expect(events[0]?.phase).toBe("clear");
    expect(state.effectiveIntervals).toHaveLength(1);
    expect(state.effectiveIntervals[0]?.panelId).toBe(north.id);
    expect(state.committedInterval).toBeNull();

    // After south is cleared, currentIntervalRecord falls back to the first
    // remaining record (north) — a second clearCurrentPanelInterval would
    // clear it. True no-op requires nothing current AND no residual records.
    state.clearIntervalSelection("programmatic");
    flushSync();
    events.length = 0;
    state.clearCurrentPanelInterval("pointer");
    flushSync();
    expect(events).toEqual([]);
    expect(state.effectiveIntervals).toEqual([]);

    destroy();
  });
});

describe("createIntervalState interval target availability", () => {
  it("panel loss flips intervalBoundsTargetAvailable false and labels the target unavailable", () => {
    const facetModel = modelFor(facetSpec());
    const north = facetModel.scene.panels[0];
    if (north === undefined) throw new Error("expected facet panel");
    const swappedModel = modelFor(continuousSpec());
    // Precondition for the swap below: the replacement model must not reuse
    // the facet panel's id, or the lookup would still succeed.
    expect(swappedModel.scene.panels[0]?.id).not.toBe(north.id);
    const modelBox = reactiveBox<RenderModel | null>(facetModel);

    const { state, destroy } = mountIntervalController({
      model: () => modelBox.value,
      selectConfig: persistentSelect,
    });

    state.finishBrushSelect(
      brushEvent(facetModel, {
        panelId: north.id,
        domain: { x: [0.5, 1.5], y: [0.5, 1.5] },
        keys: ["north"],
      }),
      "pointer",
    );
    flushSync();
    // Record present and its panel exists → target available, facet label.
    expect(state.intervalBoundsTargetAvailable).toBe(true);
    expect(state.currentIntervalTargetLabel).toContain("North");

    // Swap to a model without that panel: the LOCAL record survives (records
    // are model-independent), but the panel lookup now fails — ToolRail must
    // see the precise-bounds target as unavailable.
    modelBox.set(swappedModel);
    flushSync();
    expect(state.effectiveIntervals).toHaveLength(1);
    expect(state.intervalBoundsTargetAvailable).toBe(false);
    expect(state.currentIntervalTargetLabel).toBe("unavailable panel");

    destroy();
  });
});

describe("createIntervalState semanticAxis (public behavior)", () => {
  it("band commit stores encoded band values; axis-less early-return still sets committedInterval", () => {
    const bandModel = modelFor(bandXSpec());
    const panelId = bandModel.scene.panels[0]?.id;
    if (panelId === undefined) throw new Error("expected panel");
    const { state, destroy } = mountIntervalController({
      model: () => bandModel,
      selectConfig: persistentSelect,
    });

    state.finishBrushSelect(
      brushEvent(bandModel, {
        domain: {
          x: ["north", "south"],
          y: [0, 20],
        },
        keys: ["0", "1"],
      }),
      "pointer",
    );
    flushSync();
    expect(state.effectiveIntervals).toHaveLength(1);
    expect(state.effectiveIntervals[0]?.domains.x).toMatchObject({
      kind: "band",
      values: [encodeKey("north"), encodeKey("south")],
    });

    // Empty/axis-less: domain with unmappable bounds → private commit early-
    // returns (no record, no throw). finishBrushSelect still writes
    // committedInterval first (host 1796 order) — pin that synchronous write
    // before the reconcile effect (which drops the pixel rect when no record
    // backs it) has a chance to run.
    state.clearIntervalSelection("programmatic");
    flushSync();
    const axisless = buildIntervalSelection({
      phase: "end",
      mode: "xy",
      panelId,
      domain: {},
      pixels: { x0: 0, y0: 0, x1: 10, y1: 10 },
      keys: [],
      lineageCount: 0,
      source: "pointer",
    });
    state.finishBrushSelect(axisless, "pointer");
    expect(state.committedInterval).not.toBeNull();
    expect(state.committedInterval?.panelId).toBe(panelId);
    expect(state.effectiveIntervals).toEqual([]);
    flushSync();
    // Reconcile effect: no semantic record → drop the pixel rect.
    expect(state.committedInterval).toBeNull();

    destroy();
  });
});

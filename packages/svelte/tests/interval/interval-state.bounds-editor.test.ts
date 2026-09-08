/**
 * createIntervalState tests — bounds editor select/zoom paths and cancel effect.
 */
import { fromPartial } from "@total-typescript/shoehorn";
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";
import { encodeKey } from "@ggts-sh/core";
import { aes, gg, scaleYMonthDay } from "@ggts-sh/spec";

import { reactiveBox } from "../helpers/reactive-box.svelte.js";
import {
  bandXSpec,
  brushEvent,
  continuousSpec,
  facetSpec,
  identityCandidateKeys,
  modelFor,
  mountIntervalController,
  nonPersistentSelect,
  persistentSelect,
  type ContinuousZoomDomains,
  type InteractionSource,
  type PlotSelection,
  type SelectConfig,
} from "./interval-state.harness.js";

describe("createIntervalState bounds editor select path", () => {
  it("threads monthDay temporalKind so drafts can omit the reference year", () => {
    // Full dates (any year) are the common monthDay input; the scale collapses
    // the year. Bare "MM-DD" needs an explicit md parser and is a different path.
    const model = modelFor(
      gg(
        [
          { year: 812, bloom: "0812-04-01" },
          { year: 2026, bloom: "2026-03-29" },
        ],
        aes({ x: "year", y: "bloom" }),
      )
        .geomPoint()
        .scales(scaleYMonthDay())
        .spec(),
    );
    const trigger = document.createElement("button");
    const { state, destroy } = mountIntervalController({
      model: () => model,
      selectConfig: persistentSelect,
    });

    state.finishBrushSelect(
      brushEvent(model, {
        domain: {
          x: [800, 2100],
          y: [Date.UTC(2000, 2, 29), Date.UTC(2000, 3, 1)],
        },
        keys: ["0", "1"],
      }),
      "pointer",
    );
    flushSync();
    state.openBoundsEditor("select", "y", trigger);
    flushSync();

    expect(state.boundsEditorInput).toMatchObject({
      scale: "time",
      temporalKind: "monthDay",
    });

    destroy();
  });

  it("band precise-bounds emit typed domain endpoints from encoded identities", () => {
    // semanticAxis stores encodeKey tokens; eventDomain must decode them back
    // to typed rawDomain values for the public IntervalSelection.domain payload.
    const bandModel = modelFor(bandXSpec());
    const events: PlotSelection[] = [];
    const trigger = document.createElement("button");
    const { state, destroy } = mountIntervalController({
      model: () => bandModel,
      selectConfig: persistentSelect,
      emitSelection: (event) => {
        events.push(event);
      },
    });

    state.finishBrushSelect(
      brushEvent(bandModel, {
        domain: { x: ["north", "south"], y: [0, 20] },
        keys: ["0", "1"],
      }),
      "pointer",
    );
    flushSync();
    expect(state.effectiveIntervals[0]?.domains.x).toMatchObject({
      kind: "band",
      values: [encodeKey("north"), encodeKey("south")],
    });

    state.openBoundsEditor("select", "x", trigger);
    flushSync();
    expect(state.boundsEditorInput?.scale).toBe("band");

    events.length = 0;
    state.applyPreciseBounds({
      source: "precise-bounds",
      inputSource: "keyboard",
      action: "select",
      axis: "x",
      reversed: false,
      scale: "band",
      bounds: ["north", "south"],
    });
    flushSync();
    expect(events).toHaveLength(1);
    const endEvent = events[0];
    expect(endEvent !== undefined && "domain" in endEvent ? endEvent.domain.x : undefined).toEqual([
      "north",
      "south",
    ]);
    // Missing / partial endpoints still project pixels from the resolved band span.
    expect(state.committedInterval).not.toBeNull();
    expect(state.committedInterval?.pixels.x1).toBeGreaterThan(
      state.committedInterval?.pixels.x0 ?? 0,
    );

    destroy();
  });

  it("applyPreciseBounds resolves keys and lineageCount with one candidate key walk", () => {
    const model = modelFor(continuousSpec());
    const trigger = document.createElement("button");
    let keyCalls = 0;
    let candidateReads = 0;
    const rawCandidates = model.candidates;
    const spyModel = fromPartial<RenderModel>({
      ...model,
      candidates: {
        get size() {
          return rawCandidates.size;
        },
        candidate(id: number) {
          candidateReads++;
          return rawCandidates.candidate(id);
        },
      },
    });
    const events: PlotSelection[] = [];
    const { state, destroy } = mountIntervalController({
      model: () => spyModel,
      selectConfig: persistentSelect,
      candidateSemanticKeys: (candidate) => {
        keyCalls++;
        return identityCandidateKeys(candidate);
      },
      emitSelection: (event) => {
        events.push(event);
      },
    });

    // Wide domain so both continuous points remain in-interval after the edit.
    state.finishBrushSelect(
      brushEvent(spyModel, {
        domain: { x: [0, 20], y: [0, 30] },
        keys: ["0", "1"],
      }),
      "pointer",
    );
    flushSync();
    state.openBoundsEditor("select", "x", trigger);
    flushSync();

    keyCalls = 0;
    candidateReads = 0;
    events.length = 0;
    state.applyPreciseBounds({
      source: "precise-bounds",
      inputSource: "keyboard",
      action: "select",
      axis: "x",
      reversed: false,
      scale: "linear",
      bounds: [0, 15],
    });
    flushSync();

    // One store pass for keys+lineage (was consumption bag + lineage scan).
    expect(candidateReads).toBe(rawCandidates.size);
    expect(keyCalls).toBeGreaterThan(0);
    expect(keyCalls).toBeLessThanOrEqual(rawCandidates.size);
    expect(events).toHaveLength(1);
    const end = events[0];
    expect(
      end !== undefined && "lineageCount" in end ? end.lineageCount : -1,
    ).toBeGreaterThanOrEqual(0);

    destroy();
  });

  it("open → input; apply updates record (persistent) and emits once; non-persistent emits without record", () => {
    const model = modelFor(continuousSpec());
    const events: PlotSelection[] = [];
    const selectBox = reactiveBox<SelectConfig>(persistentSelect());
    const trigger = document.createElement("button");

    let assertWriteBeforeEmit = true;
    const { state, destroy } = mountIntervalController({
      model: () => model,
      selectConfig: () => selectBox.value,
      emitSelection: (event) => {
        // Write-before-emit (precise-bounds end path, persistent): committed
        // interval is already updated when the sink observes the end event.
        if (assertWriteBeforeEmit && event.phase === "end") {
          expect(state.committedInterval).not.toBeNull();
        }
        events.push(event);
      },
    });

    // Seed a committed interval so the select bounds editor has a record.
    state.finishBrushSelect(brushEvent(model), "pointer");
    flushSync();

    state.openBoundsEditor("select", "x", trigger);
    flushSync();
    expect(state.boundsReturnFocus).toBe(trigger);
    expect(state.boundsEditorInput).not.toBeNull();
    expect(state.boundsEditorInput?.action).toBe("select");
    expect(state.boundsEditorInput?.axis).toBe("x");
    expect(state.boundsEditorInput?.scale).not.toBe("band");

    events.length = 0;
    const priorX = state.effectiveIntervals[0]?.domains.x;
    expect(priorX?.kind).toBe("linear");
    state.applyPreciseBounds({
      source: "precise-bounds",
      inputSource: "keyboard",
      action: "select",
      axis: "x",
      reversed: false,
      scale: "linear",
      bounds: [3, 7],
    });
    flushSync();
    expect(events).toHaveLength(1);
    const endEvent = events[0];
    expect(endEvent?.phase).toBe("end");
    // IntervalSelection is the only PlotSelection variant with `domain`.
    expect(endEvent !== undefined && "domain" in endEvent ? endEvent.domain.x : undefined).toEqual([
      3, 7,
    ]);
    expect(state.effectiveIntervals[0]?.domains.x).toMatchObject({
      kind: "linear",
      domain: [3, 7],
    });
    expect(state.boundsEditorInput).toBeNull();
    expect(state.committedInterval).not.toBeNull();

    // Non-persistent: event emitted, no durable record.
    state.clearIntervalSelection("programmatic");
    flushSync();
    events.length = 0;
    selectBox.set(nonPersistentSelect());
    flushSync();
    assertWriteBeforeEmit = false;
    state.openBoundsEditor("select", "x", trigger);
    flushSync();
    expect(state.boundsEditorInput).not.toBeNull();
    state.applyPreciseBounds({
      source: "precise-bounds",
      inputSource: "keyboard",
      action: "select",
      axis: "x",
      reversed: false,
      scale: "linear",
      bounds: [4, 6],
    });
    flushSync();
    expect(events).toHaveLength(1);
    expect(events[0]?.phase).toBe("end");
    expect(state.effectiveIntervals).toEqual([]);
    expect(state.committedInterval).toBeNull();

    destroy();
  });
});

describe("createIntervalState bounds editor zoom path", () => {
  it("open uses effectiveZoomDomains ?? scale.domain; apply calls commitZoom; band → null input", () => {
    const model = modelFor(continuousSpec());
    const zoomDomains = reactiveBox<ContinuousZoomDomains | null>({ x: [2, 8] });
    const commits: { domains: ContinuousZoomDomains | null; source: InteractionSource }[] = [];
    const trigger = document.createElement("button");

    const { state, destroy } = mountIntervalController({
      model: () => model,
      effectiveZoomDomains: () => zoomDomains.value,
      commitZoom: (domains, source) => {
        commits.push({ domains, source });
      },
    });

    state.openBoundsEditor("zoom", "x", trigger);
    flushSync();
    expect(state.boundsEditorInput).not.toBeNull();
    expect(state.boundsEditorInput?.action).toBe("zoom");
    expect(state.boundsEditorInput?.bounds).toEqual([2, 8]);

    state.applyPreciseBounds({
      source: "precise-bounds",
      inputSource: "keyboard",
      action: "zoom",
      axis: "x",
      reversed: false,
      scale: "linear",
      bounds: [3, 9],
    });
    flushSync();
    expect(commits).toHaveLength(1);
    expect(commits[0]?.domains).toEqual({ x: [3, 9] });
    expect(commits[0]?.source).toBe("keyboard");
    expect(state.boundsEditorInput).toBeNull();

    // Band scale → zoom bounds editor input is null.
    const bandModel = modelFor(bandXSpec());
    const modelBox = reactiveBox<RenderModel | null>(bandModel);
    destroy();
    const second = mountIntervalController({
      model: () => modelBox.value,
    });
    second.state.openBoundsEditor("zoom", "x", trigger);
    flushSync();
    expect(second.state.boundsEditorInput).toBeNull();
    second.destroy();
  });
});

describe("createIntervalState bounds-cancel effect", () => {
  it("closes editor and focuses captureSurface when the target panel disappears", async () => {
    const facet = modelFor(facetSpec());
    const southOnly = modelFor(
      gg([{ id: "south", facet: "South", x: 2, y: 2 }], aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({ wrap: "facet" })
        .spec(),
    );
    const modelBox = reactiveBox<RenderModel | null>(facet);
    const surface = document.createElement("div");
    surface.tabIndex = -1;
    document.body.append(surface);
    const announcements: string[] = [];
    const trigger = document.createElement("button");

    const { state, destroy } = mountIntervalController({
      model: () => modelBox.value,
      captureSurface: () => surface,
      announce: (message) => {
        announcements.push(message);
      },
    });

    const north = facet.scene.panels[0];
    if (north === undefined) throw new Error("expected north panel");
    state.finishBrushSelect(
      brushEvent(facet, {
        panelId: north.id,
        domain: { x: [0.5, 1.5], y: [0.5, 1.5] },
        keys: ["north"],
      }),
      "pointer",
    );
    flushSync();
    state.openBoundsEditor("select", "x", trigger);
    flushSync();
    expect(state.boundsEditorInput).not.toBeNull();
    expect(state.boundsReturnFocus).toBe(trigger);

    // Drop the North panel — editor target no longer available.
    modelBox.set(southOnly);
    flushSync();
    expect(state.boundsEditorInput).toBeNull();
    expect(state.boundsReturnFocus).toBeNull();

    // Cancellation announcement + focus run in a microtask.
    await Promise.resolve();
    expect(announcements.some((m) => m.includes("cancelled"))).toBe(true);
    expect(document.activeElement).toBe(surface);

    surface.remove();
    destroy();
  });
});

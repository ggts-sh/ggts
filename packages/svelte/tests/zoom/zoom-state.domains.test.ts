/**
 * createPlotZoomState domain tests — memoization, effectiveSpec, set/brush/
 * dblclick/reset-for-scales paths.
 * Factories own deriveds — instantiate under `$effect.root` and destroy.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";

import { reactiveBox } from "../helpers/reactive-box.svelte.js";
import {
  bandXSpec,
  bothBandSpec,
  continuousSpec,
  createPlotInteraction,
  flippedSpec,
  mountZoomController,
  modelFor,
  type PlotInteractionScope,
  type ZoomConfig,
  type ZoomEvent,
  xOnlyZoomConfig,
} from "./zoom-state.harness.js";

describe("createPlotZoomState stableZoomDomains memoization", () => {
  it("returns the same reference when controller revision bumps without domain change", () => {
    const controller = createPlotInteraction();
    const fullScope: PlotInteractionScope = { keys: "plot", x: "x-mm", y: "y-mm" };

    const { state, destroy } = mountZoomController({
      interaction: () => controller,
      resolvedInteractionScope: () => fullScope,
    });

    controller.setZoom({ x: [1, 5], y: [2, 6] }, { scope: fullScope, source: "programmatic" });
    flushSync();
    const first = state.effectiveZoomDomains;
    expect(first).toEqual({ x: [1, 5], y: [2, 6] });

    // Bump revision WITHOUT changing zoom domains (e.g. setEmphasis).
    controller.setEmphasis(["a"], { scope: fullScope, source: "programmatic" });
    flushSync();
    const second = state.effectiveZoomDomains;
    expect(second).toBe(first);

    destroy();
  });
});

describe("createPlotZoomState effectiveSpec", () => {
  it("null domains returns assembled by reference; domains land in scale domain", () => {
    const assembled = continuousSpec();
    const { state, destroy } = mountZoomController({
      assembled: () => assembled,
    });

    expect(state.effectiveSpec).toBe(assembled);

    state.commitZoom({ x: [3, 7] }, "programmatic");
    flushSync();
    const next = state.effectiveSpec;
    expect(next).not.toBe(assembled);
    // Independent literal — do not recompute via applyZoomToSpec in the test.
    expect(next?.scales?.x?.domain).toEqual([3, 7]);
    expect(next?.scales?.x).toMatchObject({ nice: false });

    destroy();
  });
});

describe("createPlotZoomState setZoomDomains", () => {
  it("partial x-only update preserves y; rejection with null current; pass-through with current", () => {
    const zoomEvents: ZoomEvent[] = [];
    const { state, destroy } = mountZoomController({
      onzoom: () => (event) => {
        zoomEvents.push(event);
      },
    });

    // Rejection path: invalid/empty partial with current === null → no commit.
    state.setZoomDomains({ x: [Number.NaN, 1] });
    flushSync();
    expect(state.effectiveZoomDomains).toBeNull();
    expect(zoomEvents).toEqual([]);

    state.setZoomDomains({ x: [1, 5], y: [2, 8] });
    flushSync();
    expect(state.effectiveZoomDomains).toEqual({ x: [1, 5], y: [2, 8] });
    expect(zoomEvents).toHaveLength(1);

    // Partial x-only update preserves y.
    state.setZoomDomains({ x: [3, 9] });
    flushSync();
    expect(state.effectiveZoomDomains).toEqual({ x: [3, 9], y: [2, 8] });

    // Non-null-current pass-through: sanitizePartialZoomDomains PRESERVES
    // existing domains, so an invalid partial with non-null current can still
    // return the current bag and legitimately emit.
    const before = zoomEvents.length;
    state.setZoomDomains({ x: [Number.NaN, Number.NaN] });
    flushSync();
    // Current bag returned → commit of the same domains still emits (local mode
    // always assigns, no transition-null short-circuit).
    expect(state.effectiveZoomDomains).toEqual({ x: [3, 9], y: [2, 8] });
    expect(zoomEvents.length).toBe(before + 1);

    destroy();
  });
});

describe("createPlotZoomState applyBrushZoom", () => {
  it("commits inverted continuous domains; both-band skips; mixed commits continuous only; flipped inverts axes", () => {
    const zoomEvents: ZoomEvent[] = [];
    const continuous = modelFor(continuousSpec());
    const panel = continuous.scene.panels[0];
    // Brush the middle ~60% of the panel so invert yields interior domains.
    const rect = {
      x0: panel.x + panel.width * 0.2,
      y0: panel.y + panel.height * 0.2,
      x1: panel.x + panel.width * 0.8,
      y1: panel.y + panel.height * 0.8,
    };

    const contModel = reactiveBox<RenderModel | null>(continuous);
    const flipped = reactiveBox(false);
    const { state, destroy } = mountZoomController({
      model: () => contModel.value,
      onzoom: () => (event) => {
        zoomEvents.push(event);
      },
    });

    state.applyBrushZoom(rect, "pointer");
    flushSync();
    expect(zoomEvents).toHaveLength(1);
    expect(zoomEvents[0]?.phase).toBe("end");
    expect(zoomEvents[0]?.domains?.x).toBeDefined();
    expect(zoomEvents[0]?.domains?.y).toBeDefined();
    // Domain endpoints must be interior to trained continuous domains [1,10]/[0,20].
    const dx = zoomEvents[0].domains!.x!;
    const dy = zoomEvents[0].domains!.y!;
    expect(dx[0]).toBeGreaterThan(1);
    expect(dx[1]).toBeLessThan(10);
    expect(dy[0]).toBeGreaterThan(0);
    expect(dy[1]).toBeLessThan(20);

    // Both-band scales → NO-event skip (every channel non-invertible).
    zoomEvents.length = 0;
    state.resetZoom();
    flushSync();
    zoomEvents.length = 0;
    contModel.set(modelFor(bothBandSpec()));
    flushSync();
    state.applyBrushZoom(rect, "pointer");
    flushSync();
    expect(zoomEvents).toEqual([]);
    expect(state.effectiveZoomDomains).toBeNull();

    // Mixed: one band + one continuous, mode "xy" → commits ONLY continuous.
    contModel.set(modelFor(bandXSpec()));
    flushSync();
    state.applyBrushZoom(rect, "pointer");
    flushSync();
    expect(zoomEvents).toHaveLength(1);
    expect(zoomEvents[0]?.domains?.x).toBeUndefined();
    expect(zoomEvents[0]?.domains?.y).toBeDefined();

    // coordFlipped getter: with an ASYMMETRIC rect (60% of the horizontal
    // span, 20% of the vertical span), flip swaps which data channel each
    // screen axis selects — the x data domain must come from the NARROW
    // vertical band and the y data domain from the WIDE horizontal band.
    // (Any "some domain is defined" assertion would be tautological: it
    // passes even when the flipped flag is ignored.)
    zoomEvents.length = 0;
    state.resetZoom();
    flushSync();
    zoomEvents.length = 0;
    const flippedModel = modelFor(flippedSpec());
    contModel.set(flippedModel);
    flipped.set(true);
    flushSync();
    const flippedPanel = flippedModel.scene.panels[0];
    const asymRect = {
      x0: flippedPanel.x + flippedPanel.width * 0.2,
      y0: flippedPanel.y + flippedPanel.height * 0.4,
      x1: flippedPanel.x + flippedPanel.width * 0.8,
      y1: flippedPanel.y + flippedPanel.height * 0.6,
    };
    state.applyBrushZoom(asymRect, "pointer");
    flushSync();
    expect(zoomEvents).toHaveLength(1);
    const fx = zoomEvents[0].domains!.x!;
    const fy = zoomEvents[0].domains!.y!;
    const [tx0, tx1] = flippedModel.scales.x.domain as [number, number];
    const [ty0, ty1] = flippedModel.scales.y.domain as [number, number];
    const xFraction = (fx[1] - fx[0]) / (tx1 - tx0);
    const yFraction = (fy[1] - fy[0]) / (ty1 - ty0);
    // Narrow (~0.2) x span vs wide (~0.6) y span — fails if flip is ignored
    // (the spans would then mirror the rect: ~0.6 x, ~0.2 y).
    expect(xFraction).toBeLessThan(0.35);
    expect(yFraction).toBeGreaterThan(0.45);

    destroy();
  });
});

describe("createPlotZoomState onDblClick", () => {
  it("no-ops when zoom config is null; with domains resets with source pointer", () => {
    const zoomConfig = reactiveBox<ZoomConfig>(null);
    const zoomEvents: ZoomEvent[] = [];
    const { state, destroy } = mountZoomController({
      zoomConfig: () => zoomConfig.value,
      onzoom: () => (event) => {
        zoomEvents.push(event);
      },
    });

    state.commitZoom({ x: [1, 5] }, "programmatic");
    flushSync();
    expect(state.effectiveZoomDomains).toEqual({ x: [1, 5] });

    // zoom config null → no-op (even with domains).
    zoomEvents.length = 0;
    state.onDblClick();
    flushSync();
    expect(state.effectiveZoomDomains).toEqual({ x: [1, 5] });
    expect(zoomEvents).toEqual([]);

    zoomConfig.set(Object.freeze({ mode: "xy" as const, trigger: "brush" as const }));
    flushSync();
    state.onDblClick();
    flushSync();
    expect(state.effectiveZoomDomains).toBeNull();
    expect(zoomEvents).toEqual([
      {
        type: "zoom",
        phase: "clear",
        source: "pointer",
        domains: null,
      },
    ]);

    destroy();
  });
});

describe("createPlotZoomState resetForScales", () => {
  it("silently nulls domains in both ownership modes (no zoom event, no announcement)", () => {
    const zoomEvents: ZoomEvent[] = [];
    const announcements: string[] = [];

    // Local mode.
    const local = mountZoomController({
      onzoom: () => (event) => {
        zoomEvents.push(event);
      },
      announce: (message) => {
        announcements.push(message);
      },
    });
    local.state.commitZoom({ x: [1, 5], y: [2, 8] }, "pointer");
    flushSync();
    expect(local.state.effectiveZoomDomains).not.toBeNull();
    zoomEvents.length = 0;
    announcements.length = 0;

    local.state.resetForScales();
    flushSync();
    expect(local.state.effectiveZoomDomains).toBeNull();
    expect(zoomEvents).toEqual([]);
    expect(announcements).toEqual([]);
    local.destroy();

    // Controller mode: interaction.resetZoom with mode-filtered scope, no emission.
    const controller = createPlotInteraction();
    const fullScope: PlotInteractionScope = { keys: "plot", x: "x-mm", y: "y-mm" };
    const ctrl = mountZoomController({
      interaction: () => controller,
      resolvedInteractionScope: () => fullScope,
      zoomConfig: xOnlyZoomConfig,
      onzoom: () => (event) => {
        zoomEvents.push(event);
      },
      announce: (message) => {
        announcements.push(message);
      },
    });
    controller.setZoom({ x: [1, 5], y: [10, 50] }, { scope: fullScope, source: "programmatic" });
    flushSync();
    expect(ctrl.state.effectiveZoomDomains).toEqual({ x: [1, 5] });
    zoomEvents.length = 0;
    announcements.length = 0;

    ctrl.state.resetForScales();
    flushSync();
    // x-only filtered scope: x cleared, shared y preserved.
    expect(controller.zoom(fullScope)).toEqual({ y: [10, 50] });
    expect(ctrl.state.effectiveZoomDomains).toBeNull();
    expect(zoomEvents).toEqual([]);
    expect(announcements).toEqual([]);
    ctrl.destroy();
  });
});

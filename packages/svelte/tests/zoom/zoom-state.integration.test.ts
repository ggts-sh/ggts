/**
 * createPlotZoomState integration tests — runtime + zoom real cycle, and
 * callback replacement after flush.
 * Factories own deriveds — instantiate under `$effect.root` and destroy.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import { createPlotRuntime } from "../../src/lib/runtime/runtime.svelte.js";
import "../../src/lib/host-init.js";
import { withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { testInteractionContext } from "../helpers/interaction-context.js";
import { reactiveBox } from "../helpers/reactive-box.svelte.js";
import { createReactiveRuntimeDeps } from "../helpers/runtime-deps.svelte.js";
import {
  continuousSpec,
  createPlotZoomState,
  defaultScope,
  mountZoomController,
  noController,
  noInteractionCallback,
  type InteractionCb,
  type PortableSpec,
  type ZoomCb,
  type ZoomEvent,
  xyZoomConfig,
} from "./zoom-state.harness.js";

describe("runtime + zoom real cycle", () => {
  it("commit zoom retrains model with explicit domains; resetForScales via runtime clears them", () => {
    const initialSpec = continuousSpec();
    const zoomEvents: ZoomEvent[] = [];

    const { value, destroy } = withFlushedEffectRoot(() => {
      // Host wiring: zoom factory BEFORE createPlotRuntime; runtime deps
      // wired to controller aliases.
      const assembledBox = reactiveBox<PortableSpec | null>(initialSpec);
      const zoom = createPlotZoomState(
        testInteractionContext({
          interaction: noController,
          resolvedInteractionScope: () => defaultScope,
          model: () => runtime.model,
          onzoom: () => (event) => {
            zoomEvents.push(event);
          },
          oninteraction: noInteractionCallback,
          announce: () => {},
        }),
        {
          zoomConfig: xyZoomConfig,
          assembled: () => assembledBox.value,
        },
      );
      // Host aliases (construction-order DAG).
      const effectiveZoomDomains = () => zoom.effectiveZoomDomains;
      const effectiveSpec = () => zoom.effectiveSpec;
      const runtimeDeps = createReactiveRuntimeDeps({
        assembled: initialSpec,
        effectiveSpec: initialSpec,
      });
      // Override getters to read controller aliases (production shape).
      const runtime = createPlotRuntime({
        widthProp: runtimeDeps.widthProp,
        heightProp: runtimeDeps.heightProp,
        assembled: () => assembledBox.value,
        effectiveSpec,
        effectiveZoomDomains,
        effectiveLegendFilters: () => [],
        root: runtimeDeps.root,
        resetZoom: () => {
          zoom.resetForScales();
        },
        onrender: runtimeDeps.onrender,
      });
      return { runtime, zoom };
    });

    const { runtime, zoom } = value;
    expect(runtime.model).not.toBeNull();
    const trainedX = [...(runtime.model!.scales.x.domain as [number, number])];

    // Commit zoom → model retrains with the committed explicit domains
    // (applyZoomToSpec does not clamp).
    zoom.commitZoom({ x: [3, 7], y: [5, 15] }, "pointer");
    flushSync();
    expect(zoom.effectiveZoomDomains).toEqual({ x: [3, 7], y: [5, 15] });
    expect(runtime.model).not.toBeNull();
    // Explicit domains land on the trained scales (not clamped to data).
    expect(runtime.model!.scales.x.domain).toEqual([3, 7]);
    expect(runtime.model!.scales.y.domain).toEqual([5, 15]);
    expect(runtime.model!.scales.x.domain).not.toEqual(trainedX);
    expect(zoomEvents).toHaveLength(1);

    // resetForScales via runtime.resetScales() path clears them.
    runtime.resetScales();
    flushSync();
    expect(zoom.effectiveZoomDomains).toBeNull();
    // Model retrains from the un-zoomed assembled spec.
    expect(runtime.model!.scales.x.domain).toEqual(trainedX);
    // Silent: no additional zoom event from resetForScales.
    expect(zoomEvents).toHaveLength(1);

    destroy();
  });
});

describe("createPlotZoomState callback replacement", () => {
  it("replaces onzoom AND oninteraction post-flush; each new callback receives the event", () => {
    const firstZoom: ZoomEvent[] = [];
    const firstInteraction: ZoomEvent[] = [];
    const secondZoom: ZoomEvent[] = [];
    const secondInteraction: ZoomEvent[] = [];
    const zoomBox = reactiveBox<ZoomCb>((event) => {
      firstZoom.push(event);
    });
    const interactionBox = reactiveBox<InteractionCb>((event) => {
      firstInteraction.push(event as ZoomEvent);
    });

    const { state, destroy } = mountZoomController({
      onzoom: () => zoomBox.value,
      oninteraction: () => interactionBox.value,
    });

    state.commitZoom({ x: [1, 5] }, "pointer");
    flushSync();
    expect(firstZoom).toHaveLength(1);
    expect(firstInteraction).toHaveLength(1);

    zoomBox.set((event) => {
      secondZoom.push(event);
    });
    interactionBox.set((event) => {
      secondInteraction.push(event as ZoomEvent);
    });

    state.commitZoom({ x: [2, 8] }, "pointer");
    flushSync();
    expect(secondZoom).toHaveLength(1);
    expect(secondInteraction).toHaveLength(1);
    expect(secondZoom[0]).toEqual({
      type: "zoom",
      phase: "end",
      source: "pointer",
      domains: { x: [2, 8] },
    });
    expect(secondInteraction[0]).toEqual(secondZoom[0]);
    // Old callbacks must not receive the second event.
    expect(firstZoom).toHaveLength(1);
    expect(firstInteraction).toHaveLength(1);

    destroy();
  });
});

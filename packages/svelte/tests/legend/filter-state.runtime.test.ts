/**
 * Legend-filter controller ↔ plot-runtime integration: toggling a filter
 * retrains the model through the runtime's rowFilters.
 * Factories own effects — instantiate under `$effect.root` and destroy.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import { createLegendFilterState } from "../../src/lib/legend/filter-state.svelte.js";
import { createPlotRuntime, type PlotRuntime } from "../../src/lib/runtime/runtime.svelte.js";
import "../../src/lib/host-init.js";
import { withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { createReactiveRuntimeDeps } from "../helpers/runtime-deps.svelte.js";

import { clickEvent, colorSpec, noCallback } from "./filter-state-fixtures.js";

describe("runtime + legend-filter real cycle", () => {
  it("toggling a filter retrains the model via rowFilters", () => {
    const spec = colorSpec();

    const { value, destroy } = withFlushedEffectRoot(() => {
      const runtimeDeps = createReactiveRuntimeDeps({
        assembled: spec,
        effectiveSpec: spec,
      });
      // Host wiring: the controller is constructed BEFORE the runtime and
      // reads the model through a getter closure over the later-declared
      // runtime (never invoked during construction), so the catalog effect
      // always sees the freshly retrained model — no manual re-sync.
      let runtimeRef: PlotRuntime | null = null;
      let controller!: ReturnType<typeof createLegendFilterState>;
      controller = createLegendFilterState({
        effectiveSpec: () => spec,
        legendFilterProp: () => true,
        onlegendfilter: noCallback,
        oninteraction: noCallback,
        announce: () => {},
        model: () => runtimeRef?.model ?? null,
        catalogEntries: () => controller.computeEntries(runtimeRef?.model ?? null),
      });
      const runtime = createPlotRuntime({
        ...runtimeDeps,
        effectiveLegendFilters: () => controller.filters,
      });
      runtimeRef = runtime;
      return { runtime, controller };
    });

    const { runtime, controller } = value;
    expect(runtime.model).not.toBeNull();
    expect(runtime.model!.candidates.size).toBe(2);

    const north = controller
      .computeEntries(runtime.model)
      .find((entry) => entry.entry.value === "north")!;
    controller.toggle(north, clickEvent());
    flushSync();

    expect(controller.filters).toHaveLength(1);
    expect(runtime.model).not.toBeNull();
    expect(runtime.model!.candidates.size).toBe(1);

    destroy();
  });
});

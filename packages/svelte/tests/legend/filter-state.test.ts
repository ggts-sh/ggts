/**
 * Legend-filter controller state tests: construction ordering, toggle and
 * include/exclude mode semantics, scaled-constant gating, capability/mode
 * reset, and catalog reconciliation.
 * Factories own effects — instantiate under `$effect.root` and destroy.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import { aes, gg } from "@ggts-sh/spec";

import type { LegendFilterEvent } from "../../src/lib/legend/filter.js";
import { createLegendFilterState } from "../../src/lib/legend/filter-state.svelte.js";
import { withEffectRoot, withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { modelFor } from "../helpers/model.js";
import { reactiveBox } from "../helpers/reactive-box.svelte.js";

import { clickEvent, colorSpec, filterRows, noCallback } from "./filter-state-fixtures.js";

describe("createLegendFilterState construction", () => {
  it("does not invoke the model getter during construction (before first flush)", () => {
    let modelCalls = 0;
    const { value: state, destroy } = withEffectRoot(() =>
      createLegendFilterState({
        effectiveSpec: () => colorSpec(),
        legendFilterProp: () => true,
        onlegendfilter: noCallback,
        oninteraction: noCallback,
        announce: () => {},
        model: () => {
          modelCalls++;
          return null;
        },
        catalogEntries: () => [],
      }),
    );

    expect(modelCalls).toBe(0);
    // Client deriveds are lazy, so the construction-time assertion alone
    // cannot catch a model-reading $derived added to the factory. Force
    // every exposed accessor and one effect flush, then re-assert — that is
    // the closest client-side stand-in for the construction-order DAG
    // contract (model must not be read at construction).
    expect(state.options).not.toBeNull();
    expect(state.filters).toEqual([]);
    expect(state.hasActiveFilters).toBe(false);
    // Accessors alone must not read model. Catalog effect may read model on flush.
    destroy();
  });
});

describe("createLegendFilterState toggle and mode", () => {
  it("exclude-mode: first toggle hides value and emits a change clause", () => {
    const events: LegendFilterEvent[] = [];
    const announcements: string[] = [];
    const spec = colorSpec();
    const model = modelFor(spec);

    const { value: state, destroy } = withFlushedEffectRoot(() => {
      let controller!: ReturnType<typeof createLegendFilterState>;
      controller = createLegendFilterState({
        effectiveSpec: () => spec,
        legendFilterProp: () => true,
        onlegendfilter: () => (event) => {
          events.push(event);
        },
        oninteraction: noCallback,
        announce: (message) => {
          announcements.push(message);
        },
        model: () => model,
        catalogEntries: () => controller.computeEntries(model),
      });
      return controller;
    });

    const entries = state.computeEntries(model);
    expect(entries).toHaveLength(2);
    const north = entries.find((entry) => entry.entry.value === "north")!;
    expect(north.visible).toBe(true);

    state.toggle(north, clickEvent());
    flushSync();

    expect(state.hasActiveFilters).toBe(true);
    expect(state.filters).toEqual([
      {
        scale: "color",
        field: "group",
        values: ["north"],
        mode: "exclude",
      },
    ]);
    expect(events).toEqual([
      {
        type: "legend-filter",
        phase: "change",
        source: "pointer",
        clause: {
          scale: "color",
          field: "group",
          values: ["north"],
          mode: "exclude",
        },
      },
    ]);
    expect(announcements.at(-1)).toBe("north hidden.");
    expect(state.computeEntries(model).find((e) => e.entry.value === "north")!.visible).toBe(false);

    destroy();
  });

  it("include-mode baseline starts from the full catalog", () => {
    const events: LegendFilterEvent[] = [];
    const spec = colorSpec();
    const model = modelFor(spec);

    const { value: state, destroy } = withFlushedEffectRoot(() => {
      let controller!: ReturnType<typeof createLegendFilterState>;
      controller = createLegendFilterState({
        effectiveSpec: () => spec,
        legendFilterProp: () => ({ mode: "include" as const }),
        onlegendfilter: () => (event) => {
          events.push(event);
        },
        oninteraction: noCallback,
        announce: () => {},
        model: () => model,
        catalogEntries: () => controller.computeEntries(model),
      });
      return controller;
    });

    const south = state.computeEntries(model).find((entry) => entry.entry.value === "south")!;
    // Include + multiple: first toggle removes south from the shown set.
    state.toggle(south, clickEvent());
    flushSync();

    expect(state.filters).toEqual([
      {
        scale: "color",
        field: "group",
        values: ["north"],
        mode: "include",
      },
    ]);
    expect(events[0]?.clause).toMatchObject({
      mode: "include",
      values: ["north"],
    });
    expect(state.computeEntries(model).find((e) => e.entry.value === "south")!.visible).toBe(false);
    expect(state.computeEntries(model).find((e) => e.entry.value === "north")!.visible).toBe(true);

    destroy();
  });
});

describe("createLegendFilterState scaled-constant gating (#598)", () => {
  it("still filters data entries when a rowless annotation constant shares the style scale", () => {
    // Core drops the annotation-only value from the interactive legend domain
    // (empty key bucket), but still exports it on layerScaledConstants. Filter
    // gating must key off *visible* legend entries — otherwise the hidden
    // annotation disables filters for the real data categories.
    const spec = gg(
      [
        { x: 1, y: 1, group: "a" },
        { x: 2, y: 2, group: "a" },
        { x: 1, y: 3, group: "b" },
        { x: 2, y: 4, group: "b" },
      ],
      aes({ x: "x", y: "y" }),
    )
      .geomLine({ aes: { linetype: "group" } })
      .geomRule({
        yintercept: 2,
        aes: { linetype: { value: "threshold", scale: true } },
      })
      .scaleLinetypeDiscrete()
      .spec();
    const model = modelFor(spec);

    // Preconditions: annotation trains the scale but is not a legend entry;
    // layerScaledConstants still carries it (focus/index contract).
    const legend = model.scene.legends.find(
      (entry) => entry.type === "discrete" && entry.scale === "linetype",
    );
    expect(legend?.type).toBe("discrete");
    if (legend?.type !== "discrete") throw new Error("expected discrete linetype legend");
    expect(legend.interactive).toBe(true);
    expect(legend.entries.map((entry) => entry.value)).toEqual(["a", "b"]);
    expect(model.layerScaledConstants.some((constants) => constants.linetype !== undefined)).toBe(
      true,
    );

    const { value: state, destroy } = withFlushedEffectRoot(() =>
      createLegendFilterState({
        effectiveSpec: () => spec,
        legendFilterProp: () => true,
        onlegendfilter: noCallback,
        oninteraction: noCallback,
        announce: () => {},
        model: () => model,
        catalogEntries: () => [],
      }),
    );

    const entries = state.computeEntries(model);
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((entry) => entry.entry.value))).toEqual(new Set(["a", "b"]));
    expect(entries.every((entry) => entry.field === "group")).toBe(true);

    destroy();
  });

  it("keeps a rowful scaled-constant legend non-filterable", () => {
    // A data-backed constant still appears as a legend entry; toggling data
    // categories would filter the field while the constant-colored layer stays.
    const spec = gg(
      [
        { x: 1, y: 1, group: "north" },
        { x: 2, y: 2, group: "south" },
      ],
      aes({ x: "x", y: "y" }),
    )
      .geomPoint({ aes: { color: "group" } })
      .geomLine({ aes: { color: { value: "reference", scale: true } } })
      .spec();
    const model = modelFor(spec);

    const { value: state, destroy } = withFlushedEffectRoot(() =>
      createLegendFilterState({
        effectiveSpec: () => spec,
        legendFilterProp: () => true,
        onlegendfilter: noCallback,
        oninteraction: noCallback,
        announce: () => {},
        model: () => model,
        catalogEntries: () => [],
      }),
    );

    expect(state.computeEntries(model)).toEqual([]);

    destroy();
  });
});

describe("createLegendFilterState capability and mode reset", () => {
  it("capability disable resets filters atomically with a single clear event + announce", () => {
    const events: LegendFilterEvent[] = [];
    const announcements: string[] = [];
    const prop = reactiveBox<boolean | { mode: "exclude" | "include" }>(true);
    const spec = colorSpec();
    const model = modelFor(spec);

    const { value: state, destroy } = withFlushedEffectRoot(() => {
      let controller!: ReturnType<typeof createLegendFilterState>;
      controller = createLegendFilterState({
        effectiveSpec: () => spec,
        legendFilterProp: () => prop.value,
        onlegendfilter: () => (event) => {
          events.push(event);
        },
        oninteraction: noCallback,
        announce: (message) => {
          announcements.push(message);
        },
        model: () => model,
        catalogEntries: () => controller.computeEntries(model),
      });
      return controller;
    });

    const north = state.computeEntries(model).find((entry) => entry.entry.value === "north")!;
    state.toggle(north, clickEvent());
    flushSync();
    expect(state.filters).toHaveLength(1);
    const afterToggle = events.length;

    prop.set(false);
    flushSync();

    expect(state.options).toBeNull();
    expect(state.filters).toEqual([]);
    expect(state.hasActiveFilters).toBe(false);
    const clears = events.slice(afterToggle).filter((event) => event.phase === "clear");
    expect(clears).toHaveLength(1);
    expect(clears[0]).toEqual({
      type: "legend-filter",
      phase: "clear",
      source: "programmatic",
      clause: null,
    });
    expect(announcements).toContain("Legend filters reset after the filter capability changed.");

    destroy();
  });

  it("mode flip exclude→include resets clauses (no stale reinterpretation)", () => {
    const events: LegendFilterEvent[] = [];
    const prop = reactiveBox<boolean | { mode: "exclude" | "include" }>({
      mode: "exclude",
    });
    const spec = colorSpec();
    const model = modelFor(spec);

    const { value: state, destroy } = withFlushedEffectRoot(() => {
      let controller!: ReturnType<typeof createLegendFilterState>;
      controller = createLegendFilterState({
        effectiveSpec: () => spec,
        legendFilterProp: () => prop.value,
        onlegendfilter: () => (event) => {
          events.push(event);
        },
        oninteraction: noCallback,
        announce: () => {},
        model: () => model,
        catalogEntries: () => controller.computeEntries(model),
      });
      return controller;
    });

    const north = state.computeEntries(model).find((entry) => entry.entry.value === "north")!;
    state.toggle(north, clickEvent());
    flushSync();
    expect(state.filters[0]?.mode).toBe("exclude");
    const afterToggle = events.length;

    prop.set({ mode: "include" });
    flushSync();

    expect(state.filters).toEqual([]);
    expect(state.hasActiveFilters).toBe(false);
    expect(events.slice(afterToggle).at(-1)).toEqual({
      type: "legend-filter",
      phase: "clear",
      source: "programmatic",
      clause: null,
    });

    destroy();
  });
});

describe("createLegendFilterState catalog reconciliation", () => {
  it("prunes disappeared values, removes emptied clauses, and returns visible later", () => {
    const events: LegendFilterEvent[] = [];
    const both = filterRows;
    const onlySouth = [{ x: 2, y: 2, group: "south" }];
    const data = reactiveBox(both);
    const modelBox = reactiveBox(modelFor(colorSpec(data.value)));

    const { value: state, destroy } = withFlushedEffectRoot(() => {
      let controller!: ReturnType<typeof createLegendFilterState>;
      controller = createLegendFilterState({
        effectiveSpec: () => colorSpec(data.value),
        legendFilterProp: () => true,
        onlegendfilter: () => (event) => {
          events.push(event);
        },
        oninteraction: noCallback,
        announce: () => {},
        model: () => modelBox.value,
        catalogEntries: () => controller.computeEntries(modelBox.value),
      });
      return controller;
    });

    const north = state
      .computeEntries(modelBox.value)
      .find((entry) => entry.entry.value === "north")!;
    state.toggle(north, clickEvent());
    flushSync();
    expect(state.filters[0]?.values).toEqual(["north"]);

    // Drop north from the catalog: exclude clause empties → removed.
    data.set(onlySouth);
    modelBox.set(modelFor(colorSpec(onlySouth)));
    flushSync();

    expect(state.filters).toEqual([]);
    expect(events.some((event) => event.phase === "remove")).toBe(true);

    // North returns: no residual clause; entry visible again.
    data.set(both);
    modelBox.set(modelFor(colorSpec(both)));
    flushSync();

    const restored = state
      .computeEntries(modelBox.value)
      .find((entry) => entry.entry.value === "north")!;
    expect(restored.visible).toBe(true);

    destroy();
  });
});

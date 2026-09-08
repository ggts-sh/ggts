import "../setup-register-all.js";
/**
 * Spec for the legend entry-key-index service (S16).
 *
 * Pins the S13 access contract: reactive legendEntryKeyIndex getter +
 * keysForLegend re-resolve when either dep channel (model, keyAt) changes.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import { type RenderModel } from "@ggts-sh/core";

import { createLegendEntryKeyIndex } from "../../src/lib/legend/entry-key-index.svelte.js";
import { withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { buildPointModel } from "../helpers/point-model.js";
import { reactiveBox } from "../helpers/reactive-box.svelte.js";

describe("createLegendEntryKeyIndex", () => {
  it("returns the index Map for a discrete legend, keysForLegend resolves entries, both re-resolve on model change, and null model is empty", () => {
    // ACCESS CONTRACT (S13-pinned): legendEntryKeyIndex is a reactive getter
    // (not a plain property snapshot). Mutating the model dep must refresh BOTH
    // the getter and keysForLegend — a snapped Map would leave both paths stale.
    const dataA = [
      { id: "a", x: 1, y: 10 },
      { id: "b", x: 2, y: 20 },
    ];
    const dataB = [
      { id: "c", x: 3, y: 30 },
      { id: "d", x: 4, y: 40 },
    ];
    // Stub per-row keys in a REACTIVE box: keyAt is its own dependency
    // channel of the derived — it can change while the model object does not
    // (e.g. the datumKey prop toggles without a pipeline rerun).
    const keysBox = reactiveBox<(PropertyKey | null)[]>(["a", "b"]);
    const modelBox = reactiveBox<RenderModel | null>(buildPointModel(dataA));

    const { value: service, destroy } = withFlushedEffectRoot(() =>
      createLegendEntryKeyIndex({
        model: () => modelBox.value,
        keyAt: (i) => keysBox.value[i] ?? null,
      }),
    );

    const action = {
      identity: { scale: "color", entryIndex: 0 },
      entry: { value: "a", label: "a" },
      source: "keyboard" as const,
    };

    // (a) Discrete color legend → non-empty index Map via getter.
    const indexBefore = service.legendEntryKeyIndex;
    expect(indexBefore.size).toBeGreaterThan(0);
    // (b) keysForLegend resolves entry identity → key arrays.
    const keysBefore = service.keysForLegend(action);
    expect(keysBefore).toEqual(["a"]);
    // Snapshot identity of the Map itself — a plain property would pin this.
    const mapRefBefore = indexBefore;

    // (c) keyAt-ONLY change (model held constant) re-resolves both paths —
    // the regression a lockstep stub cannot catch: a refactor that snapshots
    // keys at construction or hoists the keyAt read out of the derived.
    keysBox.set(["a2", "b2"]);
    flushSync();
    expect(service.keysForLegend(action)).toEqual(["a2"]);
    expect(service.legendEntryKeyIndex).not.toBe(mapRefBefore);
    const mapRefAfterKeys = service.legendEntryKeyIndex;

    // (c2) Model dep change re-resolves BOTH access paths.
    const previous = modelBox.value;
    keysBox.set(["c", "d"]);
    modelBox.set(buildPointModel(dataB));
    flushSync();

    const indexAfter = service.legendEntryKeyIndex;
    const keysAfter = service.keysForLegend(action);
    expect(indexAfter).not.toBe(mapRefAfterKeys);
    // Keys for entry 0 follow the new model categories (c, not a).
    expect(keysAfter).toEqual(["c"]);

    previous?.dispose();
    modelBox.value?.dispose();

    // (d) empty/null model → empty index, empty keys.
    modelBox.set(null);
    flushSync();
    expect(service.legendEntryKeyIndex.size).toBe(0);
    expect(service.keysForLegend(action)).toEqual([]);

    destroy();
  });
});

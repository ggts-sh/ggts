/**
 * Legend-focus integration tests: host registration-order cycle with the real
 * plot runtime, plus GGPlot markup rewire.
 * Factories own effects — instantiate under `$effect.root` and destroy.
 *
 * `render` is imported only here: it registers a global `beforeEach(cleanup)`
 * that must not attach to the pure factory harness suites.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";

import GGPlot from "../../src/lib/GGPlot.svelte";
import type { LegendFocusEvent } from "../../src/lib/interaction/interaction.js";
import { createLegendEntryKeyIndex } from "../../src/lib/legend/entry-key-index.svelte.js";
import { createLegendFocusState } from "../../src/lib/legend/focus-state.svelte.js";
import type { InteractiveLegendEntry, LegendEntryIdentity } from "../../src/lib/legend/focus.js";
import { createPlotRuntime } from "../../src/lib/runtime/runtime.svelte.js";
import { createSourceIdentityTracker } from "../../src/lib/runtime/semantic-source-identity.js";
import { createSemanticKeyService } from "../../src/lib/runtime/semantic-keys.svelte.js";
import { withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { createReactiveRuntimeDeps } from "../helpers/runtime-deps.svelte.js";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";
import {
  clickEvent,
  colorSpec,
  defaultScope,
  focusRows,
  noCallback,
  noController,
} from "./focus-state.harness.js";

describe("runtime + legend-focus real cycle", () => {
  it("commit changes emphasis; data drop delivers retrained model + single programmatic clear", () => {
    const events: LegendFocusEvent[] = [];
    const renders: RenderModel[] = [];
    const both = focusRows;
    const onlySouth = [focusRows[1]];
    const initialSpec = colorSpec(both);
    const tracker = createSourceIdentityTracker();

    const { value, destroy } = withFlushedEffectRoot(() => {
      const runtimeDeps = createReactiveRuntimeDeps({
        assembled: initialSpec,
        effectiveSpec: initialSpec,
      });
      // Host wiring: focus controller after enablement cluster; entries and
      // pressed via getters over the later-declared runtime (never at
      // construction).
      let entriesRef: () => readonly InteractiveLegendEntry[] = () => [];
      let pressedRef: () => LegendEntryIdentity | null = () => null;
      let entryKeysRef: ReturnType<typeof createLegendEntryKeyIndex> | null = null;
      const focus = createLegendFocusState({
        interaction: noController,
        resolvedInteractionScope: () => defaultScope,
        legendFocusEnabled: () => true,
        legendFocusPreviewEnabled: () => true,
        root: () => null,
        entryKeys: () => entryKeysRef!,
        entries: () => entriesRef(),
        pressed: () => pressedRef(),
        onlegendfocus: () => (event) => {
          events.push(event);
        },
        oninteraction: noCallback,
        announce: () => {},
      });
      focus.installHostDerivedEffects();
      const runtime = createPlotRuntime({
        ...runtimeDeps,
        effectiveLegendFilters: () => [],
      });
      const semanticKeys = createSemanticKeyService({
        model: () => runtime.model,
        assembled: () => runtimeDeps.assembled(),
        datumKey: () => "id",
        data: () => both,
        spec: () => null,
        sourceIdentity: (v) => tracker.sourceIdentity(v),
        deliverDiagnostic: () => {},
      });
      entryKeysRef = createLegendEntryKeyIndex({
        model: () => runtime.model,
        keyAt: (i) => semanticKeys.keyAt(i),
      });
      entriesRef = () => focus.computeInteractiveEntries(runtime.model);
      pressedRef = () => focus.computeLegendPressed(runtime.model);
      // Host registration order: model -> catalog(S2) -> reconcile(S3) -> late.
      runtimeDeps.setOnrender((model) => {
        renders.push(model);
      });
      return { runtime, focus, runtimeDeps };
    });

    const { runtime, focus, runtimeDeps } = value;
    expect(runtime.model).not.toBeNull();

    const northIndex = focus
      .computeInteractiveEntries(runtime.model)
      .findIndex((entry) => entry.entry.value === "north");
    focus.onLegendClick(clickEvent(), northIndex);
    flushSync();
    expect(focus.effectiveEmphasisKeys).toEqual(["a", "c"]);
    const afterCommitEvents = events.length;
    const afterCommitRenders = renders.length;

    const nextSpec = colorSpec(onlySouth);
    runtimeDeps.setAssembled(nextSpec);
    runtimeDeps.setEffectiveSpec(nextSpec);
    flushSync();

    expect(runtime.model).not.toBeNull();
    expect(runtime.model!.candidates.size).toBe(1);
    expect(renders.length).toBeGreaterThan(afterCommitRenders);
    expect(renders.at(-1)?.candidates.size).toBe(1);
    expect(focus.effectiveEmphasisKeys).toEqual([]);
    const clears = events.slice(afterCommitEvents).filter((event) => event.phase === "clear");
    expect(clears).toHaveLength(1);
    expect(clears[0]).toEqual({
      type: "legend-focus",
      phase: "clear",
      source: "programmatic",
    });

    destroy();
  });
});

describe("GGPlot legend keyboard cycle (markup rewire)", () => {
  it("focus → arrow → Enter → clear control works end-to-end", async () => {
    const events: LegendFocusEvent[] = [];
    const view = render(GGPlot, {
      data: focusRows,
      aes: { x: "x", y: "y", color: "group" },
      layers: [{ geom: "point" as const }],
      key: "id",
      legendFocus: true,
      width: 360,
      height: 260,
      onlegendfocus: (event: LegendFocusEvent) => {
        events.push(event);
      },
    });
    await until(() => view.container.querySelectorAll(".gg-legend-target").length === 2);
    const targets = [...view.container.querySelectorAll<HTMLButtonElement>(".gg-legend-target")];
    const [north, south] = targets as [HTMLButtonElement, HTMLButtonElement];

    north.focus();
    await until(() =>
      events.some((event) => event.phase === "change" && event.state === "transient"),
    );
    north.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await until(() => document.activeElement === south);

    south.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await until(() =>
      events.some((event) => event.phase === "change" && event.state === "committed"),
    );
    expect(south.getAttribute("aria-pressed")).toBe("true");
    expect(view.container.querySelector(".gg-legend-clear")).not.toBeNull();

    const clear = view.container.querySelector<HTMLButtonElement>(".gg-legend-clear")!;
    clear.click();
    await until(() => events.some((event) => event.phase === "clear"));
    expect(south.getAttribute("aria-pressed")).toBe("false");
    expect(view.container.querySelector(".gg-legend-clear")).toBeNull();
  });
});

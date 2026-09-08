/**
 * Point-selection controller tests (S8 extraction).
 * Factories own deriveds — instantiate under `$effect.root` and destroy.
 */
import { flushSync } from "svelte";
import { describe, expect, it } from "vitest";

import type { CellValue } from "@ggts-sh/core";

import type {
  PlotInteractionEvent,
  PlotInteractionScope,
  PlotSelection,
  ResolvedInteractionConfig,
} from "../../src/lib/interaction/interaction.js";
import { createPlotInteraction } from "../../src/lib/interaction/controller.svelte.js";
import { buildPointSelectionEvent } from "../../src/lib/selection/selection.js";
import { createSelectionState } from "../../src/lib/selection/selection-state.svelte.js";
import { withEffectRoot, withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { testInteractionContext } from "../helpers/interaction-context.js";
import { reactiveBox } from "../helpers/reactive-box.svelte.js";

type SelectConfig = ResolvedInteractionConfig["select"];
type MaybeController = ReturnType<typeof createPlotInteraction> | undefined;
type SelectCb = ((event: PlotSelection) => void) | undefined;
type InteractionCb = ((event: PlotInteractionEvent<Record<string, CellValue>>) => void) | undefined;

/** Getters that supply no callback (chart-local mode). */
const noSelectCb = (): SelectCb => undefined;
const noInteractionCb = (): InteractionCb => undefined;

const defaultScope: PlotInteractionScope = {
  keys: "plot",
  x: "x",
  y: "y",
  intervals: "plot",
};

const noController = (): MaybeController => undefined;

const pointSelectSingle = (): SelectConfig =>
  Object.freeze({
    type: "point" as const,
    mode: "xy" as const,
    multiple: false,
    persistent: true,
    preset: "independent" as const,
  });

const pointSelectMultiple = (): SelectConfig =>
  Object.freeze({
    type: "point" as const,
    mode: "xy" as const,
    multiple: true,
    persistent: true,
    preset: "independent" as const,
  });

type SelectionHarness = {
  state: ReturnType<typeof createSelectionState>;
  destroy: () => void;
};

function mountSelectionController(
  options: {
    interaction?: () => MaybeController;
    resolvedInteractionScope?: () => PlotInteractionScope;
    selectConfig?: () => SelectConfig;
    onselect?: () => SelectCb;
    oninteraction?: () => InteractionCb;
    announce?: (message: string) => void;
  } = {},
): SelectionHarness {
  const { value: state, destroy } = withFlushedEffectRoot(() =>
    createSelectionState(
      testInteractionContext({
        interaction: options.interaction ?? noController,
        resolvedInteractionScope: options.resolvedInteractionScope ?? (() => defaultScope),
        selectConfig: options.selectConfig ?? pointSelectSingle,
        onselect: options.onselect ?? noSelectCb,
        oninteraction: options.oninteraction ?? noInteractionCb,
        announce: options.announce ?? (() => {}),
      }),
    ),
  );
  return { state, destroy };
}

describe("createSelectionState construction", () => {
  it("does not invoke callback getters during construction", () => {
    let onselectCalls = 0;
    let oninteractionCalls = 0;
    let announceCalls = 0;

    const { value: state, destroy } = withEffectRoot(() =>
      createSelectionState(
        testInteractionContext({
          interaction: noController,
          resolvedInteractionScope: () => defaultScope,
          selectConfig: pointSelectSingle,
          onselect: (): SelectCb => {
            onselectCalls++;
            return noSelectCb();
          },
          oninteraction: (): InteractionCb => {
            oninteractionCalls++;
            return noInteractionCb();
          },
          announce: () => {
            announceCalls++;
          },
        }),
      ),
    );

    expect(state.effectiveSelectedKeys).toEqual([]);
    flushSync();
    expect(onselectCalls).toBe(0);
    expect(oninteractionCalls).toBe(0);
    expect(announceCalls).toBe(0);
    destroy();
  });
});

describe("createSelectionState local mode", () => {
  it("togglePointKeys single replaces; multiple unions; commit dedupes; clear empty is silent", () => {
    const multipleBox = reactiveBox(false);
    const events: PlotSelection[] = [];
    const log: string[] = [];
    const { state, destroy } = mountSelectionController({
      selectConfig: () => (multipleBox.value ? pointSelectMultiple() : pointSelectSingle()),
      onselect: () => (event) => {
        log.push("onselect");
        events.push(event);
      },
      oninteraction: () => () => {
        log.push("oninteraction");
      },
      announce: () => {
        log.push("announce");
      },
    });

    state.togglePointKeys(["a", "a"], "pointer");
    flushSync();
    expect(state.effectiveSelectedKeys).toEqual(["a"]);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(buildPointSelectionEvent(["a"], "pointer"));

    // Single mode: replace
    state.togglePointKeys(["b"], "pointer");
    flushSync();
    expect(state.effectiveSelectedKeys).toEqual(["b"]);

    // Multiple mode: union
    multipleBox.set(true);
    flushSync();
    state.togglePointKeys(["c"], "pointer");
    flushSync();
    expect(state.effectiveSelectedKeys).toEqual(["b", "c"]);

    // Toggle off one key in multiple mode
    state.togglePointKeys(["b"], "pointer");
    flushSync();
    expect(state.effectiveSelectedKeys).toEqual(["c"]);

    // Clear with selection emits one point clear event
    const beforeClear = events.length;
    log.length = 0;
    state.clearPointSelection("keyboard");
    flushSync();
    expect(state.effectiveSelectedKeys).toEqual([]);
    expect(events).toHaveLength(beforeClear + 1);
    expect(events.at(-1)).toEqual(buildPointSelectionEvent([], "keyboard"));
    // Emission order: announce → onselect → oninteraction
    expect(log).toEqual(["announce", "onselect", "oninteraction"]);

    // Clear with empty selection → early return silent
    const afterEmpty = events.length;
    log.length = 0;
    state.clearPointSelection("keyboard");
    flushSync();
    expect(events).toHaveLength(afterEmpty);
    expect(log).toEqual([]);

    destroy();
  });
});

describe("createSelectionState controller mode", () => {
  it("commit canonicalizes unsorted duplicate keys; no-transition is silent", () => {
    const controller = createPlotInteraction();
    const events: PlotSelection[] = [];
    const { state, destroy } = mountSelectionController({
      interaction: () => controller,
      onselect: () => (event) => {
        events.push(event);
      },
    });

    // Unsorted duplicates — setSelection canonicalizes (dedupe + sort).
    state.togglePointKeys(["c", "a", "b", "a"], "pointer");
    flushSync();
    const canonical = controller.selected(defaultScope);
    expect(canonical).toEqual(["a", "b", "c"]);
    expect(state.effectiveSelectedKeys).toEqual(canonical);
    expect(events).toHaveLength(1);
    expect(events[0]?.keys).toEqual(canonical);

    // Same selection (no-transition) → NO emit
    // Toggle all selected off then on with same multiset via clear+set:
    // re-toggling currently selected keys removes them (toggle algebra).
    // Drive via a second mount path: setSelection same keys returns null.
    const before = events.length;
    controller.setSelection(["a", "b", "c"], {
      scope: defaultScope,
      source: "pointer",
    });
    // Force re-read of effectiveSelectedKeys
    flushSync();
    expect(state.effectiveSelectedKeys).toEqual(["a", "b", "c"]);
    // togglePointKeys with keys already all-selected removes them — instead
    // use emit path through setSelection null transition by re-setting same:
    // the public API only reaches commit via toggle/clear. clear then re-toggle
    // always changes. Pin no-emit via second identical setSelection on the
    // controller and assert controller returns null + state does not re-emit
    // when we only touch the controller (state reads revision).
    const transition = controller.setSelection(["c", "b", "a"], {
      scope: defaultScope,
      source: "pointer",
    });
    expect(transition).toBeNull();
    flushSync();
    expect(events).toHaveLength(before);

    // Clear then re-commit same multiset through toggle (single mode replaces)
    state.clearPointSelection("pointer");
    flushSync();
    expect(events.at(-1)?.keys).toEqual([]);
    state.togglePointKeys(["b", "a", "b"], "pointer");
    flushSync();
    // Single mode: nextPointSelectionKeys returns [...toggled] then commit
    // Set-dedupes to insertion order ["b","a"] in local, but controller
    // canonicalizes to sorted ["a","b"].
    expect(state.effectiveSelectedKeys).toEqual(["a", "b"]);
    expect(events.at(-1)?.keys).toEqual(["a", "b"]);

    destroy();
  });

  it("controller no-transition through public toggle after clear is a real emit only on change", () => {
    const controller = createPlotInteraction();
    const events: PlotSelection[] = [];
    const { state, destroy } = mountSelectionController({
      interaction: () => controller,
      selectConfig: pointSelectMultiple,
      onselect: () => (event) => {
        events.push(event);
      },
    });

    state.togglePointKeys(["a"], "pointer");
    flushSync();
    expect(events).toHaveLength(1);

    // Toggle a again → removes a → emit
    state.togglePointKeys(["a"], "pointer");
    flushSync();
    expect(events).toHaveLength(2);
    expect(events[1]?.keys).toEqual([]);

    // Toggle empty keys → silent (toggle early return)
    state.togglePointKeys([], "pointer");
    flushSync();
    expect(events).toHaveLength(2);

    destroy();
  });
});

describe("createSelectionState callback replacement", () => {
  it("swaps onselect + oninteraction boxes post-flush", () => {
    const onselectBox = reactiveBox<SelectCb>(noSelectCb());
    const oninteractionBox = reactiveBox<InteractionCb>(noInteractionCb());
    const log: string[] = [];

    const { state, destroy } = mountSelectionController({
      onselect: () => onselectBox.value,
      oninteraction: () => oninteractionBox.value,
      announce: () => {
        log.push("announce");
      },
    });

    onselectBox.set(() => {
      log.push("select-a");
    });
    oninteractionBox.set(() => {
      log.push("interaction-a");
    });
    flushSync();
    state.togglePointKeys(["a"], "pointer");
    flushSync();
    expect(log).toEqual(["announce", "select-a", "interaction-a"]);

    log.length = 0;
    onselectBox.set(() => {
      log.push("select-b");
    });
    oninteractionBox.set(() => {
      log.push("interaction-b");
    });
    flushSync();
    state.togglePointKeys(["b"], "pointer");
    flushSync();
    expect(log).toEqual(["announce", "select-b", "interaction-b"]);

    destroy();
  });
});

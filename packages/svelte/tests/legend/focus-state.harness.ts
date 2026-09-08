/**
 * Shared harness for createLegendFocusState composite tests.
 * Factories own effects — instantiate under `$effect.root` and destroy.
 *
 * Do not import component `render` here: that module registers a global
 * `beforeEach(cleanup)` and would attach component-test lifecycle to pure
 * factory suites that only need the state mount.
 */
import type { RenderModel } from "@ggts-sh/core";
import { aes, gg, type PortableSpec } from "@ggts-sh/spec";

import type {
  LegendFocusEvent,
  PlotInteractionScope,
} from "../../src/lib/interaction/interaction.js";
import { createPlotInteraction } from "../../src/lib/interaction/controller.svelte.js";
import { createLegendEntryKeyIndex } from "../../src/lib/legend/entry-key-index.svelte.js";
import { createLegendFocusState } from "../../src/lib/legend/focus-state.svelte.js";
import type { InteractiveLegendEntry, LegendEntryIdentity } from "../../src/lib/legend/focus.js";
import { createSourceIdentityTracker } from "../../src/lib/runtime/semantic-source-identity.js";
import { createSemanticKeyService } from "../../src/lib/runtime/semantic-keys.svelte.js";
import { withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { modelFor } from "../helpers/model.js";

export const focusRows = [
  { id: "a", x: 1, y: 1, group: "north" },
  { id: "b", x: 2, y: 2, group: "south" },
  { id: "c", x: 3, y: 3, group: "north" },
];

export type FocusRow = (typeof focusRows)[number];

export type FocusCb = ((event: LegendFocusEvent) => void) | undefined;
export const noCallback = (): FocusCb => undefined;

export type MaybeController = ReturnType<typeof createPlotInteraction<PropertyKey>> | undefined;
/** Getter that supplies no interaction controller (chart-local mode). */
export const noController = (): MaybeController => undefined;

export const defaultScope: PlotInteractionScope = { keys: "plot" };

export function colorSpec(
  data: readonly { id: string; x: number; y: number; group: string }[] = focusRows,
): PortableSpec {
  return gg([...data], aes({ x: "x", y: "y", color: "group" }))
    .geomPoint()
    .spec();
}

export function clickEvent(detail = 1): MouseEvent {
  return new MouseEvent("click", { bubbles: true, detail });
}

export function keyEvent(key: string): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, bubbles: true });
}

export type FocusHarness = {
  state: ReturnType<typeof createLegendFocusState>;
  model: () => RenderModel;
  destroy: () => void;
};

/**
 * Mount the controller with production-shaped deps: every reactive dep is a
 * getter (mirroring LegendFocusStateDeps). Tests that need reactivity pass
 * getters over their own reactive boxes; omitted options get static defaults.
 */
export function mountFocusController(
  options: {
    model?: () => RenderModel;
    data?: () => readonly FocusRow[];
    interaction?: () => MaybeController;
    legendFocusEnabled?: () => boolean;
    onlegendfocus?: () => FocusCb;
    oninteraction?: () => FocusCb;
    announce?: (message: string) => void;
    root?: HTMLDivElement | null;
  } = {},
): FocusHarness {
  const defaultModel = modelFor(colorSpec());
  const model = options.model ?? (() => defaultModel);
  const data = options.data ?? ((): readonly FocusRow[] => focusRows);
  const tracker = createSourceIdentityTracker();

  const { value: state, destroy } = withFlushedEffectRoot(() => {
    const semanticKeys = createSemanticKeyService({
      model,
      assembled: () => colorSpec(data()),
      datumKey: () => "id",
      data,
      spec: () => null,
      sourceIdentity: (v) => tracker.sourceIdentity(v),
      deliverDiagnostic: () => {},
    });
    const entryKeys = createLegendEntryKeyIndex({
      model,
      keyAt: (i) => semanticKeys.keyAt(i),
    });
    let entriesRef: () => readonly InteractiveLegendEntry[] = () => [];
    let pressedRef: () => LegendEntryIdentity | null = () => null;
    const controller = createLegendFocusState({
      interaction: options.interaction ?? noController,
      resolvedInteractionScope: () => defaultScope,
      legendFocusEnabled: options.legendFocusEnabled ?? (() => true),
      legendFocusPreviewEnabled: () => true,
      root: () => options.root ?? null,
      entryKeys: () => entryKeys,
      entries: () => entriesRef(),
      pressed: () => pressedRef(),
      onlegendfocus: options.onlegendfocus ?? noCallback,
      oninteraction: options.oninteraction ?? noCallback,
      announce: options.announce ?? (() => {}),
    });
    // Deferred refs mirror the host's later-declared deriveds.
    entriesRef = () => controller.computeInteractiveEntries(model());
    pressedRef = () => controller.computeLegendPressed(model());
    controller.installHostDerivedEffects();
    return controller;
  });

  return { state, model, destroy };
}

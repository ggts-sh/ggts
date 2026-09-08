/**
 * Shared harness for createPlotZoomState composite tests.
 * Factories own deriveds — instantiate under `$effect.root` and destroy.
 *
 * Do not import component `render` here: that module registers a global
 * `beforeEach(cleanup)` and would attach component-test lifecycle to pure
 * factory suites that only need the state mount.
 */
import type { RenderModel } from "@ggts-sh/core";
import { aes, gg, type PortableSpec } from "@ggts-sh/spec";

import type {
  PlotInteractionEvent,
  PlotInteractionScope,
  ResolvedInteractionConfig,
  ZoomEvent,
} from "../../src/lib/interaction/interaction.js";
import { createPlotInteraction } from "../../src/lib/interaction/controller.svelte.js";
import { createPlotZoomState } from "../../src/lib/zoom/zoom-state.svelte.js";
import { withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { testInteractionContext } from "../helpers/interaction-context.js";
import { modelFor } from "../helpers/model.js";

const zoomRows = [
  { id: "a", x: 1, y: 1 },
  { id: "b", x: 10, y: 20 },
];

export type ZoomCb = ((event: ZoomEvent) => void) | undefined;
export const noZoomCallback = (): ZoomCb => undefined;

export type InteractionCb = ((event: PlotInteractionEvent) => void) | undefined;
export const noInteractionCallback = (): InteractionCb => undefined;

export type MaybeController = ReturnType<typeof createPlotInteraction> | undefined;
/** Getter that supplies no interaction controller (chart-local mode). */
export const noController = (): MaybeController => undefined;

export const defaultScope: PlotInteractionScope = {
  keys: "plot",
  x: "x",
  y: "y",
};

export type ZoomConfig = ResolvedInteractionConfig["zoom"];
export const xyZoomConfig = (): ZoomConfig =>
  Object.freeze({ mode: "xy" as const, trigger: "brush" as const });
export const xOnlyZoomConfig = (): ZoomConfig =>
  Object.freeze({ mode: "x" as const, trigger: "brush" as const });

export function continuousSpec(
  data: readonly { id: string; x: number; y: number }[] = zoomRows,
): PortableSpec {
  return gg([...data], aes({ x: "x", y: "y" }))
    .geomPoint()
    .spec();
}

export function bandXSpec(): PortableSpec {
  return gg(
    [
      { id: "a", x: "north", y: 1 },
      { id: "b", x: "south", y: 20 },
    ],
    aes({ x: "x", y: "y" }),
  )
    .geomPoint()
    .spec();
}

export function bothBandSpec(): PortableSpec {
  return gg(
    [
      { id: "a", x: "north", y: "low" },
      { id: "b", x: "south", y: "high" },
    ],
    aes({ x: "x", y: "y" }),
  )
    .geomPoint()
    .spec();
}

export function flippedSpec(): PortableSpec {
  return gg([...zoomRows], aes({ x: "x", y: "y" }))
    .geomPoint()
    .coord("flip")
    .spec();
}

export type ZoomHarness = {
  state: ReturnType<typeof createPlotZoomState>;
  destroy: () => void;
};

/**
 * Mount the controller with production-shaped deps: every reactive dep is a
 * getter (context + options split). Tests that need reactivity pass
 * getters over their own reactive boxes; omitted options get static defaults.
 */
export function mountZoomController(
  options: {
    interaction?: () => MaybeController;
    resolvedInteractionScope?: () => PlotInteractionScope;
    zoomConfig?: () => ZoomConfig;
    assembled?: () => PortableSpec | null;
    model?: () => RenderModel | null;
    onzoom?: () => ZoomCb;
    oninteraction?: () => InteractionCb;
    announce?: (message: string) => void;
  } = {},
): ZoomHarness {
  const defaultAssembled = continuousSpec();
  const defaultModel = modelFor(defaultAssembled);

  const { value: state, destroy } = withFlushedEffectRoot(() =>
    createPlotZoomState(
      testInteractionContext({
        interaction: options.interaction ?? noController,
        resolvedInteractionScope: options.resolvedInteractionScope ?? (() => defaultScope),
        model: options.model ?? (() => defaultModel),
        onzoom: options.onzoom ?? noZoomCallback,
        oninteraction: options.oninteraction ?? noInteractionCallback,
        announce: options.announce ?? (() => {}),
      }),
      {
        zoomConfig: options.zoomConfig ?? xyZoomConfig,
        assembled: options.assembled ?? (() => defaultAssembled),
      },
    ),
  );

  return { state, destroy };
}

export { createPlotInteraction, createPlotZoomState, modelFor };
export type { ContinuousZoomDomains } from "../../src/lib/scene/geometry.js";
export type { PortableSpec } from "@ggts-sh/spec";
export type { PlotInteractionScope, ZoomEvent };

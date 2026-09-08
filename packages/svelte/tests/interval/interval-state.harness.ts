/**
 * Shared harness for createIntervalState composite tests.
 * Factories own deriveds + effects — instantiate under `$effect.root` and destroy.
 */
import type { CandidateFacts, RenderModel } from "@ggts-sh/core";
import { aes, gg, type PortableSpec } from "@ggts-sh/spec";

import type {
  InteractionSource,
  IntervalSelection,
  PlotInteractionScope,
  PlotSelection,
  ResolvedInteractionConfig,
} from "../../src/lib/interaction/interaction.js";
import { createPlotInteraction } from "../../src/lib/interaction/controller.svelte.js";
import {
  createIntervalState,
  type IntervalStateOptions,
} from "../../src/lib/interval/interval-state.svelte.js";
import type { ContinuousZoomDomains } from "../../src/lib/scene/geometry.js";
import { buildIntervalSelection } from "../../src/lib/interval/interval.js";
import { withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { identityCandidateKeys, testInteractionContext } from "../helpers/interaction-context.js";
import { modelFor } from "../helpers/model.js";

const continuousRows = [
  { id: "a", x: 1, y: 1 },
  { id: "b", x: 10, y: 20 },
];

export type SelectConfig = ResolvedInteractionConfig["select"];
export type MaybeController = ReturnType<typeof createPlotInteraction> | undefined;

export const defaultScope: PlotInteractionScope = {
  keys: "plot",
  x: "x",
  y: "y",
  intervals: "plot",
};

export const noController = (): MaybeController => undefined;

export const persistentSelect = (): SelectConfig =>
  Object.freeze({
    type: "interval" as const,
    mode: "xy" as const,
    multiple: false,
    persistent: true,
    preset: "independent" as const,
  });

export const nonPersistentSelect = (): SelectConfig =>
  Object.freeze({
    type: "interval" as const,
    mode: "xy" as const,
    multiple: false,
    persistent: false,
    preset: "independent" as const,
  });

export function continuousSpec(
  data: readonly { id: string; x: number; y: number }[] = continuousRows,
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

export function facetSpec(): PortableSpec {
  return gg(
    [
      { id: "north", facet: "North", x: 1, y: 1 },
      { id: "south", facet: "South", x: 2, y: 2 },
    ],
    aes({ x: "x", y: "y" }),
  )
    .geomPoint()
    .facet({ wrap: "facet" })
    .spec();
}

/** Identity semantic keys — re-exported from the shared context helper. */
export { identityCandidateKeys } from "../helpers/interaction-context.js";

export function brushEvent(
  model: RenderModel,
  overrides: Partial<{
    phase: IntervalSelection["phase"];
    mode: IntervalSelection["mode"];
    panelId: string | null;
    domain: IntervalSelection["domain"];
    keys: readonly PropertyKey[];
    source: InteractionSource;
  }> = {},
): IntervalSelection {
  const panel = model.scene.panels[0];
  if (panel === undefined) throw new Error("expected at least one panel");
  const panelId = overrides.panelId === undefined ? panel.id : overrides.panelId;
  return buildIntervalSelection({
    phase: overrides.phase ?? "end",
    mode: overrides.mode ?? "xy",
    panelId,
    domain: overrides.domain ?? {
      x: [2, 8],
      y: [4, 16],
    },
    pixels: {
      x0: panel.x + panel.width * 0.2,
      y0: panel.y + panel.height * 0.2,
      x1: panel.x + panel.width * 0.8,
      y1: panel.y + panel.height * 0.8,
    },
    keys: overrides.keys ?? ["0", "1"],
    lineageCount: overrides.keys?.length ?? 2,
    source: overrides.source ?? "pointer",
  });
}

export type IntervalHarness = {
  state: ReturnType<typeof createIntervalState>;
  destroy: () => void;
};

/**
 * Mount the controller with production-shaped deps: every reactive dep is a
 * getter (context + options split). Tests that need reactivity pass
 * getters over their own reactive boxes; omitted options get static defaults.
 */
export function mountIntervalController(
  options: {
    model?: () => RenderModel | null;
    interaction?: () => MaybeController;
    resolvedInteractionScope?: () => PlotInteractionScope;
    selectConfig?: () => SelectConfig;
    effectiveZoomDomains?: () => ContinuousZoomDomains | null;
    commitZoom?: IntervalStateOptions["commitZoom"];
    captureSurface?: () => HTMLDivElement | null;
    candidateSemanticKeys?: (candidate: CandidateFacts) => PropertyKey[];
    consumptionCandidates?: IntervalStateOptions["consumptionCandidates"];
    inspectionPanel?: () => Readonly<{ id: string }> | null;
    emitSelection?: (event: PlotSelection) => void;
    announce?: (message: string) => void;
  } = {},
): IntervalHarness {
  const defaultModel = modelFor(continuousSpec());

  const { value: state, destroy } = withFlushedEffectRoot(() =>
    createIntervalState(
      testInteractionContext({
        model: options.model ?? (() => defaultModel),
        interaction: options.interaction ?? noController,
        resolvedInteractionScope: options.resolvedInteractionScope ?? (() => defaultScope),
        selectConfig: options.selectConfig ?? persistentSelect,
        captureSurface: options.captureSurface ?? (() => null),
        candidateSemanticKeys: options.candidateSemanticKeys ?? identityCandidateKeys,
        announce: options.announce ?? (() => {}),
      }),
      {
        effectiveZoomDomains: options.effectiveZoomDomains ?? (() => null),
        commitZoom: options.commitZoom ?? (() => {}),
        consumptionCandidates:
          options.consumptionCandidates ??
          (() => {
            const currentModel = options.model?.() ?? defaultModel;
            const candidates = [];
            for (let id = 0; id < currentModel.candidates.size; id++) {
              const candidate = currentModel.candidates.candidate(id);
              if (candidate === null) continue;
              candidates.push({
                panelId: candidate.panelId,
                xValue: candidate.xValue,
                yValue: candidate.yValue,
                keys: identityCandidateKeys(candidate),
              });
            }
            return candidates;
          }),
        inspectionPanel: options.inspectionPanel ?? (() => null),
        emitSelection: options.emitSelection ?? (() => {}),
      },
    ),
  );

  return { state, destroy };
}

export { createIntervalState, createPlotInteraction, modelFor, buildIntervalSelection };
export type { ContinuousZoomDomains };
export type { InteractionSource, IntervalSelection, PlotInteractionScope, PlotSelection };

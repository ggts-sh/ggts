/**
 * Shared InteractionContext builder for controller factory harnesses.
 *
 * One context now carries what used to be re-typed into every controller's
 * deps bag; harnesses pass only the getters their suite makes reactive and
 * take static defaults for the rest. Per-controller ports (reducer, sibling
 * getters, commitZoom, …) stay in each factory's options.
 */
import type { CandidateFacts } from "@ggts-sh/core";

import type { InteractionContext } from "../../src/lib/interaction/interaction-context.svelte.js";
import type { PlotInteractionScope } from "../../src/lib/interaction/interaction.js";

const defaultTestScope: PlotInteractionScope = {
  keys: "plot",
  x: "x",
  y: "y",
};

/** Getter that supplies no controller / no handler (chart-local mode). */
const noHandler = (): undefined => {
  /* test default */
};

/** Identity semantic keys — enough for local consumption without a host service. */
export function identityCandidateKeys(candidate: CandidateFacts): PropertyKey[] {
  if (candidate.rowIndex === null) return [];
  return [String(candidate.rowIndex)];
}

/** No-op announce sink. */
const silentAnnounce = (): void => {
  /* test default */
};

/**
 * Static-default context; overrides win. Defaults are inert (null model, no
 * controller, no handlers) so a suite must opt into every reactive input it
 * depends on.
 */
export function testInteractionContext(
  overrides: Partial<InteractionContext> = {},
): InteractionContext {
  return {
    model: () => null,
    root: () => null,
    captureSurface: () => null,
    interaction: noHandler,
    resolvedInteractionScope: () => defaultTestScope,
    selectConfig: () => null,
    inspectConfig: () => null,
    tooltipHovered: () => false,
    announce: silentAnnounce,
    oninteraction: noHandler,
    oninspect: noHandler,
    onselect: noHandler,
    onzoom: noHandler,
    ontoolchange: noHandler,
    keyAt: () => null,
    semanticKey: () => null,
    candidateSemanticKeys: identityCandidateKeys,
    ...overrides,
  };
}

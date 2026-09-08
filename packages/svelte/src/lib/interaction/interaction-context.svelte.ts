/**
 * Shared interaction context — the single dep bag threaded through every
 * interaction controller factory (zoom, selection, interval, surface,
 * inspection).
 *
 * Before this module each factory declared its own 6–19-field deps type and
 * plot-engine hand-wired ~60 fields, most of them the same model / config /
 * handler / DOM getters re-typed per controller. One context replaces the
 * shared bag; per-factory `options` now hold only what is genuinely
 * controller-specific (sibling ports, host-derived enablement, narrow config
 * slices).
 *
 * Every field is a deferred getter or stable sink: factories must not read
 * reactive values at construction beyond what their own docs allow. The
 * assembly (interaction-states.svelte.ts) owns construction order.
 */
import type { CellValue, RenderModel } from "@ggts-sh/core";
import type { CandidateFacts } from "@ggts-sh/core";

import type { PlotInteractionController } from "./controller.svelte.js";
import type {
  InteractionTool,
  PlotInspection,
  PlotInteractionEvent,
  PlotInteractionScope,
  PlotSelection,
  ResolvedInteractionConfig,
  ZoomEvent,
} from "./interaction.js";

/** Shared dep bag for all interaction controller factories. */
export type InteractionContext = {
  /** Trained render model; null pre-model (SSR / first effect). */
  readonly model: () => RenderModel | null;
  /** Component DOM handles. */
  readonly root: () => HTMLDivElement | null;
  readonly captureSurface: () => HTMLDivElement | null;
  /** External linked controller, when the plot is controller-driven. */
  readonly interaction: () => PlotInteractionController | undefined;
  readonly resolvedInteractionScope: () => PlotInteractionScope;
  /** Narrow config slices over the resolved interaction config. */
  readonly selectConfig: () => ResolvedInteractionConfig["select"];
  readonly inspectConfig: () => ResolvedInteractionConfig["inspect"];
  /** Component-held tooltip hover flag (markup handlers write via engine). */
  readonly tooltipHovered: () => boolean;
  /** Stable announcer sink. */
  readonly announce: (message: string) => void;
  /** Deferred handler getters (handler-only; never construction-time reads). */
  readonly oninteraction: () =>
    | ((event: PlotInteractionEvent<Record<string, CellValue>>) => void)
    | undefined;
  readonly oninspect: () =>
    | ((event: PlotInspection<Record<string, CellValue>>) => void)
    | undefined;
  readonly onselect: () => ((event: PlotSelection) => void) | undefined;
  readonly onzoom: () => ((event: ZoomEvent) => void) | undefined;
  readonly ontoolchange: () => ((tool: InteractionTool) => void) | undefined;
  /** Durable row identity service (semantic keys). */
  readonly keyAt: (index: number) => PropertyKey | null;
  readonly semanticKey: (
    row: Record<string, CellValue> | null,
    index: number | null,
  ) => PropertyKey | null;
  readonly candidateSemanticKeys: (candidate: CandidateFacts) => PropertyKey[];
};

/**
 * Fields the host must supply to build an InteractionContext. Identical in
 * shape to the context itself — resolveInteractionContext exists so the host
 * has one explicit seam to widen later (defaults, SSR hatches) without
 * touching five factories again.
 */
export type InteractionContextDeps = InteractionContext;

/** Build the shared interaction context from host-supplied getters. */
export function resolveInteractionContext(deps: InteractionContextDeps): InteractionContext {
  return { ...deps };
}

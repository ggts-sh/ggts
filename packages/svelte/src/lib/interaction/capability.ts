import {
  INTERACTION_DIAGNOSTIC_CATALOG,
  type InteractionDiagnostic,
  type InteractionTool,
} from "./interaction.js";

export type ZoomAreaMode = "x" | "y" | "xy";

/**
 * Drop zoom-area when no continuous channel supports brush zoom.
 * Other tools pass through unchanged.
 */
export function filterAvailableTools(
  tools: readonly InteractionTool[],
  zoomHasSupportedChannel: boolean,
): InteractionTool[] {
  return tools.filter((tool) => tool !== "zoom-area" || zoomHasSupportedChannel);
}

/**
 * Filter configured tools using live zoom mode + model scales.
 * When zoom or scales are not yet available, zoom-area is kept (same as
 * chrome's pre-model construction path). Shared by plot-engine surface
 * enablement and chrome-state so the two cannot drift (#1082).
 */
export function resolveFilteredAvailableTools(
  tools: readonly InteractionTool[],
  zoom: { readonly mode: ZoomAreaMode } | null,
  scales: ScaleTypeRef | null,
): InteractionTool[] {
  const zoomHasSupportedChannel =
    zoom === null || scales === null || zoomSupportsChannel(zoom.mode, scales);
  return filterAvailableTools(tools, zoomHasSupportedChannel);
}

/** True when select config publishes point selection. */
export function canPublishPointSelection(
  select: { readonly type: string } | null | undefined,
): boolean {
  return select?.type === "point";
}

/**
 * Resolve the tool the host should sync into the reducer.
 * Priority: requested if available → first available → `"inspect"`.
 *
 * Note: empty `available` still yields `"inspect"` (even when inspect is not
 * listed). That matches the host `$effect` and intentionally diverges from
 * `resolveChooseToolAction`, which rejects unavailable tools.
 */
export function resolveEffectiveTool(
  requested: InteractionTool,
  available: readonly InteractionTool[],
): InteractionTool {
  if (available.includes(requested)) return requested;
  return available[0] ?? "inspect";
}

export type ChooseToolAction =
  | { readonly type: "ignore" }
  | { readonly type: "request" }
  | { readonly type: "apply" };

export { shouldShowToolRail } from "@ggts-sh/core/interaction";

/** True when every batch has zero rows (including an empty batches list). */
export function isEmptyPlotScene(
  batches: readonly { readonly rowIndex: { readonly length: number } }[],
): boolean {
  return batches.every((batch) => batch.rowIndex.length === 0);
}

export type InertSelectionOverlayInput = {
  /**
   * Host chart-local `interactive` (tools or legend focus).
   * Inert overlay is only for non-interactive emphasis/selection paint.
   */
  readonly interactive: boolean;
  readonly selectedAnchorCount: number;
  readonly emphasizedAnchorCount: number;
};

/**
 * Whether to paint the non-interactive selection/emphasis overlay.
 * Host also must not be in surface-interactive mode; SceneOverlays
 * enforces that with `{:else if}` so both never mount together.
 */
export function shouldShowInertSelectionOverlay(input: InertSelectionOverlayInput): boolean {
  return !input.interactive && (input.selectedAnchorCount > 0 || input.emphasizedAnchorCount > 0);
}

/**
 * Pure routing for host `chooseTool`.
 *
 * Priority:
 *   1. ignore — `next` not in `available` (wins over controlled; no callback)
 *   2. request — controlled prop (`tool !== undefined`): callback only
 *   3. apply — local: dispatch + clear draft/queue + callback
 */
export function resolveChooseToolAction(input: {
  readonly next: InteractionTool;
  readonly available: readonly InteractionTool[];
  readonly isControlled: boolean;
}): ChooseToolAction {
  if (!input.available.includes(input.next)) return { type: "ignore" };
  if (input.isControlled) return { type: "request" };
  return { type: "apply" };
}

export type ScaleTypeRef = {
  readonly x: { readonly type: string };
  readonly y: { readonly type: string };
};

/** True when at least one channel requested by mode is non-band. */
export function zoomSupportsChannel(mode: ZoomAreaMode, scales: ScaleTypeRef): boolean {
  return (mode !== "y" && scales.x.type !== "band") || (mode !== "x" && scales.y.type !== "band");
}

/** Band channels that block zoom under the given mode. */
export function bandChannelsForZoom(mode: ZoomAreaMode, scales: ScaleTypeRef): Array<"x" | "y"> {
  const channels: Array<"x" | "y"> = [];
  if (mode !== "y" && scales.x.type === "band") channels.push("x");
  if (mode !== "x" && scales.y.type === "band") channels.push("y");
  return channels;
}

/**
 * Zoom-only band-scale diagnostics (not interval-select).
 * `catalogEntry` is spread into each diagnostic with prop/actual filled.
 */
export function zoomScaleDiagnosticsFromChannels(
  channels: readonly ("x" | "y")[],
  catalogEntry: Omit<InteractionDiagnostic, "prop" | "actual"> &
    Partial<Pick<InteractionDiagnostic, "prop" | "actual">>,
): InteractionDiagnostic[] {
  return channels.map((channel) => ({
    ...catalogEntry,
    prop: `scales.${channel}`,
    actual: "band",
  }));
}

export type CapabilityStatusInput = {
  readonly facetUnavailableMessage?: string;
  readonly areaDiagnostics: readonly InteractionDiagnostic[];
  readonly zoomSupported: boolean;
  readonly interactive: boolean;
  readonly emptyPlot: boolean;
  /** Null when no render model (preserves host `model !== null` guard). */
  readonly candidateCount: number | null;
};

/**
 * User-facing capability status under the plot.
 * Order: facet unavailable → zoom limited/unavailable → no inspectable marks → null.
 */
export function capabilityStatusText(input: CapabilityStatusInput): string | null {
  if (input.facetUnavailableMessage !== undefined)
    return `Area interaction unavailable: ${input.facetUnavailableMessage}`;
  if (input.areaDiagnostics.length > 0)
    return `Zoom ${input.zoomSupported ? "limited" : "unavailable"}: ${input.areaDiagnostics[0]!.message}`;
  if (
    input.interactive &&
    !input.emptyPlot &&
    input.candidateCount !== null &&
    input.candidateCount === 0
  )
    return "No inspectable marks";
  return null;
}

/** Legend type surface for discrete-only advisory (host maps scene legends). */
export type LegendTypeRef = {
  readonly type: string;
};

/**
 * When legend focus is enabled and the scene has legends but none are discrete,
 * return the INTERACTION_LEGEND_DISCRETE_ONLY advisory with `actual` legend types.
 * Empty when disabled, no legends, or any discrete legend is present.
 * Contract is "not discrete" (ramps, unknown types, etc.), not ramp-only.
 */
export function legendFocusDiscreteOnlyDiagnostics(
  legendFocusEnabled: boolean,
  legends: readonly LegendTypeRef[],
): InteractionDiagnostic[] {
  if (!legendFocusEnabled || legends.length === 0) return [];
  if (legends.some((legend) => legend.type === "discrete")) return [];
  return [
    {
      ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_LEGEND_DISCRETE_ONLY,
      actual: legends.map((legend) => legend.type),
    },
  ];
}

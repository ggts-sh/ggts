import type { InteractionTool } from "./interaction-types.js";
/**
 * Normalize public interaction capability inputs into a resolved config with
 * diagnostics. Types live in ./interaction.ts; this module is pure logic only.
 */
import type {
  InteractionConfigInput,
  LegendFocusInput,
  ResolvedInteractionConfig,
  SelectInput,
  ZoomInput,
} from "./interaction-options.js";
import {
  INTERACTION_DIAGNOSTIC_CATALOG,
  type InteractionDiagnostic,
} from "./interaction-diagnostics.js";

type ResolvedInspect<Row, Key, Content> = ResolvedInteractionConfig<Row, Key, Content>["inspect"];
type ResolvedSelect = ResolvedInteractionConfig["select"];

function resolveInspect<Row, Key, Content>(
  input: InteractionConfigInput<Row, Key, Content>["inspect"],
  diagnostics: InteractionDiagnostic[],
): ResolvedInspect<Row, Key, Content> {
  if (input === undefined || input === false) return null;
  const value = input === true ? {} : input;
  const maxDistance = value.maxDistance ?? 24;
  if (!Number.isFinite(maxDistance) || maxDistance < 0) {
    diagnostics.push({
      ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_INVALID_MAX_DISTANCE,
      actual: maxDistance,
    });
    return null;
  }
  return Object.freeze({
    mode: value.mode ?? "auto",
    pin: value.pin ?? true,
    maxDistance,
    contentMode: value.contentMode ?? "informational",
    muteSiblings: value.muteSiblings ?? false,
    tooltipTotal: value.tooltipTotal ?? "auto",

    ...(value.content !== undefined && { content: value.content }),
  });
}

function resolveSelect(
  input: SelectInput | undefined,
  hasKey: boolean | undefined,
  diagnostics: InteractionDiagnostic[],
): ResolvedSelect {
  if (input === undefined || input === false) return null;
  const value = typeof input === "string" ? { type: input } : input;
  const select = Object.freeze({
    type: value.type,
    mode: value.mode ?? "xy",
    multiple: value.multiple ?? false,
    persistent: value.persistent ?? true,
    preset: value.preset ?? "independent",
  });
  if (value.type === "point" && hasKey === false) {
    diagnostics.push({
      ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_POINT_REQUIRES_KEY,
    });
  }
  if (value.type === "interval" && select.preset !== "independent" && hasKey === false) {
    diagnostics.push({
      ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_INTERVAL_PRESET_REQUIRES_KEY,
    });
  }
  return select;
}

function availableInteractionTools<Row, Key, Content>(
  inspect: ResolvedInspect<Row, Key, Content>,
  select: ResolvedSelect,
  zoom: ResolvedInteractionConfig["zoom"],
): InteractionTool[] {
  const tools: InteractionTool[] = [];
  if (inspect !== null || select?.type === "interval" || zoom !== null) tools.push("inspect");
  if (select?.type === "point") tools.push("point");
  if (select?.type === "interval") tools.push("select-area");
  if (zoom !== null) tools.push("zoom-area");
  return tools;
}

function resolveZoom(input: ZoomInput | undefined): ResolvedInteractionConfig["zoom"] {
  if (input === undefined || input === false) return null;
  const value = input === true ? {} : input;
  return Object.freeze({
    mode: value.mode ?? "xy",
    trigger: value.trigger ?? "brush",
  });
}

function resolveLegendFocus(
  input: LegendFocusInput | undefined,
  hasKey: boolean | undefined,
  diagnostics: InteractionDiagnostic[],
): ResolvedInteractionConfig["legendFocus"] {
  if (input === undefined || input === false) return null;
  if (hasKey === false) {
    diagnostics.push({
      ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_LEGEND_REQUIRES_KEY,
    });
    return null;
  }
  const value = input === true ? {} : input;
  return Object.freeze({ preview: value.preview ?? true });
}

export function normalizeInteractionConfig<Row, Key, Content>(
  input: InteractionConfigInput<Row, Key, Content>,
  context: { faceted?: boolean; hasKey?: boolean } = {},
): ResolvedInteractionConfig<Row, Key, Content> {
  const diagnostics: InteractionDiagnostic[] = [];
  const inspect = resolveInspect(input.inspect, diagnostics);
  const select = resolveSelect(input.select, context.hasKey, diagnostics);

  let zoom = resolveZoom(input.zoom);
  const legendFocus = resolveLegendFocus(input.legendFocus, context.hasKey, diagnostics);

  if (context.faceted === true && zoom !== null) {
    diagnostics.push({
      ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_INTERVAL_FACET_UNSUPPORTED,
    });
    zoom = null;
  }

  const availableTools = availableInteractionTools(inspect, select, zoom);
  const fallbackTool = select?.type === "point" && inspect === null ? "point" : "inspect";
  const requestedTool = input.tool ?? fallbackTool;
  const initialTool = availableTools.includes(requestedTool) ? requestedTool : fallbackTool;
  if (input.tool !== undefined && !availableTools.includes(input.tool)) {
    diagnostics.push({
      ...INTERACTION_DIAGNOSTIC_CATALOG.INTERACTION_TOOL_UNAVAILABLE,
      actual: input.tool,
    });
  }

  return Object.freeze({
    interactive: availableTools.length > 0 || legendFocus !== null,
    inspect,
    select,
    zoom,
    legendFocus,
    initialTool,
    availableTools: Object.freeze(availableTools),
    diagnostics: Object.freeze(diagnostics),
  });
}

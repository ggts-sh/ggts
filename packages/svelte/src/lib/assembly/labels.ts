import type { CellValue, RenderModel } from "@ggts-sh/core";

import type {
  LegendFocusEvent,
  PlotInspectionChange,
  PlotSelection,
  ReadonlyZoomDomains,
} from "../interaction/interaction.js";
import {
  collapseIdenticalDisplayMembers,
  formatTooltipCell,
} from "../inspection/display-members.js";

/** Shared a11y count phrase: "1 datum" / "N data". */
export function countLabel(count: number): string {
  return `${String(count)} ${count === 1 ? "datum" : "data"}`;
}

/** Live message when the brush needs a second corner (pointer or keyboard). */
export const BRUSH_SECOND_CORNER_ANNOUNCEMENT = "Choose opposite corner." as const;

/**
 * Live message for selection emission, or null when the phase does not announce
 * (interval start/change).
 */
export function selectionAnnouncement(event: PlotSelection): string | null {
  if (event.phase === "end") {
    const count = event.mode === "point" ? event.keys.length : event.lineageCount;
    return `Selection complete, ${countLabel(count)}.`;
  }
  if (event.phase === "clear") return "Selection cleared.";
  return null;
}

/** Live message for legend-focus change/clear events. */
export function legendFocusAnnouncement(event: LegendFocusEvent): string {
  if (event.phase === "change") {
    const verb = event.state === "committed" ? "focused" : "previewed";
    return `${event.label} ${verb}, ${countLabel(event.keys.length)}.`;
  }
  return "Legend focus cleared.";
}

/** Live message after a zoom commit or reset (`null` domains → reset). */
export function zoomAnnouncement(domains: ReadonlyZoomDomains | null): string {
  return domains === null ? "Zoom reset." : "Zoom complete.";
}

/**
 * Unique mapped field names across layers (first-seen order).
 * Hosts that label many marks should call once per model and close over the
 * result — `markLabel` / `datumLabel` recompute it per call (#1329).
 */
export function uniqueMappedFields(model: RenderModel): readonly string[] {
  const seen = new Set<string>();
  const fields: string[] = [];
  for (const layer of model.layerFields) {
    if (layer === undefined) continue;
    for (const mapped of layer) {
      if (seen.has(mapped.field)) continue;
      seen.add(mapped.field);
      fields.push(mapped.field);
    }
  }
  return fields;
}

/** Label parts from a precomputed unique field list and a row record. */
export function labelFromFields(
  fields: readonly string[],
  values: Record<string, CellValue>,
  emptyFallback: string,
): string {
  if (fields.length === 0) return emptyFallback;
  const parts: string[] = [];
  for (const field of fields) parts.push(`${field} ${String(values[field] ?? "")}`);
  return parts.join(", ");
}

/** Accessible per-mark label from the layer's mapped fields. */
export function markLabel(model: RenderModel | null, row: number): string {
  if (model === null) return `data point ${row + 1}`;
  const values = model.row(row);
  if (values === null) return `data point ${row + 1}`;
  return labelFromFields(uniqueMappedFields(model), values, `data point ${row + 1}`);
}

export function datumLabel(
  model: RenderModel | null,
  values: Record<string, CellValue> | null,
): string {
  if (values === null) return "No active datum";
  if (model === null) return labelFromFields([], values, "Active datum");
  return labelFromFields(uniqueMappedFields(model), values, "Active datum");
}

export function inspectionLiveText(
  model: RenderModel | null,
  value: PlotInspectionChange<Record<string, CellValue>, PropertyKey>,
): string {
  // Count distinct default-tooltip payloads so line+point same-data does not
  // announce "2 data" for one observation (#385).
  const axisFormatters = model?.axisFormatters ?? null;
  const count = collapseIdenticalDisplayMembers(
    value.members,
    value.focus,
    axisFormatters,
    value.mode,
  ).length;
  const state = value.state === "pinned" ? ", pinned" : "";
  if (value.mode !== "x" && value.mode !== "y")
    return `${datumLabel(model, value.focus.row)}; ${countLabel(count)}${state}`;
  // Stat focus (no source row) formats x/y with axis formatters; identity keeps
  // precise cell values (#1113).
  const focusFormatters = value.focus.row === null ? axisFormatters : null;
  const seen = new Set<string>();
  const focused = value.focus.fields
    .filter((field) => {
      if (field.channel === value.mode || seen.has(field.field)) return false;
      seen.add(field.field);
      return true;
    })
    .map((field) => {
      const display = formatTooltipCell(field.value, {
        channel: field.channel,
        axisFormatters: focusFormatters,
      });
      return `${field.field} ${display}`;
    })
    .join(", ");
  return `${value.mode} ${value.axisLabel}; ${countLabel(count)}${focused ? `; focused ${focused}` : ""}${state}`;
}

/**
 * Capture live-region text for the interaction ARIA live region.
 *
 * Priority (matches host `announcement || fallback`):
 *   1. non-empty sticky `announcement` (including after microtask fill)
 *   2. keyboard/touch inspection → `inspectionLiveText` (short-circuited)
 *   3. otherwise empty string
 *
 * Empty-string announcement is falsy and falls through — host
 * `announceInteraction` briefly sets `""` before the microtask message.
 */
export function resolveInteractionLiveText(input: {
  readonly announcement: string;
  readonly model: RenderModel | null;
  readonly inspection: PlotInspectionChange<Record<string, CellValue>, PropertyKey> | null;
}): string {
  if (input.announcement) return input.announcement;
  if (input.inspection === null) return "";
  if (input.inspection.source === "keyboard" || input.inspection.source === "touch")
    return inspectionLiveText(input.model, input.inspection);
  return "";
}

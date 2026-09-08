/**
 * Shared pure fixtures for display-members test siblings.
 * Data-only helpers — no behavior, no vitest imports.
 */
import type { CellValue } from "@ggts-sh/core";

import type { PlotDatum, TooltipField } from "../../src/lib/interaction/interaction.js";

export function field(channel: string, fieldName: string, value: CellValue): TooltipField {
  return { channel, field: fieldName, value };
}

export function member(
  partial: Partial<PlotDatum<Record<string, CellValue>, PropertyKey>> & {
    fields: readonly TooltipField[];
    layerIndex: number;
  },
): PlotDatum<Record<string, CellValue>, PropertyKey> {
  return {
    key: partial.key ?? null,
    row: partial.row ?? null,
    sourceKeys: partial.sourceKeys ?? [],
    lineageCount: partial.lineageCount ?? 1,
    layerIndex: partial.layerIndex,
    panelId: partial.panelId ?? null,
    fields: partial.fields,
    anchor: partial.anchor ?? { x: 0, y: 0 },
  };
}

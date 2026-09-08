/**
 * Shared LegendKeyIndexAdapter fixture builder for pure legend entry-key-index suites.
 */
import type { SceneLegend } from "@ggts-sh/core";

import type { LegendKeyIndexAdapter } from "../../src/lib/legend/entry-key-index.js";
import { discreteFill } from "./focus-fixtures.js";

export function adapter(partial: {
  legends?: readonly SceneLegend[];
  candidates?: readonly {
    layerIndex: number;
    lineage: number;
    rowIndex: number | null;
  }[];
  fields?: Record<number, readonly { channel: string; field: string; source?: "stat" }[]>;
  scaledConstants?: Record<number, Record<string, unknown>>;
  lineages?: Record<number, readonly number[]>;
  rows?: Record<number, Record<string, unknown> | null>;
  keys?: Record<number, PropertyKey | null | undefined>;
}): LegendKeyIndexAdapter {
  const candidates = partial.candidates ?? [];
  const fields = partial.fields ?? {};
  const scaledConstants = partial.scaledConstants ?? {};
  const lineages = partial.lineages ?? {};
  const rows = partial.rows ?? {};
  const keys = partial.keys ?? {};
  return {
    legends: partial.legends ?? [discreteFill],
    candidates: () => candidates,
    layerFields: (layerIndex) => fields[layerIndex],
    layerScaledConstant: (layerIndex, channel) => scaledConstants[layerIndex]?.[channel],
    lineageKeys: (lineageId) => lineages[lineageId] ?? [],
    row: (rowIndex) => (rows[rowIndex] as Record<string, never> | null) ?? null,
    semanticKey: (rowIndex) => keys[rowIndex],
  };
}

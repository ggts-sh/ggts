/**
 * Field presence / all-null checks for aes channel resolution.
 */
import type { ChannelValue, NormalizedGeomName } from "@ggts-sh/spec";
import { didYouMean } from "@ggts-sh/spec";

import type { CellValue } from "../table.js";
import type { ColumnTable } from "../table.js";

import type { PipelineWarning } from "./types.js";
import { PipelineError } from "./types.js";

export function checkField(
  channel: ChannelValue | undefined,
  channelName: string,
  layerIndex: number,
  table: ColumnTable,
  warnings: PipelineWarning[],
): string | null {
  if (channel === undefined || channel === null) return null;
  if (!("field" in channel)) return null;
  if (!table.has(channel.field)) {
    const suggestion = didYouMean(channel.field, table.fields);
    throw new PipelineError(
      "unknown-field",
      `/layers/${layerIndex}/aes/${channelName}`,
      `Unknown field "${channel.field}" (available: ${table.fields.join(", ") || "none"}).` +
        (suggestion === undefined ? "" : ` Did you mean "${suggestion}"?`),
    );
  }
  if (allNull(table.column(channel.field))) {
    throw new PipelineError(
      "all-null-column",
      `/layers/${layerIndex}/aes/${channelName}`,
      `Field "${channel.field}" contains only null values; the "${channelName}" channel cannot be drawn from it.`,
    );
  }
  void warnings;
  return channel.field;
}

function allNull(column: readonly CellValue[]): boolean {
  if (column.length === 0) return false;
  for (const v of column) if (v !== null) return false;
  return true;
}

export function requireField(
  field: string | null,
  channelName: string,
  layerIndex: number,
  geom: NormalizedGeomName,
): string {
  if (field === null) {
    throw new PipelineError(
      "missing-channel",
      `/layers/${layerIndex}/aes/${channelName}`,
      `The ${geom} geom requires a "${channelName}" channel (map it with aes).`,
    );
  }
  return field;
}

/**
 * Resolve y field vs stat-column mapping for bindLayer.
 */
import type { Aes, StatName } from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";

import { STAT_Y_COLUMNS } from "./bind-layer-stat-columns.js";
import { checkField } from "./bind-layer-check-field.js";
import type { PipelineWarning } from "./types.js";
import { PipelineError } from "./types.js";

export function resolveYChannel(input: {
  aes: Aes;
  stat: StatName;
  index: number;
  table: ColumnTable;
  warnings: PipelineWarning[];
}): { yField: string | null; yStatColumn: string | null } {
  const { aes, stat, index, table, warnings } = input;
  const y = aes.y;
  if (y !== undefined && y !== null && "stat" in y) {
    const generated = STAT_Y_COLUMNS[stat];
    if (!generated.includes(y.stat)) {
      throw new PipelineError(
        "unknown-stat-column",
        `/layers/${index}/aes/y`,
        `Channel "y" maps stat column "${y.stat}", but this layer's stat ("${stat}") ${generated.length > 0 ? `generates: ${generated.join(", ")}` : "generates no y-mappable columns"}.`,
      );
    }
    return { yField: null, yStatColumn: y.stat };
  }
  return { yField: checkField(y, "y", index, table, warnings), yStatColumn: null };
}

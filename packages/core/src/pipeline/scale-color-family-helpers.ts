/** Shared helpers for manual, identity, and binned color/fill families. */
import type { ColorScaleSpec } from "@ggts-sh/spec";

import { resolveMissingColors } from "../scales/engine.js";
import { encodeKey } from "../scales/state.js";
import type { CellValue } from "../table.js";

import type { PipelineWarning } from "./types.js";

export function warnUnknownColors(
  name: "color" | "fill",
  count: number,
  warnings: PipelineWarning[],
): void {
  if (count === 0) return;
  warnings.push({
    code: "color-unknown-values",
    message: `${String(count)} ${name} value(s) use the unknown color.`,
  });
}

export function fallbackColors(config: ColorScaleSpec | undefined): {
  naValue: string;
  unknownValue: string;
} {
  return resolveMissingColors(config);
}

export function uniqueValues(values: readonly CellValue[]): CellValue[] {
  const seen = new Set<string>();
  const output: CellValue[] = [];
  for (const value of values) {
    if (value === null) continue;
    const key = encodeKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

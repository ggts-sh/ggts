/** Shared helpers for manual, identity, and binned color/fill families. */
import type { ColorScaleSpec } from "@ggts-sh/spec";

import { resolveMissingColors } from "../scales/engine.js";

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

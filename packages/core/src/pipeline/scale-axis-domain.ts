/**
 * Continuous scale domain parsing for positional axes.
 */
import type { PositionScaleSpec } from "@ggts-sh/spec";

import { positionConversionContext, positionValuesToNumeric } from "./temporal-position.js";
import { PipelineError } from "./types.js";

export function continuousDomainOf(
  config: PositionScaleSpec | undefined,
  axis: "x" | "y",
): [number, number] | undefined {
  if (config?.domain === undefined) return undefined;
  if (config.domain.length !== 2) {
    throw new PipelineError(
      "invalid-scale-domain",
      `/scales/${axis}/domain`,
      `A continuous ${axis} domain needs exactly [min, max] (got ${config.domain.length} entries).`,
    );
  }
  const converted = positionValuesToNumeric(config.domain, positionConversionContext(config));
  const lo = converted.values[0]!;
  const hi = converted.values[1]!;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    throw new PipelineError(
      "invalid-scale-domain",
      `/scales/${axis}/domain`,
      `The ${axis} domain [${String(config.domain[0])}, ${String(config.domain[1])}] does not parse to finite values for this scale. Use numbers for numeric scales or values matching scales.${axis}.parse for time scales.`,
    );
  }
  return lo <= hi ? [lo, hi] : [hi, lo];
}

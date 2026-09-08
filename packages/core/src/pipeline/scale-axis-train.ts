/**
 * Positional axis training: type inference, band/continuous training, zero forcing.
 */
import type { PositionScaleSpec } from "@ggts-sh/spec";

import { trainBandAxis } from "./scale-axis-train-band.js";
import { trainContinuousAxis } from "./scale-axis-train-continuous.js";
import type { AxisInputs, AxisTraining } from "./scale-axis-types.js";
import type { Advisory, PipelineWarning } from "./types.js";

export type { AxisInputs, AxisTraining } from "./scale-axis-types.js";
export { isBarLike } from "./scale-axis-types.js";

const POSITION_TYPE_OVERRIDE =
  'Set scales.AXIS.type ("linear" | "time" | "band" | "binned") in the spec.';

export function trainAxis(
  axis: "x" | "y",
  inputs: AxisInputs,
  config: PositionScaleSpec | undefined,
): AxisTraining {
  const advisories: Advisory[] = [];
  const warnings: PipelineWarning[] = [];
  const howToOverride = POSITION_TYPE_OVERRIDE.replace("AXIS", axis);

  let type = config?.type;
  if (type === undefined) {
    type = inputs.anyDiscrete ? "band" : inputs.allTemporal ? "time" : "linear";
    advisories.push({
      code: "scale-type-inferred",
      path: `scales.${axis}`,
      chosen: `${type} (${inputs.evidence})`,
      howToOverride,
    });
  }

  if (type === "band") {
    return trainBandAxis(axis, inputs, config, advisories, warnings);
  }
  // Continuous families train affine in transformed space. `binned` values are
  // already snapped to their bin's transformed center pre-stat (resolve-binned-
  // axis.ts + binned-scale.ts), so training over them here is correct affine
  // training over a discrete set of centers; the conflict case type:"log" is
  // rejected at preflight and mapped to linear here.
  const continuousType: "linear" | "time" = type === "time" ? "time" : "linear";
  return trainContinuousAxis(axis, inputs, config, continuousType, advisories, warnings);
}

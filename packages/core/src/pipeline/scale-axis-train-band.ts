/**
 * Band positional axis training from discrete column evidence.
 */
import type { PositionScaleSpec } from "@ggts-sh/spec";

import { trainBand } from "../scales/train.js";

import type { AxisInputs, AxisTraining } from "./scale-axis-types.js";
import type { Advisory, PipelineWarning } from "./types.js";

export function trainBandAxis(
  axis: "x" | "y",
  inputs: AxisInputs,
  config: PositionScaleSpec | undefined,
  advisories: Advisory[],
  warnings: PipelineWarning[],
): AxisTraining {
  const domain = config?.domain;
  const scale = trainBand(inputs.columns, {
    ...(domain !== undefined && { domain }),
    ...(config?.reverse !== undefined && { reverse: config.reverse }),
  });
  if (scale.domain.length === 0) {
    warnings.push({
      code: "empty-domain",
      message: `The ${axis} band scale has no categories.`,
    });
  }
  return { scale, advisories, warnings, scaleDiagnostics: [] };
}

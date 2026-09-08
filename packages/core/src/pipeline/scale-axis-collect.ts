/**
 * Collect per-axis training evidence across layer frames.
 */
import type { PositionScaleSpec } from "@ggts-sh/spec";

import type { AxisInputs } from "./scale-axis-train.js";
import { collectAxisInputsX, type AxisCollectAcc } from "./scale-axis-collect-x.js";
import { collectAxisInputsY } from "./scale-axis-collect-y.js";
import type { Advisory, LayerFrame } from "./types.js";

/** Collect per-axis training evidence across layers. */
export function collectAxisInputs(
  axis: "x" | "y",
  frames: readonly LayerFrame[],
  configType: PositionScaleSpec["type"] | undefined,
  advisories: Advisory[],
): AxisInputs {
  const acc: AxisCollectAcc = {
    columns: [],
    numeric: [],
    anyDiscrete: false,
    allTemporal: true,
    sawContinuousEvidence: false,
    barMeasure: false,
    typeParts: new Set<string>(),
  };

  for (const frame of frames) {
    if (axis === "x") collectAxisInputsX(frame, configType, advisories, acc);
    else collectAxisInputsY(frame, acc);
  }

  return {
    columns: acc.columns,
    numeric: acc.numeric,
    anyDiscrete: acc.anyDiscrete,
    allTemporal: acc.allTemporal && acc.sawContinuousEvidence,
    barMeasure: acc.barMeasure,
    evidence: `field type: ${[...acc.typeParts].join("+") || "none"}`,
  };
}

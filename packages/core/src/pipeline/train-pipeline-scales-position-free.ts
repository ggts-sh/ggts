/**
 * Per-panel free_x / free_y positional scale training.
 */
import type { PortableSpec } from "@ggts-sh/spec";

import type { PositionScale } from "../scales/train.js";

import { collectAxisInputs } from "./scale-axis-collect.js";
import { trainAxis } from "./scale-axis-train.js";
import type { Advisory, LayerFrame, PipelineWarning, ScaleDiagnostic } from "./types.js";

export function trainFreePanelScales(input: {
  scalesConfig: NonNullable<PortableSpec["scales"]>;
  panelFrames: readonly (readonly LayerFrame[])[];
  panelCount: number;
  freeX: boolean;
  freeY: boolean;
  fixedX: PositionScale;
  fixedY: PositionScale;
  warnings: PipelineWarning[];
  scaleDiagnostics: ScaleDiagnostic[];
}): { x: PositionScale; y: PositionScale }[] {
  const {
    scalesConfig,
    panelFrames,
    panelCount,
    freeX,
    freeY,
    fixedX,
    fixedY,
    warnings,
    scaleDiagnostics,
  } = input;

  return Array.from({ length: panelCount }, (_, p) => {
    let px = fixedX;
    let py = fixedY;
    const scratch: Advisory[] = [];
    if (freeX) {
      const inputs = collectAxisInputs("x", panelFrames[p]!, scalesConfig.x?.type, scratch);
      const training = trainAxis("x", inputs, { ...scalesConfig.x, type: fixedX.type });
      warnings.push(...training.warnings);
      scaleDiagnostics.push(...training.scaleDiagnostics);
      px = training.scale;
    }
    if (freeY) {
      const inputs = collectAxisInputs("y", panelFrames[p]!, scalesConfig.y?.type, scratch);
      const training = trainAxis("y", inputs, { ...scalesConfig.y, type: fixedY.type });
      warnings.push(...training.warnings);
      scaleDiagnostics.push(...training.scaleDiagnostics);
      py = training.scale;
    }
    return { x: px, y: py };
  });
}

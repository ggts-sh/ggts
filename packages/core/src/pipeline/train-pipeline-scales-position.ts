/**
 * Train fixed and free positional scales for a pipeline run.
 */
import type { PortableSpec } from "@ggts-sh/spec";

import type { PositionScale } from "../scales/train.js";

import type { FacetPanelDef } from "./facets.js";
import { collectAxisInputs } from "./scale-axis-collect.js";
import { trainAxis } from "./scale-axis-train.js";
import type { Advisory, LayerFrame, PipelineWarning, ScaleDiagnostic } from "./types.js";
import { trainFreePanelScales } from "./train-pipeline-scales-position-free.js";

export interface TrainedPositionScales {
  xTraining: ReturnType<typeof trainAxis>;
  yTraining: ReturnType<typeof trainAxis>;
  panelScales: { x: PositionScale; y: PositionScale }[];
  xInputs: ReturnType<typeof collectAxisInputs>;
  yInputs: ReturnType<typeof collectAxisInputs>;
  allFrames: LayerFrame[];
  /** Rich diagnostics from scale training (structured facts at emission, #628). */
  scaleDiagnostics: ScaleDiagnostic[];
}

export function trainPipelinePositionScales(input: {
  scalesConfig: NonNullable<PortableSpec["scales"]>;
  facetPanels: readonly FacetPanelDef[];
  panelFrames: readonly (readonly LayerFrame[])[];
  freeX: boolean;
  freeY: boolean;
  warnings: PipelineWarning[];
  advisories: Advisory[];
}): TrainedPositionScales {
  const { scalesConfig, facetPanels, panelFrames, freeX, freeY, warnings, advisories } = input;

  const allFrames = panelFrames.flat();
  const xInputs = collectAxisInputs("x", allFrames, scalesConfig.x?.type, advisories);
  const yInputs = collectAxisInputs("y", allFrames, scalesConfig.y?.type, advisories);
  const xTraining = trainAxis("x", xInputs, scalesConfig.x);
  const yTraining = trainAxis("y", yInputs, scalesConfig.y);
  advisories.push(...xTraining.advisories, ...yTraining.advisories);
  warnings.push(...xTraining.warnings, ...yTraining.warnings);
  const scaleDiagnostics: ScaleDiagnostic[] = [
    ...xTraining.scaleDiagnostics,
    ...yTraining.scaleDiagnostics,
  ];

  const panelScales = trainFreePanelScales({
    scalesConfig,
    panelFrames,
    panelCount: facetPanels.length,
    freeX,
    freeY,
    fixedX: xTraining.scale,
    fixedY: yTraining.scale,
    warnings,
    scaleDiagnostics,
  });

  return { xTraining, yTraining, panelScales, xInputs, yInputs, allFrames, scaleDiagnostics };
}

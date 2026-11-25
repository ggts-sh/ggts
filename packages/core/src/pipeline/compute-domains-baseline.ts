/**
 * Baseline domain snapshots when baselineScales override natural training.
 */
import type { FacetPanelDef } from "./facets.js";
import { scaleDomainSnapshot } from "./layout-helpers.js";
import { collectAxisInputs } from "./scale-axis-collect.js";
import { trainAxis } from "./scale-axis-train.js";
import type { Advisory, LayerFrame, ScaleDomainSnapshot } from "./types.js";
import type { RunOptions } from "./types.js";

export function computeTrainedBaselineDomains(input: {
  options: RunOptions;
  freeX: boolean;
  freeY: boolean;
  facetPanels: readonly FacetPanelDef[];
  panelFrames: readonly (readonly LayerFrame[])[];
  xInputs: ReturnType<typeof collectAxisInputs>;
  yInputs: ReturnType<typeof collectAxisInputs>;
}): ScaleDomainSnapshot {
  const { options, freeX, freeY, facetPanels, panelFrames, xInputs, yInputs } = input;

  const baselineX = trainAxis("x", xInputs, options.baselineScales!.x).scale;
  const baselineY = trainAxis("y", yInputs, options.baselineScales!.y).scale;
  const baselineXDomain = scaleDomainSnapshot(baselineX);
  const baselineYDomain = scaleDomainSnapshot(baselineY);
  const baselinePanels = facetPanels.map((_, panelIndex) => {
    let x = baselineXDomain;
    let y = baselineYDomain;
    const scratch: Advisory[] = [];
    if (freeX) {
      const inputs = collectAxisInputs(
        "x",
        panelFrames[panelIndex]!,
        options.baselineScales?.x?.type,
        scratch,
      );
      x = scaleDomainSnapshot(
        trainAxis("x", inputs, {
          ...options.baselineScales?.x,
          type: baselineX.type,
        }).scale,
      );
    }
    if (freeY) {
      const inputs = collectAxisInputs(
        "y",
        panelFrames[panelIndex]!,
        options.baselineScales?.y?.type,
        scratch,
      );
      y = scaleDomainSnapshot(
        trainAxis("y", inputs, {
          ...options.baselineScales?.y,
          type: baselineY.type,
        }).scale,
      );
    }
    return Object.freeze({ x, y });
  });
  return Object.freeze({
    x: baselineXDomain,
    y: baselineYDomain,
    panels: Object.freeze(baselinePanels),
  });
}

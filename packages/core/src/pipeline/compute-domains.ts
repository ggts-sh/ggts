/**
 * Effective and baseline scale domain snapshots for a pipeline run.
 */
import type { PositionScale } from "../scales/train.js";

import { computeTrainedBaselineDomains } from "./compute-domains-baseline.js";
import type { FacetPanelDef } from "./facets.js";
import { scaleDomainSnapshot } from "./layout-helpers.js";
import { collectAxisInputs } from "./scale-axis-collect.js";
import type { LayerFrame, ScaleDomainSnapshot } from "./types.js";
import type { RunOptions } from "./types.js";

export function computeEffectiveDomains(
  xScale: PositionScale,
  yScale: PositionScale,
  panelScales: readonly { x: PositionScale; y: PositionScale }[],
): ScaleDomainSnapshot {
  // Fixed panels can reuse the owned snapshot of their shared trained scale.
  const x = scaleDomainSnapshot(xScale);
  const y = scaleDomainSnapshot(yScale);
  return Object.freeze({
    x,
    y,
    panels: Object.freeze(
      panelScales.map((panel) =>
        Object.freeze({
          x: panel.x === xScale ? x : scaleDomainSnapshot(panel.x),
          y: panel.y === yScale ? y : scaleDomainSnapshot(panel.y),
        }),
      ),
    ),
  });
}

export function computeBaselineDomains(input: {
  options: RunOptions;
  freeX: boolean;
  freeY: boolean;
  facetPanels: readonly FacetPanelDef[];
  panelFrames: readonly (readonly LayerFrame[])[];
  xInputs: ReturnType<typeof collectAxisInputs>;
  yInputs: ReturnType<typeof collectAxisInputs>;
  effectiveDomains: ScaleDomainSnapshot;
}): ScaleDomainSnapshot {
  const { options, effectiveDomains } = input;

  if (options.baselineDomains !== undefined) return options.baselineDomains;
  if (options.baselineScales === undefined) return effectiveDomains;
  return computeTrainedBaselineDomains(input);
}

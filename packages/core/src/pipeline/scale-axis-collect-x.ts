/**
 * Collect x-axis training evidence from a single layer frame.
 */
import type { PositionScaleSpec } from "@ggts-sh/spec";

import type { AxisCollectAcc } from "./scale-axis-collect-acc.js";
import { collectBinnedXEvidence } from "./scale-axis-collect-x-binned.js";
import { collectXOutliersAndIntercepts } from "./scale-axis-collect-x-extras.js";
import { collectMappedXEvidence } from "./scale-axis-collect-x-mapped.js";
import type { Advisory, LayerFrame } from "./types.js";

export type { AxisCollectAcc } from "./scale-axis-collect-acc.js";

export function collectAxisInputsX(
  frame: LayerFrame,
  configType: PositionScaleSpec["type"] | undefined,
  advisories: Advisory[],
  acc: AxisCollectAcc,
): void {
  if (frame.xmin !== null && frame.xmax !== null) {
    collectBinnedXEvidence(frame, acc);
  } else {
    collectMappedXEvidence(frame, configType, advisories, acc);
  }
  collectXOutliersAndIntercepts(frame, acc);
}

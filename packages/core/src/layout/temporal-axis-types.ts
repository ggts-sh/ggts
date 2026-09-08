/**
 * Temporal axis guide planning input and evaluation types.
 */
import type { PositionScaleSpec, TemporalInterval, TemporalScaleKind } from "@ggts-sh/spec";

import type { CellValue } from "../table.js";
import type { AxisGuideTick } from "./guide-plan-types.js";
import type { TextMeasurer } from "./measure.js";

export interface TemporalAxisPlanInput {
  aesthetic: "x" | "y";
  panelIndex: number;
  domain: readonly [number, number];
  kind: TemporalScaleKind;
  orient: "horizontal" | "vertical";
  extentPx: number;
  reverse: boolean;
  measurer: TextMeasurer;
  fontSize: number;
  marginCapPx: number;
  /** Cap for the orthogonal label band (bottom for x, top/bottom overhang for y). */
  orthogonalMarginCapPx?: number;
  config: Pick<
    PositionScaleSpec,
    | "dateBreaks"
    | "dateMinorBreaks"
    | "dateLabels"
    | "labels"
    | "locale"
    | "timezone"
    | "weekStart"
    | "disambiguation"
  >;
  /** Numeric semantic epoch-ms breaks converted through the resolved source parser. */
  breaks?: readonly number[];
  sourceBreaks?: readonly CellValue[];
  /** Pass-A automatic interval hint. Author intervals never use this. */
  previousInterval?: string | null;
}

export interface TemporalCandidateEvaluation {
  interval: TemporalInterval;
  ticks: AxisGuideTick[];
  overlap: boolean;
  marginOverflow: boolean;
  count: number;
  approxMs: number;
}

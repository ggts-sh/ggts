/**
 * Axis training shared types and bar-like geom classification.
 */
import type { LayerSpec } from "@ggts-sh/spec";

import type { PositionScale } from "../scales/train.js";
import type { CellValue } from "../table.js";

import type { Advisory, PipelineWarning } from "./types.js";
import type { ScaleDiagnostic } from "./types-scale-diagnostics.js";

/** Geoms whose marks extend from a zero baseline on the measure (y) axis. */
export function isBarLike(geom: LayerSpec["geom"]): boolean {
  return geom === "bar" || geom === "col" || geom === "area";
}

export interface AxisTraining {
  scale: PositionScale;
  advisories: Advisory[];
  warnings: PipelineWarning[];
  /** Rich dual-channel diagnostics emitted with structured facts (#628). */
  scaleDiagnostics: ScaleDiagnostic[];
}

export interface AxisInputs {
  /** Discrete columns contributing to a band domain. */
  columns: (readonly CellValue[])[];
  /** Continuous numeric arrays (post-stat / post-position). */
  numeric: Float64Array[];
  /** True when any contributing field is discrete or a geom forces bands. */
  anyDiscrete: boolean;
  /** True when every contributing field is temporal (and none discrete). */
  allTemporal: boolean;
  /** True when a bar-like geom measures on this axis (zero forcing). */
  barMeasure: boolean;
  /** Human-readable description of the evidence (advisory text). */
  evidence: string;
}

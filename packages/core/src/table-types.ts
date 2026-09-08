/**
 * Public data-container types for ColumnTable and field inference.
 */
import type {
  TemporalDecision,
  TemporalDisambiguation,
  TemporalKind,
  TemporalPrecision,
} from "@ggts-sh/spec";

export type CellValue = string | number | boolean | Date | null;
export type Columns = Readonly<Record<string, readonly CellValue[]>>;
export type Rows = readonly Readonly<Record<string, CellValue>>[];

export type FieldType = "quantitative" | "temporal" | "nominal";
export type Discreteness = "discrete" | "continuous";
type TemporalFailurePolicy = "error" | "censor";

export interface ParsedColumnOptions {
  timezone?: string;
  disambiguation?: TemporalDisambiguation;
  failurePolicy?: TemporalFailurePolicy;
  /** Internal position-scale override: coerce numeric strings without temporal inference. */
  inferTemporal?: boolean;
}

export interface ParsedColumnView {
  raw: readonly CellValue[];
  semantic: Float64Array;
  valid: Uint8Array;
  parserKey: string;
  temporalKind?: TemporalKind;
  temporalPrecision?: TemporalPrecision;
  decision: TemporalDecision;
}

/**
 * Immutable transformed (scale-space) view: the parser result plus the pre-stat
 * OOB/NA/forward transform. `semantic` is source units; `transformed` is
 * scale units; `valid` reflects post-transform validity. Counts feed bounded
 * axis diagnostics without placing full columns in the public model.
 */
export interface TransformedColumnView {
  raw: readonly CellValue[];
  semantic: Float64Array;
  transformed: Float64Array;
  valid: Uint8Array;
  /** Per-row diagnostic event flags, preserved through subsets. */
  events: Uint8Array;
  parserKey: string;
  transformKey: string;
  censored: number;
  squished: number;
  invalidTransform: number;
}

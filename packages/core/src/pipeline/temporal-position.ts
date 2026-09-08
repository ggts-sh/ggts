import type {
  PositionScaleSpec,
  TemporalDecision,
  TemporalParserSpec,
  TemporalScaleKind,
} from "@ggts-sh/spec";

import {
  cellsToNumeric,
  cellsToQuantitative,
  type CellValue,
  type ColumnTable,
  type Discreteness,
  type FieldType,
  type ParsedColumnOptions,
} from "../table.js";
import type { ColumnTransformConfig } from "../scales/transform.js";
import { getTemporalRuntime } from "../temporal-runtime.js";

/** Leap reference year for month-day projection (matches @ggts-sh/spec). */
const MONTH_DAY_REFERENCE_YEAR = 2000;

export interface PositionConversionContext {
  /** Effective parser for detached/post-stat values and author scalars. */
  parser: TemporalParserSpec | "auto";
  /** Original parser request for source ColumnTable views and cache identity. */
  sourceParser: TemporalParserSpec | "auto";
  options: ParsedColumnOptions;
  requestedTime: boolean;
  requestedKind?: TemporalScaleKind;
  forcedDiscrete: boolean;
  /** Explicit linear/log scale with no temporal options: numeric coercion only. */
  forcedNonTemporal: boolean;
}

export const AUTO_POSITION_CONVERSION: PositionConversionContext = Object.freeze({
  parser: "auto",
  sourceParser: "auto",
  options: Object.freeze({}),
  requestedTime: false,
  forcedDiscrete: false,
  forcedNonTemporal: false,
});

const DISCRETE_POSITION_CONVERSION: PositionConversionContext = Object.freeze({
  parser: "auto",
  sourceParser: "auto",
  options: Object.freeze({}),
  requestedTime: false,
  forcedDiscrete: true,
  forcedNonTemporal: false,
});

/**
 * Does the requested kind take a slice of a fuller value and discard the rest?
 *
 * `time` keeps the clock, `monthDay` keeps the month and day. Either way a
 * field or annotation parsing as `date` or `datetime` is exactly what the axis
 * expects to be handed, so the kinds differing is not a contradiction. Every
 * gate that compares a parse result against a requested kind needs this, and
 * they must agree — a spec the pipeline accepts and `validate()` rejects (or
 * the reverse) is worse than either verdict alone.
 */
export function kindReducesFullValue(conversion: PositionConversionContext): boolean {
  return conversion.requestedKind === "time" || conversion.requestedKind === "monthDay";
}

export function xConversionOf(binding: {
  xConversion?: PositionConversionContext | undefined;
}): PositionConversionContext {
  return binding.xConversion ?? AUTO_POSITION_CONVERSION;
}

export function yConversionOf(binding: {
  yConversion?: PositionConversionContext | undefined;
}): PositionConversionContext {
  return binding.yConversion ?? AUTO_POSITION_CONVERSION;
}

/**
 * Read a position column as scale-space numbers. With a pre-stat transform the
 * cached transformed view (OOB/NA/forward) is returned; otherwise the semantic
 * numeric view (identity). The two coincide for identity + unpinned + no-NA.
 *
 * When `requestedKind === "time"`, values are projected into time-of-day scale
 * space (epoch ms on 1970-01-01Z) so marks, domains, and axis ticks share one
 * coordinate system — portable numbers are seconds since midnight (#831).
 */
export function positionColumn(
  table: ColumnTable,
  field: string,
  conversion: PositionConversionContext,
  transform?: ColumnTransformConfig,
): Float64Array {
  const base =
    transform === undefined
      ? table.numeric(field, conversion.sourceParser, conversion.options)
      : table.transformed(field, conversion.sourceParser, conversion.options, transform)
          .transformed;
  if (conversion.requestedKind === "monthDay") return mapToMonthDayMs(base);
  if (conversion.requestedKind !== "time") return base;
  return mapToTimeOfDayMs(table.column(field), base);
}

export function positionFieldType(
  table: ColumnTable,
  field: string,
  conversion: PositionConversionContext,
): FieldType {
  if (conversion.forcedDiscrete) return "nominal";
  if (conversion.forcedNonTemporal) {
    const raw = table.column(field);
    const numeric = table.numeric(field, conversion.sourceParser, conversion.options);
    let sawFinite = false;
    for (let index = 0; index < raw.length; index++) {
      if (raw[index] === null) continue;
      if (!Number.isFinite(numeric[index]!)) return "nominal";
      sawFinite = true;
    }
    return sawFinite ? "quantitative" : "nominal";
  }
  return table.fieldType(field, conversion.sourceParser, conversion.options);
}

export function positionDiscreteness(
  table: ColumnTable,
  field: string,
  conversion: PositionConversionContext,
): Discreteness {
  return conversion.forcedDiscrete
    ? "discrete"
    : table.discreteness(field, conversion.sourceParser, conversion.options);
}

export interface ConvertedPositionValues {
  values: Float64Array;
  decision: TemporalDecision;
}

/**
 * Map a cell to time-of-day scale space (epoch ms on 1970-01-01Z).
 * Portable numbers are **seconds since midnight** (#831).
 */
function cellToTimeOfDayMs(value: CellValue): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value * 1000;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return Number.NaN;
    return (
      ((value.getUTCHours() * 60 + value.getUTCMinutes()) * 60 + value.getUTCSeconds()) * 1000 +
      value.getUTCMilliseconds()
    );
  }
  return Number.NaN;
}

/**
 * Map an instant to month-day scale space: the same month and day, in the
 * reference year. Idempotent, so a value that already arrived there — a stat's
 * binned median, say — passes through untouched.
 */
function toMonthDayMs(epochMs: number): number {
  if (!Number.isFinite(epochMs)) return Number.NaN;
  const d = new Date(epochMs);
  return Date.UTC(MONTH_DAY_REFERENCE_YEAR, d.getUTCMonth(), d.getUTCDate());
}

/**
 * The `md` parser already lands strings in the reference year, but `Date` cells
 * short-circuit parsing and keep their own year, and stats hand back raw
 * numbers. Projecting every route through one function is what keeps marks and
 * the values summarizing them in the same space.
 */
function mapToMonthDayMs(base: Float64Array): Float64Array {
  const out = new Float64Array(base.length);
  for (let index = 0; index < base.length; index++) out[index] = toMonthDayMs(base[index]!);
  return out;
}

function mapToTimeOfDayMs(values: readonly CellValue[], base: Float64Array): Float64Array {
  const out = new Float64Array(values.length);
  for (let index = 0; index < values.length; index++) {
    const value = values[index]!;
    if (typeof value === "number" || value instanceof Date) {
      out[index] = cellToTimeOfDayMs(value);
      continue;
    }
    // Parsed ISO/datetime strings already land as epoch ms in `base`.
    const ms = base[index]!;
    if (!Number.isFinite(ms)) {
      out[index] = Number.NaN;
      continue;
    }
    const d = new Date(ms);
    out[index] =
      ((d.getUTCHours() * 60 + d.getUTCMinutes()) * 60 + d.getUTCSeconds()) * 1000 +
      d.getUTCMilliseconds();
  }
  return out;
}

function parseDetachedValues(
  values: readonly CellValue[],
  conversion: PositionConversionContext,
): {
  decision: TemporalDecision;
  semantic: Float64Array;
  valid: Uint8Array;
} {
  const runtime = getTemporalRuntime();
  if (runtime !== null) {
    return runtime.parseColumn(values, conversion.parser, conversion.options);
  }
  // Lean path: ISO via cellToNumber; explicit non-auto parsers need full temporal.
  if (conversion.parser !== "auto") {
    throw new Error(
      `Position parser ${JSON.stringify(conversion.parser)} requires @ggts-sh/core (full) or @ggts-sh/core/temporal.`,
    );
  }
  const semantic = conversion.forcedNonTemporal
    ? cellsToQuantitative(values)
    : cellsToNumeric(values);
  const valid = new Uint8Array(values.length);
  let validated = 0;
  for (let index = 0; index < semantic.length; index++) {
    if (Number.isFinite(semantic[index]!)) {
      valid[index] = 1;
      validated++;
    }
  }
  const nonNull = values.filter((value) => value !== null);
  return {
    decision: {
      status:
        validated > 0 && nonNull.every((v) => typeof v === "string" || v instanceof Date)
          ? "temporal"
          : "nominal",
      parser: null,
      parserKey: "lite:position",
      kind: null,
      precision: null,
      evidence: [],
      nonNullCount: nonNull.length,
      validatedCount: validated,
      failedCount: nonNull.length - validated,
      candidates: [],
    },
    semantic,
    valid,
  };
}

export function positionValuesToNumeric(
  values: readonly CellValue[],
  conversion: PositionConversionContext,
): ConvertedPositionValues {
  const parsed = parseDetachedValues(values, conversion);
  const temporal =
    !conversion.forcedNonTemporal &&
    (conversion.parser !== "auto" ||
      parsed.decision.status === "temporal" ||
      conversion.requestedKind === "time" ||
      conversion.requestedKind === "monthDay");
  let numeric = conversion.forcedNonTemporal
    ? cellsToQuantitative(values)
    : temporal
      ? parsed.semantic.slice()
      : cellsToNumeric(values);
  if (temporal) {
    // Stats, trained domains, annotations, and public axis formatters may
    // already hold semantic epoch milliseconds. A concrete source parser is
    // for source-shaped strings; it must not reject finite semantic numbers.
    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      if (
        typeof value === "number" &&
        Number.isFinite(value) &&
        !Number.isFinite(numeric[index]!)
      ) {
        numeric[index] = value;
      }
    }
  }
  // scale_*_time: portable numbers are seconds since midnight (#831).
  if (conversion.requestedKind === "time") {
    numeric = mapToTimeOfDayMs(values, numeric);
  }
  // monthDay: portable numbers are instants, projected onto the reference year.
  if (conversion.requestedKind === "monthDay") {
    numeric = mapToMonthDayMs(numeric);
  }
  return { values: numeric, decision: parsed.decision };
}

export function positionValueToNumber(
  value: CellValue,
  conversion: PositionConversionContext,
): number {
  return positionValuesToNumeric([value], conversion).values[0] ?? Number.NaN;
}

/** Convert one detached semantic value (for example an annotation intercept)
 * to the same scale space used by transformed frame columns and training. */
export function positionValueToScaleSpace(
  value: CellValue,
  conversion: PositionConversionContext,
  transform: ColumnTransformConfig | undefined,
): number {
  const numeric = positionValueToNumber(value, conversion);
  if (transform === undefined) return numeric;
  return transform.transform.valid(numeric) ? transform.transform.forward(numeric) : Number.NaN;
}

function requestsTemporalPosition(config: PositionScaleSpec): boolean {
  return (
    config.type === "time" ||
    config.parse !== undefined ||
    config.temporalKind !== undefined ||
    config.timezone !== undefined ||
    config.disambiguation !== undefined ||
    config.parseFailure !== undefined ||
    config.dateBreaks !== undefined ||
    config.dateMinorBreaks !== undefined ||
    config.dateLabels !== undefined ||
    config.locale !== undefined ||
    config.weekStart !== undefined
  );
}

export function positionConversionContext(
  config: PositionScaleSpec | undefined,
): PositionConversionContext {
  if (config === undefined) return AUTO_POSITION_CONVERSION;
  if (config.type === "band") return DISCRETE_POSITION_CONVERSION;
  const requestedTime = requestsTemporalPosition(config);
  const forcedNonTemporal =
    (config.type === "linear" || config.type === "log" || config.type === "binned") &&
    !requestedTime;
  // A month-day axis reads month-day values, so `md` is its natural parser
  // rather than something the author has to remember to name. `auto` would
  // read "04-05" as a category and never reach the temporal path at all.
  const parser = config.parse ?? (config.temporalKind === "monthDay" ? "md" : "auto");
  return {
    parser,
    sourceParser: parser,
    options: {
      ...(config.timezone !== undefined && { timezone: config.timezone }),
      ...(config.disambiguation !== undefined && {
        disambiguation: config.disambiguation,
      }),
      ...(config.parseFailure !== undefined && { failurePolicy: config.parseFailure }),
      ...(forcedNonTemporal && { inferTemporal: false }),
    },
    requestedTime,
    ...(config.temporalKind !== undefined && { requestedKind: config.temporalKind }),
    forcedDiscrete: false,
    forcedNonTemporal,
  };
}

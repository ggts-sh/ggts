/**
 * Lean (polyfill-free) column parsing for the render entry.
 *
 * Internal seam between the render pipeline and {@link ColumnTable}: the table
 * consumes only the narrow surface below — every lower-level classifier stays
 * module-private.
 */
import type { TemporalParserSpec } from "@ggts-sh/spec";

import { cellsToNumeric, cellsToQuantitative } from "./table-coerce.js";
import { isIsoLikeString, isoHasClock } from "./iso-epoch.js";
import { getTemporalRuntime, temporalRuntimeGeneration } from "./temporal-runtime.js";
import type { CellValue, FieldType, ParsedColumnOptions, ParsedColumnView } from "./table-types.js";

function parsedOptionsKey(options: ParsedColumnOptions): string {
  return [
    options.timezone ?? "UTC",
    options.disambiguation ?? "reject",
    options.failurePolicy ?? "error",
    options.inferTemporal === false ? "numeric-only" : "infer-temporal",
  ].join("|");
}

function parsedRequestKey(
  parser: TemporalParserSpec | "auto",
  options: ParsedColumnOptions,
): string {
  const runtime = getTemporalRuntime();
  let parserPart = "auto";
  if (parser !== "auto") {
    parserPart = runtime === null ? JSON.stringify(parser) : runtime.parserKey(parser);
  }
  // Include runtime generation so lite→full install does not reuse lean caches.
  return `${parserPart}|rt${String(temporalRuntimeGeneration())}|${parsedOptionsKey(options)}`;
}

/** Polyfill-free auto parse for the lean render entry. */
function parseLiteColumn(
  raw: readonly CellValue[],
  parser: TemporalParserSpec | "auto",
  options: ParsedColumnOptions,
): {
  decision: ParsedColumnView["decision"];
  semantic: Float64Array;
  valid: Uint8Array;
  kind: ParsedColumnView["temporalKind"];
  precision: ParsedColumnView["temporalPrecision"];
} {
  if (parser !== "auto") {
    throw new Error(
      `Explicit temporal parser ${JSON.stringify(parser)} requires @ggts-sh/core (full) or @ggts-sh/core/temporal.`,
    );
  }
  const inferTemporal = options.inferTemporal !== false;
  if (!inferTemporal) {
    const { semantic, valid, nonNullCount } = fallbackNumericColumn(raw, false);
    return {
      decision: {
        status: "nominal",
        parser: null,
        parserKey: "lite:numeric-only",
        kind: null,
        precision: null,
        evidence: [],
        nonNullCount,
        validatedCount: 0,
        failedCount: 0,
        candidates: [],
      },
      semantic,
      valid,
      kind: undefined,
      precision: undefined,
    };
  }
  // Single pass: classify the column and count non-nulls. Pure number columns
  // (the competitive x/y path) and pure non-ISO string columns (color/group
  // series labels) take monomorphic fast paths that skip ISO coercion.
  const classification = classifyLiteColumn(raw);
  const {
    nonNullCount,
    isoCount,
    stringCount,
    sawClock,
    sawNumber,
    blockingNonString,
    allNumberOrNull,
  } = classification;

  if (allNumberOrNull) {
    const { semantic, valid } = pureNumberSemantic(raw);
    return {
      decision: {
        status: "nominal",
        parser: null,
        // Distinct key so fieldType can classify without re-scanning (and
        // without a first-cell probe that mis-types Date / mixed columns).
        parserKey: "lite:numbers",
        kind: null,
        precision: null,
        evidence: [],
        nonNullCount,
        validatedCount: 0,
        failedCount: 0,
        candidates: [],
      },
      semantic,
      valid,
      kind: undefined,
      precision: undefined,
    };
  }

  // Detect ISO-like string columns without the Temporal polyfill.
  // Every non-null cell must be an ISO-like string (or a finite Date); a
  // mixed column such as ["2024-01-01", 5] must not become temporal — numbers
  // would coerce to epoch ms near 1970 (parity with inferFieldType lean path
  // and the full temporal runtime, which fails non-ISO cells).
  // `sawNumber` is the original blockingNonString path for numbers, kept
  // separate so pure-number columns can take the monomorphic fast path above.
  const temporal = !blockingNonString && !sawNumber && stringCount > 0 && isoCount === stringCount;
  if (!temporal) {
    // Pure non-ISO *label* strings (series names): semantic is all-NaN — skip
    // cellsToNumeric. Numeric text ("10") is NOT a label path.
    const { semantic, valid, parserKey } = nonTemporalLiteColumn(raw, classification);
    return {
      decision: {
        status: "nominal",
        parser: null,
        // lite:labels = pure non-ISO strings; lite:auto = mixed / numeric-text
        // (fieldType must fall back to nonTemporalFieldType for the latter).
        parserKey,
        kind: null,
        precision: null,
        evidence: [],
        nonNullCount,
        validatedCount: 0,
        failedCount: 0,
        candidates: [],
      },
      semantic,
      valid,
      kind: undefined,
      precision: undefined,
    };
  }
  const semantic = cellsToNumeric(raw);
  const valid = new Uint8Array(raw.length);
  let validatedCount = 0;
  for (let index = 0; index < semantic.length; index++) {
    if (Number.isFinite(semantic[index]!)) {
      valid[index] = 1;
      validatedCount++;
    }
  }
  const kind = sawClock ? "datetime" : "date";
  const precision = sawClock ? "second" : "date";
  // Evidence is a short sample of non-null raw cells (not a full filter copy).
  const evidence: (string | number | boolean | null)[] = [];
  for (let i = 0; i < raw.length && evidence.length < 5; i++) {
    const value = raw[i]!;
    if (value !== null) evidence.push(value as string | number | boolean | null);
  }
  return {
    decision: {
      status: "temporal",
      parser: "iso",
      parserKey: "lite:iso",
      kind,
      precision,
      evidence,
      nonNullCount,
      validatedCount,
      failedCount: nonNullCount - validatedCount,
      candidates: ["iso"],
    },
    semantic,
    valid,
    kind,
    precision,
  };
}

function nonTemporalLiteColumn(
  raw: readonly CellValue[],
  classification: LiteColumnClassification,
): { semantic: Float64Array; valid: Uint8Array; parserKey: "lite:labels" | "lite:auto" } {
  const {
    blockingNonString,
    sawNumber,
    sawNumericLookingString,
    stringCount,
    isoCount,
    nonNullCount,
  } = classification;
  const pureNonIsoLabelStrings =
    !blockingNonString &&
    !sawNumber &&
    !sawNumericLookingString &&
    stringCount > 0 &&
    isoCount === 0 &&
    stringCount === nonNullCount;
  const { semantic, valid } = pureNonIsoLabelStrings
    ? allInvalidSemantic(raw.length)
    : fallbackNumericColumn(raw, true);
  return { semantic, valid, parserKey: pureNonIsoLabelStrings ? "lite:labels" : "lite:auto" };
}

type LiteColumnClassification = {
  nonNullCount: number;
  isoCount: number;
  stringCount: number;
  sawClock: boolean;
  sawNumber: boolean;
  sawNumericLookingString: boolean;
  blockingNonString: boolean;
  allNumberOrNull: boolean;
};

function classifyLiteColumn(raw: readonly CellValue[]): LiteColumnClassification {
  let nonNullCount = 0;
  let isoCount = 0;
  let stringCount = 0;
  let sawClock = false;
  let sawNumber = false;
  let sawNumericLookingString = false;
  let blockingNonString = false;
  let allNumberOrNull = true;
  for (const value of raw) {
    if (value === null) continue;
    nonNullCount++;
    if (typeof value === "number") {
      sawNumber = true;
      continue;
    }
    allNumberOrNull = false;
    if (typeof value === "string") {
      stringCount++;
      if (isIsoLikeString(value)) {
        isoCount++;
        if (isoHasClock(value)) sawClock = true;
      } else if (stringLooksNumeric(value)) {
        sawNumericLookingString = true;
      }
      continue;
    }
    if (value instanceof Date && Number.isFinite(value.getTime())) continue;
    blockingNonString = true;
  }
  return {
    nonNullCount,
    isoCount,
    stringCount,
    sawClock,
    sawNumber,
    sawNumericLookingString,
    blockingNonString,
    allNumberOrNull,
  };
}

/** Number-or-null columns: direct Float64 copy, no ISO/string branches. */
function pureNumberSemantic(raw: readonly CellValue[]): {
  semantic: Float64Array;
  valid: Uint8Array;
} {
  const semantic = new Float64Array(raw.length);
  const valid = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) {
    const value = raw[index]!;
    if (typeof value === "number") {
      semantic[index] = value;
      if (Number.isFinite(value)) valid[index] = 1;
    } else {
      semantic[index] = Number.NaN;
    }
  }
  return { semantic, valid };
}

/** Nominal string labels: all-invalid semantic (no per-cell coercion). */
function allInvalidSemantic(length: number): { semantic: Float64Array; valid: Uint8Array } {
  const semantic = new Float64Array(length);
  semantic.fill(Number.NaN);
  return { semantic, valid: new Uint8Array(length) };
}

/**
 * True when a non-ISO string might still coerce via Number() (CSV-ish numeric
 * text). Labels like "s0" / "series-1" are false (letter first after trim).
 */
function stringLooksNumeric(value: string): boolean {
  const first = value.codePointAt(0);
  // Most nominal labels start with printable ASCII ("s0", "series-1").
  // Decide those without allocating a trimmed copy; keep the full trim path
  // for leading whitespace and non-ASCII input.
  if (first !== undefined && first > 0x20 && first < 0x7f) {
    return (first >= 48 && first <= 57) || first === 43 || first === 45 || first === 46;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  const c0 = trimmed.codePointAt(0);
  if (c0 === undefined) return false;
  // digit, '+', '-', '.'
  return (c0 >= 48 && c0 <= 57) || c0 === 43 || c0 === 45 || c0 === 46;
}

/**
 * Map monomorphic lean parse keys to field types without re-scanning.
 * Returns null for `lite:auto` (mixed / numeric-text / Dates) so the caller
 * runs {@link nonTemporalFieldType} — a first-cell probe would mis-type pure
 * Date columns as nominal and mixed number/text as quantitative (#1477 review).
 */
function fieldTypeFromLiteDecision(decision: ParsedColumnView["decision"]): FieldType | null {
  switch (decision.parserKey) {
    case "lite:numbers":
    case "lite:numeric-only":
      return "quantitative";
    case "lite:labels":
      return "nominal";
    default:
      return null;
  }
}

function fallbackNumericColumn(
  raw: readonly CellValue[],
  inferTemporal: boolean,
): { semantic: Float64Array; valid: Uint8Array; nonNullCount: number } {
  const semantic = inferTemporal ? cellsToNumeric(raw) : cellsToQuantitative(raw);
  const valid = new Uint8Array(raw.length);
  let nonNullCount = 0;
  for (let index = 0; index < semantic.length; index++) {
    if (raw[index] !== null) nonNullCount++;
    if (Number.isFinite(semantic[index]!)) valid[index] = 1;
  }
  return { semantic, valid, nonNullCount };
}

export {
  parsedOptionsKey,
  parsedRequestKey,
  parseLiteColumn,
  fallbackNumericColumn,
  fieldTypeFromLiteDecision,
};

/**
 * Temporal parse foundation: public types/schema, calendar parts→epoch conversion,
 * timezone validation, and shared Temporal implementation.
 *
 * Engines: temporal-parse-format.ts (exact format), temporal-parse.ts (named parsers + dispatcher).
 * Facade: temporal.ts.
 *
 * **No static import of `@js-temporal/polyfill` here.** Lean render graphs import this
 * module for ISO/UTC calendar math and config errors without paying the polyfill.
 * Full temporal installs register the polyfill via {@link registerTemporalPolyfill}
 * (`temporal-polyfill.ts` → `ensureTemporalPolyfill`).
 */

/**
 * Runtime Temporal namespace shape (native or `@js-temporal/polyfill`).
 * Type-only import path — no runtime edge to the polyfill package.
 */
export type TemporalNamespace = (typeof import("@js-temporal/polyfill"))["Temporal"];

let registeredPolyfill: TemporalNamespace | null = null;

/** Wire `@js-temporal/polyfill` (or a test double). Called from temporal-polyfill.ts. */
export function registerTemporalPolyfill(impl: TemporalNamespace): void {
  registeredPolyfill = impl;
}

export const TEMPORAL_PARSER_NAMES = [
  "iso",
  "year",
  "ym",
  "my",
  "yq",
  "md",
  "ymd",
  "ydm",
  "mdy",
  "myd",
  "dmy",
  "dym",
  "ymd_hm",
  "ymd_hms",
  "ydm_hm",
  "ydm_hms",
  "mdy_hm",
  "mdy_hms",
  "myd_hm",
  "myd_hms",
  "dmy_hm",
  "dmy_hms",
  "dym_hm",
  "dym_hms",
] as const;

export type TemporalParserName = (typeof TEMPORAL_PARSER_NAMES)[number];

/** Portable temporal parser: named engine, exact format, or epoch unit. */
export type TemporalParserSpec =
  | TemporalParserName
  | { readonly format: string }
  | { readonly epoch: "seconds" | "milliseconds" };
/**
 * Temporal precision for position/time scales.
 * - `date` — calendar day (UTC)
 * - `datetime` — full instant
 * - `time` — time-of-day only (`scale_x_time` / `scale_y_time`; portable
 *   numbers are **seconds since midnight**, mapped to epoch ms on 1970-01-01Z)
 */
export type TemporalKind = "date" | "datetime" | "time";

/**
 * What a position scale asks a temporal axis to mean.
 *
 * Wider than {@link TemporalKind} by `"monthDay"`, and deliberately a separate
 * type: `TemporalKind` is also the *result* of parsing a value, and no value
 * ever parses to `"monthDay"` — it is a projection a scale applies afterwards.
 * Keeping them apart lets the compiler hold that line.
 */
export type TemporalScaleKind = TemporalKind | "monthDay";

/**
 * Year that month-day values resolve into (`md` parser, `monthDay` scales).
 *
 * A leap year, so 29 February is representable — `validateParts` rejects it
 * anywhere else. Callers should treat this as opaque: it exists so month-days
 * from different years share one instant, and it is never shown to a reader.
 */
export const MONTH_DAY_REFERENCE_YEAR = 2000;
export type TemporalPrecision =
  | "year"
  | "quarter"
  | "month"
  | "date"
  | "minute"
  | "second"
  | "millisecond";
export type TemporalDisambiguation = "compatible" | "earlier" | "later" | "reject";

export interface TemporalParseOptions {
  timezone?: string;
  disambiguation?: TemporalDisambiguation;
}

export type TemporalParseResult =
  | {
      ok: true;
      epochMs: number;
      kind: TemporalKind;
      precision: TemporalPrecision;
    }
  | { ok: false; reason: string };

export class TemporalParseError extends Error {
  readonly parser: TemporalParserSpec;
  readonly value: unknown;

  constructor(parser: TemporalParserSpec, value: unknown, reason: string) {
    super(
      `Could not parse ${JSON.stringify(value)} with temporal parser ${JSON.stringify(parser)}: ${reason}`,
    );
    this.name = "TemporalParseError";
    this.parser = parser;
    this.value = value;
  }
}

/** @internal Shared calendar fields for named and exact-format engines. */
export interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

export const DEFAULT_PARTS: Omit<DateParts, "year"> = {
  month: 1,
  day: 1,
  hour: 0,
  minute: 0,
  second: 0,
  millisecond: 0,
};

/** @internal Shared fail result for parse engines and column inference. */
export function temporalParseFailure(reason: string): TemporalParseResult {
  return { ok: false, reason };
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function validateParts(parts: DateParts): string | null {
  if (!integerInRange(parts.year, 0, 9999)) {
    return "year must be an integer from 0000 through 9999";
  }
  if (!integerInRange(parts.month, 1, 12)) {
    return "month must be from 1 through 12";
  }
  const maxDay = daysInMonth(parts.year, parts.month);
  if (!integerInRange(parts.day, 1, maxDay)) {
    return `day must be from 1 through ${maxDay} for this month`;
  }
  if (!integerInRange(parts.hour, 0, 23)) {
    return "hour must be from 0 through 23";
  }
  if (!integerInRange(parts.minute, 0, 59)) {
    return "minute must be from 0 through 59";
  }
  if (!integerInRange(parts.second, 0, 59)) {
    return "second must be from 0 through 59";
  }
  if (!integerInRange(parts.millisecond, 0, 999)) {
    return "millisecond must be from 0 through 999";
  }
  return null;
}

function integerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

function utcEpoch(parts: DateParts): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond);
  return date.getTime();
}

function parseOffset(offset: string): number | null {
  if (offset === "Z") return 0;
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(offset);
  if (match === null) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59) return null;
  const total = (hours * 60 + minutes) * 60_000;
  return match[1] === "+" ? total : -total;
}

/**
 * Native-first Temporal implementation for spec-owned calendar semantics.
 * Returns `globalThis.Temporal` when present, else the polyfill registered via
 * {@link registerTemporalPolyfill}. Throws when neither is available — lean
 * render never reaches this for pure numeric/UTC-ISO identity charts.
 */
export function temporalImplementation(): TemporalNamespace {
  const nativeTemporal = (globalThis as typeof globalThis & { Temporal?: TemporalNamespace })
    .Temporal;
  if (nativeTemporal !== undefined) return nativeTemporal;
  if (registeredPolyfill !== null) return registeredPolyfill;
  throw new Error(
    "Temporal is not available. Import @ggts-sh/core (full) or @ggts-sh/core/temporal, or call ensureTemporalPolyfill() from @ggts-sh/spec.",
  );
}

/** True when native Temporal or a registered polyfill can run calendar ops. */
function hasTemporalImplementation(): boolean {
  if ((globalThis as typeof globalThis & { Temporal?: TemporalNamespace }).Temporal !== undefined) {
    return true;
  }
  return registeredPolyfill !== null;
}

/** Allocation-free UTC aliases — same three names as partsToEpoch. */
const UTC_TIMEZONE_ALIASES = new Set(["UTC", "Etc/UTC", "Z"]);

/**
 * null = valid zone; TemporalParseResult = memoized failure for invalid zones.
 * Avoids per-row array allocation on the alias check and per-row failure objects
 * when the same invalid zone is checked across a column parse.
 */
const TIMEZONE_VALIDITY_CACHE = new Map<string, TemporalParseResult | null>();

export function timezoneValidationFailure(
  timezone: string | undefined,
): TemporalParseResult | null {
  if (timezone === undefined || UTC_TIMEZONE_ALIASES.has(timezone)) return null;
  // Do not cache "no Temporal" as zone invalidity — ensureTemporalPolyfill may
  // register later in the same process (tests / late install).
  if (!hasTemporalImplementation()) {
    return temporalParseFailure(
      `timezone ${JSON.stringify(timezone)} requires Temporal (import @ggts-sh/core or @ggts-sh/core/temporal)`,
    );
  }
  const cached = TIMEZONE_VALIDITY_CACHE.get(timezone);
  if (cached !== undefined) return cached;

  let valid = true;
  try {
    const Temporal = temporalImplementation();
    Temporal.ZonedDateTime.from({
      timeZone: timezone,
      year: 2000,
      month: 1,
      day: 1,
      hour: 12,
    });
  } catch {
    valid = false;
  }
  if (TIMEZONE_VALIDITY_CACHE.size >= 64) {
    const oldest = TIMEZONE_VALIDITY_CACHE.keys().next().value;
    if (oldest !== undefined) TIMEZONE_VALIDITY_CACHE.delete(oldest);
  }
  const result = valid
    ? null
    : temporalParseFailure(`invalid or unsupported timezone ${JSON.stringify(timezone)}`);
  TIMEZONE_VALIDITY_CACHE.set(timezone, result);
  return result;
}

export function partsToEpoch(
  parts: DateParts,
  options: TemporalParseOptions,
  offset: string | undefined,
  kind: TemporalKind,
): TemporalParseResult {
  const invalid = validateParts(parts);
  if (invalid !== null) return temporalParseFailure(invalid);

  if (offset !== undefined) {
    const offsetMs = parseOffset(offset);
    if (offsetMs === null) return temporalParseFailure("invalid UTC offset");
    const epochMs = utcEpoch(parts) - offsetMs;
    return Number.isFinite(epochMs)
      ? { ok: true, epochMs, kind: "datetime", precision: "second" }
      : temporalParseFailure("instant is outside the supported range");
  }

  // Calendar dates are timezone-free values. Keep them on UTC calendar
  // boundaries so ticks preserve their represented date.
  const timezone = kind === "date" || kind === "time" ? "UTC" : (options.timezone ?? "UTC");
  if (UTC_TIMEZONE_ALIASES.has(timezone)) {
    const epochMs = utcEpoch(parts);
    return Number.isFinite(epochMs)
      ? { ok: true, epochMs, kind: "date", precision: "date" }
      : temporalParseFailure("instant is outside the supported range");
  }

  try {
    const Temporal = temporalImplementation();
    const plain = Temporal.PlainDateTime.from(parts);
    const zoned = plain.toZonedDateTime(timezone, {
      disambiguation: options.disambiguation ?? "reject",
    });
    const epochMs = zoned.epochMilliseconds;
    return Number.isFinite(epochMs)
      ? { ok: true, epochMs, kind: "datetime", precision: "millisecond" }
      : temporalParseFailure("instant is outside the supported range");
  } catch (error) {
    return temporalParseFailure(
      error instanceof Error ? error.message : "invalid timezone or local time",
    );
  }
}

export function withMetadata(
  result: TemporalParseResult,
  kind: TemporalKind,
  precision: TemporalPrecision,
): TemporalParseResult {
  return result.ok ? { ...result, kind, precision } : result;
}

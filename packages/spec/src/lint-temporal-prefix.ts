/**
 * Layer lint rule: sparse-temporal-prefix (issue #1964) — a layer mapping a
 * temporal x column whose earliest distinct timestamp `x[0]` accounts for at
 * most 10% of valid rows and sits >= 5 calendar years and >= 3x the median
 * remaining spacing ahead of `x[1]`.
 *
 * Orchestrator: lint.ts. Catalog: lint-catalog.ts.
 */
import type { SpecAdvisory } from "./lint.js";
import type { Aes, CellValue, PositionScaleSpec } from "./schema.js";
import { parseTemporalColumn, type ParsedTemporalColumn } from "./temporal-column.js";
import {
  parseTemporal,
  type TemporalKind,
  type TemporalParseOptions,
  type TemporalParserSpec,
} from "./temporal-parse.js";
import { scaleRequestsTime } from "./validate-data-checks-position.js";
import { temporalParserUsable } from "./validate-data-checks-temporal.js";
import {
  effectiveChannel,
  type FieldEvidenceEntry,
  type FieldEvidenceMap,
} from "./validate-data.js";
import { isRecord } from "./validate-structure-layer-shared.js";

const MIN_DISTINCT_VALUES = 5;
const MIN_GAP_RATIO = 3;
const MAX_PREFIX_ROW_SHARE_DENOM = 10;
const DAY_MS = 86_400_000;
const GREGORIAN_YEAR_DAYS = 365.2425;
const GREGORIAN_MONTH_DAYS = 30.436875;
const UTC_TIMEZONE_ALIASES = new Set(["UTC", "Etc/UTC", "Z"]);

interface PinnedDomain {
  bounds: readonly [number, number];
  rawBounds: readonly [unknown, unknown];
}

interface TemporalXScaleConfig {
  requestsTime: boolean;
  parser: TemporalParserSpec | "auto";
  parseOptions: TemporalParseOptions;
  allowCensor: boolean;
  pinnedDomain: PinnedDomain | null;
  oob: "censor" | "squish";
}

interface PrefixHit {
  rowsAtX0: number;
  totalValid: number;
  leadingGapMs: number;
  medianGapMs: number;
  rawX0: string | number;
  rawX1: string | number;
  rawXLast: string | number;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function addFiveUtcYears(epochMs: number): number {
  const date = new Date(epochMs);
  const targetYear = date.getUTCFullYear() + 5;
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const clampedDay = month === 1 && day === 29 && !isLeapYear(targetYear) ? 28 : day;
  const shifted = new Date(0);
  shifted.setUTCFullYear(targetYear, month, clampedDay);
  shifted.setUTCHours(
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  );
  return shifted.getTime();
}

function localDateTimeKey(epochMs: number, formatter: Intl.DateTimeFormat): string {
  const parts = formatter.formatToParts(epochMs);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const ms = String(((Math.trunc(epochMs) % 1000) + 1000) % 1000).padStart(3, "0");
  return `${get("year").padStart(4, "0")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}.${ms}`;
}

function meetsFiveZonedYears(x0: number, x1: number, timezone: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const k0 = localDateTimeKey(x0, formatter);
    const k1 = localDateTimeKey(x1, formatter);
    const year0 = Number(k0.slice(0, 4)) + 5;
    const monthDay0 = k0.slice(5, 10);
    const clampedMonthDay = monthDay0 === "02-29" && !isLeapYear(year0) ? "02-28" : monthDay0;
    const target = `${String(year0).padStart(4, "0")}-${clampedMonthDay}${k0.slice(10)}`;
    return k1 >= target;
  } catch {
    return x1 >= addFiveUtcYears(x0);
  }
}

function meetsFiveCalendarYears(
  x0: number,
  x1: number,
  timezone: string | undefined,
  kind: TemporalKind | null,
): boolean {
  if (kind === "date" || timezone === undefined || UTC_TIMEZONE_ALIASES.has(timezone)) {
    return x1 >= addFiveUtcYears(x0);
  }
  return meetsFiveZonedYears(x0, x1, timezone);
}

function formatUnit(value: number, singular: string, plural: string): string {
  return value === 1 ? `1 ${singular}` : `${value} ${plural}`;
}

function formatDuration(ms: number): string {
  const days = ms / DAY_MS;
  if (days >= 365) {
    const years = Math.max(1, Math.round((days / GREGORIAN_YEAR_DAYS) * 10) / 10);
    return formatUnit(years, "year", "years");
  }
  if (days >= 28) {
    const months = Math.max(1, Math.round(days / GREGORIAN_MONTH_DAYS));
    return formatUnit(months, "month", "months");
  }
  if (days >= 1) {
    return formatUnit(Math.round(days * 10) / 10, "day", "days");
  }
  const hours = ms / 3_600_000;
  if (hours >= 1) {
    return formatUnit(Math.round(hours * 10) / 10, "hour", "hours");
  }
  const minutes = ms / 60_000;
  if (minutes >= 1) {
    return formatUnit(Math.round(minutes * 10) / 10, "minute", "minutes");
  }
  return formatUnit(Math.max(0, Math.round(ms / 1000)), "second", "seconds");
}

function formatTemporalValue(
  epochMs: number,
  raw: CellValue | Date | undefined,
  parser: TemporalParserSpec | "auto",
): string | number {
  if (typeof raw === "string") return raw;
  if (typeof parser === "object" && "epoch" in parser) {
    if (typeof raw === "number") return raw;
    return parser.epoch === "seconds" ? epochMs / 1000 : epochMs;
  }
  if (typeof raw === "number" && parser !== "auto" && parser !== "iso") {
    return raw;
  }
  if (raw instanceof Date && parser !== "auto" && parser !== "iso") {
    return epochMs;
  }
  const date = new Date(epochMs);
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  ) {
    return date.toISOString().slice(0, 10);
  }
  return date.toISOString().replace(/\.000Z$/, "Z");
}

function parseDomainBound(
  bound: unknown,
  parser: TemporalParserSpec | "auto",
  options: TemporalParseOptions,
): number {
  if (typeof bound === "number") {
    if (!Number.isFinite(bound)) return Number.NaN;
    if (typeof parser === "object" && "epoch" in parser) {
      const result = parseTemporal(bound, parser, options);
      return result.ok ? result.epochMs : Number.NaN;
    }
    return bound;
  }
  if (bound instanceof Date) {
    const ms = bound.getTime();
    return Number.isFinite(ms) ? ms : Number.NaN;
  }
  if (typeof bound !== "string") return Number.NaN;
  if (parser !== "auto") {
    const result = parseTemporal(bound, parser, options);
    return result.ok ? result.epochMs : Number.NaN;
  }
  const column = parseTemporalColumn([bound], "auto", options);
  return column.valid[0] === 1 ? column.semantic[0]! : Number.NaN;
}

function resolvePinnedDomain(
  xScale: PositionScaleSpec | undefined,
  parser: TemporalParserSpec | "auto",
  options: TemporalParseOptions,
): PinnedDomain | null {
  const domain = xScale?.domain;
  if (!Array.isArray(domain) || domain.length !== 2) return null;
  const b0 = parseDomainBound(domain[0], parser, options);
  const b1 = parseDomainBound(domain[1], parser, options);
  if (!Number.isFinite(b0) || !Number.isFinite(b1)) return null;
  return b0 <= b1
    ? { bounds: [b0, b1], rawBounds: [domain[0], domain[1]] }
    : { bounds: [b1, b0], rawBounds: [domain[1], domain[0]] };
}

function resolveScaleParseOptions(xScale: PositionScaleSpec): TemporalParseOptions {
  return {
    ...(typeof xScale.timezone === "string" && { timezone: xScale.timezone }),
    ...(typeof xScale.disambiguation === "string" && { disambiguation: xScale.disambiguation }),
  };
}

function resolveTemporalXScaleConfig(
  scales: Record<string, unknown> | undefined,
): TemporalXScaleConfig | null {
  const rawXScale = scales?.["x"];
  if (rawXScale !== undefined && !isRecord(rawXScale)) return null;
  const requestsTime = scaleRequestsTime(scales, "x");
  if (rawXScale === undefined) {
    return {
      requestsTime,
      parser: "auto",
      parseOptions: {},
      allowCensor: false,
      pinnedDomain: null,
      oob: "censor",
    };
  }
  const xScale = rawXScale as PositionScaleSpec;
  if (xScale.type === "band") return null;
  if (!requestsTime && xScale.type !== undefined) return null;
  if (xScale.temporalKind === "monthDay" || xScale.temporalKind === "time") return null;
  if (!temporalParserUsable(xScale.parse)) return null;

  const parser: TemporalParserSpec | "auto" = xScale.parse ?? "auto";
  const parseOptions = resolveScaleParseOptions(xScale);
  const allowCensor = xScale.parse !== undefined && xScale.parseFailure === "censor";
  const pinnedDomain = resolvePinnedDomain(xScale, parser, parseOptions);
  const oob = xScale.oob === "squish" ? "squish" : "censor";
  return { requestsTime, parser, parseOptions, allowCensor, pinnedDomain, oob };
}

function applyDomainPolicy(
  epoch: number,
  pinned: PinnedDomain | null,
  oob: "censor" | "squish",
): { epoch: number; clamped: boolean; clampedRaw: unknown; dropped: boolean } {
  if (pinned === null) return { epoch, clamped: false, clampedRaw: undefined, dropped: false };
  const [lo, hi] = pinned.bounds;
  if (oob === "squish") {
    if (epoch < lo) {
      return { epoch: lo, clamped: true, clampedRaw: pinned.rawBounds[0], dropped: false };
    }
    if (epoch > hi) {
      return { epoch: hi, clamped: true, clampedRaw: pinned.rawBounds[1], dropped: false };
    }
    return { epoch, clamped: false, clampedRaw: undefined, dropped: false };
  }
  if (epoch < lo || epoch > hi) {
    return { epoch, clamped: false, clampedRaw: undefined, dropped: true };
  }
  return { epoch, clamped: false, clampedRaw: undefined, dropped: false };
}

function isUsableRawBound(value: unknown): value is string | number | Date {
  return typeof value === "string" || typeof value === "number" || value instanceof Date;
}

function accumulateCounts(
  values: readonly CellValue[],
  parsed: ParsedTemporalColumn,
  config: TemporalXScaleConfig,
): {
  counts: Map<number, number>;
  firstRaw: Map<number, CellValue | Date>;
  totalValid: number;
} {
  const counts = new Map<number, number>();
  const firstRaw = new Map<number, CellValue | Date>();
  const clampedKeys = new Set<number>();
  let totalValid = 0;

  for (let index = 0; index < values.length; index++) {
    if (parsed.valid[index] !== 1) continue;
    const rawEpoch = parsed.semantic[index]!;
    if (!Number.isFinite(rawEpoch)) continue;
    const adjusted = applyDomainPolicy(rawEpoch, config.pinnedDomain, config.oob);
    if (adjusted.dropped) continue;
    const key = adjusted.epoch === 0 ? 0 : adjusted.epoch;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!adjusted.clamped) {
      if (!firstRaw.has(key) || clampedKeys.has(key)) {
        firstRaw.set(key, values[index]!);
        clampedKeys.delete(key);
      }
    } else if (!firstRaw.has(key) && isUsableRawBound(adjusted.clampedRaw)) {
      firstRaw.set(key, adjusted.clampedRaw);
      clampedKeys.add(key);
    }
    totalValid++;
  }

  return { counts, firstRaw, totalValid };
}

function medianOfRemainingGaps(sorted: readonly number[]): number {
  const gaps: number[] = [];
  for (let index = 1; index < sorted.length - 1; index++) {
    gaps.push(sorted[index + 1]! - sorted[index]!);
  }
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 1 ? gaps[mid]! : (gaps[mid - 1]! + gaps[mid]!) / 2;
}

function analyzeTemporalPrefix(
  values: readonly CellValue[],
  xInfo: FieldEvidenceEntry,
  config: TemporalXScaleConfig,
): PrefixHit | null {
  if (xInfo.temporal?.status !== "temporal" && !config.requestsTime) return null;
  const parsed = parseTemporalColumn(values, config.parser, config.parseOptions);
  const accepted =
    parsed.decision.status === "temporal" ||
    (config.allowCensor &&
      parsed.decision.status === "invalid" &&
      parsed.decision.validatedCount > 0);
  if (!accepted) return null;

  const { counts, firstRaw, totalValid } = accumulateCounts(values, parsed, config);
  if (counts.size < MIN_DISTINCT_VALUES || totalValid === 0) return null;

  const sorted = [...counts.keys()].toSorted((a, b) => a - b);
  const x0 = sorted[0]!;
  const x1 = sorted[1]!;
  const xLast = sorted.at(-1)!;
  if (!meetsFiveCalendarYears(x0, x1, config.parseOptions.timezone, parsed.decision.kind)) {
    return null;
  }

  const leadingGapMs = x1 - x0;
  const medianGapMs = medianOfRemainingGaps(sorted);
  if (leadingGapMs < MIN_GAP_RATIO * medianGapMs) return null;

  const rowsAtX0 = counts.get(x0)!;
  if (rowsAtX0 * MAX_PREFIX_ROW_SHARE_DENOM > totalValid) return null;

  return {
    rowsAtX0,
    totalValid,
    leadingGapMs,
    medianGapMs,
    rawX0: formatTemporalValue(x0, firstRaw.get(x0), config.parser),
    rawX1: formatTemporalValue(x1, firstRaw.get(x1), config.parser),
    rawXLast: formatTemporalValue(xLast, firstRaw.get(xLast), config.parser),
  };
}

function buildAdvisory(index: number, xField: string, hit: PrefixHit): SpecAdvisory {
  const pct = Math.round((hit.rowsAtX0 / hit.totalValid) * 1000) / 10;
  const start = String(hit.rawX1);
  return {
    code: "sparse-temporal-prefix",
    path: `/layers/${index}/aes/x`,
    message: `Field "${xField}" on x has a sparse prefix: ${hit.rowsAtX0} of ${hit.totalValid} rows (${pct}%) are at ${String(hit.rawX0)} before ${start}, a leading gap of ${formatDuration(hit.leadingGapMs)} (median spacing ${formatDuration(hit.medianGapMs)}). Start at ${start}.`,
    suggestion: {
      description: `Pin scales.x.domain to start at ${start}, or plot the sparse prefix as its own stated outcome.`,
      example: { scales: { x: { domain: [hit.rawX1, hit.rawXLast] } } },
    },
  };
}

/**
 * Advisories for layers mapping a temporal x column with a sparse leading span.
 * Evidence is per layer (a layer's own data wins over the plot's); profile
 * evidence has no raw values, so those layers skip silently.
 */
export function collectTemporalPrefixAdvisories(
  spec: Record<string, unknown>,
  layerEvidence: readonly (FieldEvidenceMap | null)[],
  plotEvidence: FieldEvidenceMap | null,
): SpecAdvisory[] {
  const layers = spec["layers"] as unknown[];
  if (!Array.isArray(layers) || layers.length === 0) return [];

  const scales = isRecord(spec["scales"]) ? spec["scales"] : undefined;
  const config = resolveTemporalXScaleConfig(scales);
  if (config === null) return [];

  const plotAes = isRecord(spec["aes"]) ? (spec["aes"] as Aes) : undefined;
  const analysisByValues = new Map<readonly CellValue[], PrefixHit | null>();
  const emittedValues = new Set<readonly CellValue[]>();
  const advisories: SpecAdvisory[] = [];

  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index];
    if (!isRecord(layer)) continue;
    const layerAes = isRecord(layer["aes"]) ? (layer["aes"] as Aes) : undefined;
    const xMapped = effectiveChannel(plotAes, layerAes, "x");
    if (xMapped === undefined || !("field" in xMapped)) continue;

    const fields = index < layerEvidence.length ? layerEvidence[index] : plotEvidence;
    const xInfo = fields?.get(xMapped.field);
    const values = xInfo?.values;
    if (xInfo === undefined || values === null || values === undefined) continue;
    if (emittedValues.has(values)) continue;

    let hit = analysisByValues.get(values);
    if (hit === undefined) {
      hit = analyzeTemporalPrefix(values, xInfo, config);
      analysisByValues.set(values, hit);
    }
    if (hit === null) continue;

    emittedValues.add(values);
    advisories.push(buildAdvisory(index, xMapped.field, hit));
  }

  return advisories;
}

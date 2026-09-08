/**
 * Strict `dateLabels` grammar and span-uniform temporal tick label sequences.
 */
import type { TemporalInterval, TemporalScaleKind } from "@ggts-sh/spec";
import { temporalLabelConfigurationError } from "@ggts-sh/spec";

import { MONTHS_LONG, MONTHS_SHORT, pad2, pad3 } from "./format-time.js";

export interface TemporalLabelFormatOptions {
  kind: TemporalScaleKind;
  locale?: string;
  timezone?: string;
}

interface TemporalDisplayParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  monthShort: string;
  monthLong: string;
  weekdayShort: string;
  weekdayLong: string;
  dayPeriod: string;
  zoneShort: string;
  offset: string;
}

function primaryTokenValue(token: string, d: TemporalDisplayParts): string | undefined {
  switch (token) {
    case "Y":
      return String(d.year);
    case "y":
      return pad2(d.year % 100);
    case "m":
      return pad2(d.month);
    case "b":
      return d.monthShort;
    case "B":
      return d.monthLong;
    case "d":
      return pad2(d.day);
    case "e":
      return String(d.day);
    case "a":
      return d.weekdayShort;
    case "A":
      return d.weekdayLong;
    case "H":
      return pad2(d.hour);
    case "I":
      return pad2(d.hour % 12 || 12);
    case "M":
      return pad2(d.minute);
    case "S":
      return pad2(d.second);
    case "L":
      return pad3(d.millisecond);
    case "p":
      return d.dayPeriod;
    default:
      return undefined;
  }
}

function tokenValue(token: string, d: TemporalDisplayParts): string {
  const primary = primaryTokenValue(token, d);
  if (primary !== undefined) return primary;
  switch (token) {
    case "q":
      return String(Math.floor((d.month - 1) / 3) + 1);
    case "z":
      return d.offset;
    case "Z":
      return d.zoneShort;
    case "%":
      return "%";
    default:
      return "";
  }
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
const MAX_TEMPORAL_INTL_CACHE_ENTRIES = 64;
const TEMPORAL_INTL_CACHE = new Map<string, Intl.DateTimeFormat>();

function cachedDateTimeFormat(
  locale: string,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = JSON.stringify([locale, timezone, options]);
  const cached = TEMPORAL_INTL_CACHE.get(key);
  if (cached !== undefined) {
    TEMPORAL_INTL_CACHE.delete(key);
    TEMPORAL_INTL_CACHE.set(key, cached);
    return cached;
  }
  const formatter = new Intl.DateTimeFormat(locale, {
    ...options,
    calendar: "gregory",
    timeZone: timezone,
  });
  if (TEMPORAL_INTL_CACHE.size >= MAX_TEMPORAL_INTL_CACHE_ENTRIES) {
    const oldest = TEMPORAL_INTL_CACHE.keys().next().value;
    if (oldest !== undefined) TEMPORAL_INTL_CACHE.delete(oldest);
  }
  TEMPORAL_INTL_CACHE.set(key, formatter);
  return formatter;
}

function partValue(parts: readonly Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function displayParts(ms: number, options: TemporalLabelFormatOptions): TemporalDisplayParts {
  const locale = options.locale ?? "en-US";
  // date and time-of-day are wall-clock-less / fixed UTC; datetime may carry a zone.
  const configuredTimezone =
    options.kind === "date" || options.kind === "time" || options.kind === "monthDay"
      ? "UTC"
      : (options.timezone ?? "UTC");
  const timezone =
    configuredTimezone === "Z" || configuredTimezone === "Etc/UTC" ? "UTC" : configuredTimezone;
  const d = new Date(ms);
  if (locale === "en-US" && timezone === "UTC") {
    const hour = d.getUTCHours();
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour,
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      millisecond: d.getUTCMilliseconds(),
      monthShort: MONTHS_SHORT[d.getUTCMonth()]!,
      monthLong: MONTHS_LONG[d.getUTCMonth()]!,
      weekdayShort: WEEKDAYS_SHORT[d.getUTCDay()]!,
      weekdayLong: WEEKDAYS_LONG[d.getUTCDay()]!,
      dayPeriod: hour < 12 ? "AM" : "PM",
      zoneShort: "UTC",
      offset: "+0000",
    };
  }

  const numericParts = cachedDateTimeFormat(locale, timezone, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
    numberingSystem: "latn",
  }).formatToParts(ms);
  const monthShort = partValue(
    cachedDateTimeFormat(locale, timezone, { month: "short" }).formatToParts(ms),
    "month",
  );
  const monthLong = partValue(
    cachedDateTimeFormat(locale, timezone, { month: "long" }).formatToParts(ms),
    "month",
  );
  const weekdayShort = partValue(
    cachedDateTimeFormat(locale, timezone, { weekday: "short" }).formatToParts(ms),
    "weekday",
  );
  const weekdayLong = partValue(
    cachedDateTimeFormat(locale, timezone, { weekday: "long" }).formatToParts(ms),
    "weekday",
  );
  const dayPeriodParts = cachedDateTimeFormat(locale, timezone, {
    hour: "numeric",
    hourCycle: "h12",
  }).formatToParts(ms);
  const zoneShort = partValue(
    cachedDateTimeFormat("en-US", timezone, { timeZoneName: "short" }).formatToParts(ms),
    "timeZoneName",
  );
  const longOffset = partValue(
    cachedDateTimeFormat("en-US", timezone, { timeZoneName: "longOffset" }).formatToParts(ms),
    "timeZoneName",
  );
  // Intl longOffset may include seconds for historical zones (e.g. GMT+05:21:10).
  const offsetMatch = /^GMT([+-])(\d{2}):(\d{2})(?::\d{2})?$/.exec(longOffset);
  const offset =
    offsetMatch === null ? "+0000" : `${offsetMatch[1]}${offsetMatch[2]}${offsetMatch[3]}`;
  return {
    year: Number(partValue(numericParts, "year")),
    month: Number(partValue(numericParts, "month")),
    day: Number(partValue(numericParts, "day")),
    hour: Number(partValue(numericParts, "hour")),
    minute: Number(partValue(numericParts, "minute")),
    second: Number(partValue(numericParts, "second")),
    millisecond: d.getUTCMilliseconds(),
    monthShort,
    monthLong,
    weekdayShort,
    weekdayLong,
    dayPeriod: partValue(dayPeriodParts, "dayPeriod"),
    zoneShort,
    offset,
  };
}

/** Compile the strict `dateLabels` output grammar. */
export function compileTemporalLabelFormat(
  pattern: string,
  options: TemporalLabelFormatOptions,
): (ms: number) => string {
  const error = temporalLabelConfigurationError(pattern, options.kind);
  if (error !== null) throw new Error(error);
  return (ms: number) => {
    const d = displayParts(ms, options);
    let out = "";
    for (let index = 0; index < pattern.length; index++) {
      const char = pattern[index]!;
      if (char !== "%") {
        out += char;
        continue;
      }
      const token = pattern[++index]!;
      out += tokenValue(token, d);
    }
    return out.replaceAll(/[\u00A0\u202F]/g, " ");
  };
}

export interface TemporalTickLabel {
  label: string;
  fullLabel: string;
}

function yearLabel(part: TemporalDisplayParts, kind: TemporalScaleKind): string {
  if (kind === "time") return `${pad2(part.hour)}:${pad2(part.minute)}`;
  if (kind === "monthDay") return `${part.monthShort} ${String(part.day)}`;
  return String(part.year);
}

function monthLabel(
  part: TemporalDisplayParts,
  kind: TemporalScaleKind,
  multiYear: boolean,
): string {
  if (kind === "time") return `${pad2(part.hour)}:${pad2(part.minute)}`;
  return multiYear ? `${part.monthShort} ${String(part.year)}` : part.monthShort;
}

function dayLabel(part: TemporalDisplayParts, kind: TemporalScaleKind, multiYear: boolean): string {
  if (kind === "time") return `${pad2(part.hour)}:${pad2(part.minute)}`;
  return multiYear
    ? `${part.monthShort} ${String(part.day)}, ${String(part.year)}`
    : `${part.monthShort} ${String(part.day)}`;
}

function clockLabel(
  part: TemporalDisplayParts,
  kind: TemporalScaleKind,
  multiYear: boolean,
  multiDay: boolean,
): string {
  const clock = `${pad2(part.hour)}:${pad2(part.minute)}`;
  if (kind === "time" || !multiDay) return clock;
  return multiYear
    ? `${part.monthShort} ${String(part.day)}, ${String(part.year)} ${clock}`
    : `${part.monthShort} ${String(part.day)} ${clock}`;
}

function defaultTemporalLabel(
  part: TemporalDisplayParts,
  options: TemporalLabelFormatOptions & { interval: TemporalInterval },
  multiYear: boolean,
  multiDay: boolean,
): string {
  switch (options.interval.unit) {
    case "year":
      return yearLabel(part, options.kind);
    case "quarter": {
      if (options.kind === "time") return `${pad2(part.hour)}:${pad2(part.minute)}`;
      const quarter = `Q${String(Math.floor((part.month - 1) / 3) + 1)}`;
      return multiYear ? `${quarter} ${String(part.year)}` : quarter;
    }
    case "month":
      return monthLabel(part, options.kind, multiYear);
    case "week":
    case "day":
      return dayLabel(part, options.kind, multiYear);
    case "hour":
    case "minute":
      return clockLabel(part, options.kind, multiYear, multiDay);
    case "second":
      return `${pad2(part.hour)}:${pad2(part.minute)}:${pad2(part.second)}`;
    case "millisecond":
      return `${pad2(part.hour)}:${pad2(part.minute)}:${pad2(part.second)}.${pad3(part.millisecond)}`;
  }
  throw new Error(`Unsupported temporal interval unit: ${String(options.interval.unit)}`);
}

export function formatTemporalTickSequence(
  values: readonly number[],
  options: TemporalLabelFormatOptions & { interval: TemporalInterval; pattern?: string },
): TemporalTickLabel[] {
  const needsMilliseconds =
    options.interval.unit === "millisecond" || values.some((value) => Math.abs(value % 1_000) > 0);
  const full = compileTemporalLabelFormat(
    options.kind === "date"
      ? "%Y-%m-%d"
      : // monthDay values sit in a reference year that is an implementation
        // detail. fullLabel is not the visible tick, so a leak here is quiet —
        // and it reaches the guide plan.
        options.kind === "monthDay"
        ? "%b %e"
        : options.kind === "time"
          ? needsMilliseconds
            ? "%H:%M:%S.%L"
            : "%H:%M:%S"
          : needsMilliseconds
            ? "%Y-%m-%d %H:%M:%S.%L %Z"
            : "%Y-%m-%d %H:%M:%S %Z",
    options,
  );
  if (options.pattern !== undefined) {
    const visible = compileTemporalLabelFormat(options.pattern, options);
    return values.map((value) => ({ label: visible(value), fullLabel: full(value) }));
  }
  const parts = values.map((value) => displayParts(value, options));
  // Span-uniform visible labels (#962): pick one format from the whole sequence
  // so an axis never mixes full dates with bare day numbers (or month with/without year).
  // Use min/max over all parts — order may be reversed or unsorted (explicit breaks).
  let minYear = Infinity;
  let maxYear = -Infinity;
  let minDayKey = Infinity;
  let maxDayKey = -Infinity;
  for (const part of parts) {
    minYear = Math.min(minYear, part.year);
    maxYear = Math.max(maxYear, part.year);
    const dayKey = part.year * 12 * 32 + part.month * 32 + part.day;
    minDayKey = Math.min(minDayKey, dayKey);
    maxDayKey = Math.max(maxDayKey, dayKey);
  }
  const multiYear = parts.length > 0 && minYear !== maxYear;
  const multiDay = parts.length > 0 && minDayKey !== maxDayKey;
  const labels = parts.map((part) => defaultTemporalLabel(part, options, multiYear, multiDay));
  return values.map((value, index) => ({ label: labels[index]!, fullLabel: full(value) }));
}

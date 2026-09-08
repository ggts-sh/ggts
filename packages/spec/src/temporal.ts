/**
 * Temporal authoring helpers and compatibility facade.
 *
 * Implementation is split:
 *  - temporal-parse-core.ts — types/schema, calendar parts→epoch, timezone
 *  - temporal-parse-format.ts — exact-format compile cache + parse
 *  - temporal-parse.ts — named engines, parseTemporal dispatcher, public re-exports
 *  - temporal-column.ts — inferTemporalColumn / parseTemporalColumn
 *  - this file — ymd/dmy/… helpers, epoch helpers, and re-exports so existing
 *    `./temporal.js` imports stay stable.
 *
 * Public parse helpers here register the Temporal polyfill so a bundler that
 * tree-shakes `@ggts-sh/spec` for `parseTemporal` / column helpers still gets
 * non-UTC zones. Lean render never imports this facade (only portable + core
 * render, which stay free of the polyfill).
 */

import { ensureTemporalPolyfill } from "./temporal-polyfill.js";
import { parseTemporal, TemporalParseError, type TemporalParserSpec } from "./temporal-parse.js";

// Side-effect for every public temporal facade import (parseTemporal, ymd, …).
ensureTemporalPolyfill();

export {
  TEMPORAL_PARSER_NAMES,
  TemporalParserSpecSchema,
  TemporalParseError,
  canonicalTemporalParserKey,
  parseTemporal,
  temporalImplementation,
  temporalParserConfigurationError,
  type TemporalDisambiguation,
  type TemporalKind,
  type TemporalScaleKind,
  MONTH_DAY_REFERENCE_YEAR,
  type TemporalParseOptions,
  type TemporalParseResult,
  type TemporalParserName,
  type TemporalParserSpec,
  type TemporalPrecision,
} from "./temporal-parse.js";

export {
  inferTemporalColumn,
  parseTemporalColumn,
  type ParsedTemporalColumn,
  type TemporalDecision,
  type TemporalFailure,
} from "./temporal-column.js";

function convertOne(value: unknown, parser: TemporalParserSpec): Date {
  const result = parseTemporal(value, parser);
  if (!result.ok) throw new TemporalParseError(parser, value, result.reason);
  return new Date(result.epochMs);
}

function helper(parser: TemporalParserSpec) {
  function convert(value: unknown): Date;
  function convert(values: readonly unknown[]): Date[];
  function convert(value: unknown): Date | Date[] {
    return Array.isArray(value)
      ? value.map((entry) => convertOne(entry, parser))
      : convertOne(value, parser);
  }
  return convert;
}

export const ymd = helper("ymd");
export const ydm = helper("ydm");
export const mdy = helper("mdy");
export const myd = helper("myd");
export const dmy = helper("dmy");
export const dym = helper("dym");
export const ym = helper("ym");
export const my = helper("my");
export const yq = helper("yq");
export const ymd_hm = helper("ymd_hm");
export const ymd_hms = helper("ymd_hms");
export const ydm_hm = helper("ydm_hm");
export const ydm_hms = helper("ydm_hms");
export const mdy_hm = helper("mdy_hm");
export const mdy_hms = helper("mdy_hms");
export const myd_hm = helper("myd_hm");
export const myd_hms = helper("myd_hms");
export const dmy_hm = helper("dmy_hm");
export const dmy_hms = helper("dmy_hms");
export const dym_hm = helper("dym_hm");
export const dym_hms = helper("dym_hms");

export function parseTemporalFormat(value: unknown, format: string): Date;
export function parseTemporalFormat(values: readonly unknown[], format: string): Date[];
export function parseTemporalFormat(value: unknown, format: string): Date | Date[] {
  return Array.isArray(value)
    ? value.map((entry) => convertOne(entry, { format }))
    : convertOne(value, { format });
}

export function fromEpochSeconds(value: number): Date;
export function fromEpochSeconds(values: readonly number[]): Date[];
export function fromEpochSeconds(value: number | readonly number[]): Date | Date[] {
  return Array.isArray(value)
    ? value.map((entry) => convertOne(entry, { epoch: "seconds" }))
    : convertOne(value, { epoch: "seconds" });
}

export function fromEpochMilliseconds(value: number): Date;
export function fromEpochMilliseconds(values: readonly number[]): Date[];
export function fromEpochMilliseconds(value: number | readonly number[]): Date | Date[] {
  return Array.isArray(value)
    ? value.map((entry) => convertOne(entry, { epoch: "milliseconds" }))
    : convertOne(value, { epoch: "milliseconds" });
}

/**
 * `$defs` partial — scale base schemas (DomainValue…ColorScaleSpec).
 * Composed by schema-declarations.ts via spread; key insertion order is load-bearing.
 */

import Type from "typebox";
import { COLOR_SCHEME_NAME_SCHEMAS } from "./schema-name-schemas.js";
import { MAX_BINNED_BREAKS } from "./schema-names.js";
import {
  TemporalIntervalSpecSchema,
  TemporalLabelSpecSchema,
  TemporalWeekStartSchema,
} from "./temporal-interval-schema.js";
import { TemporalParserSpecSchema } from "./temporal-parse-schema.js";

const forbiddenColorOption = () => Type.Optional(Type.Never());

export const ScaleDecls = {
  DomainValue: Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()], {
    description:
      "One domain entry: a number (linear/log), an ISO 8601 date string (time), or a category value (band/ordinal).",
  }),

  TemporalParserSpec: TemporalParserSpecSchema,

  ScaleExpansion: Type.Object(
    {
      mult: Type.Optional(
        Type.Union(
          [
            Type.Number({ minimum: 0 }),
            Type.Array(Type.Number({ minimum: 0 }), { minItems: 2, maxItems: 2 }),
          ],
          {
            description:
              "Multiplicative display padding as a fraction of the (transformed) domain span. A scalar pads both ends; a [lower, upper] tuple pads each end. Non-negative and finite.",
          },
        ),
      ),
      add: Type.Optional(
        Type.Union(
          [
            Type.Number({ minimum: 0 }),
            Type.Array(Type.Number({ minimum: 0 }), { minItems: 2, maxItems: 2 }),
          ],
          {
            description:
              "Additive display padding in (transformed) scale units. A scalar pads both ends; a [lower, upper] tuple pads each end. Non-negative and finite.",
          },
        ),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Display-domain expansion. Padding is applied after nice in transformed space and never widens the OOB limits. `{ mult: 0, add: 0 }` disables padding.",
    },
  ),

  PositionScaleSpec: Type.Intersect([
    Type.Object(
      {
        type: Type.Optional(
          Type.Union(
            [
              Type.Literal("linear"),
              Type.Literal("log"),
              Type.Literal("time"),
              Type.Literal("band"),
              Type.Literal("binned"),
            ],
            {
              description:
                'Scale type: "linear" (default for numbers), "time" (temporal fields; ISO strings or Date values), "band" (discrete categories), "binned" (quantitative values assigned to ordered bins). "log" is an accepted authored alias that canonicalizes to { type: "linear", transform: "log10" }. Omit to infer from the field type.',
            },
          ),
        ),
        transform: Type.Optional(
          Type.Union([Type.Literal("identity"), Type.Literal("log10"), Type.Literal("sqrt")], {
            description:
              'Pre-stat position transform applied after parsing and before grouping-sensitive stats/positions. "identity" (default), "log10" (base-10; source values must be > 0), "sqrt" (source values must be >= 0). Only "identity" is permitted on time scales.',
          }),
        ),
        temporalKind: Type.Optional(
          Type.Union(
            [
              Type.Literal("date"),
              Type.Literal("datetime"),
              Type.Literal("time"),
              Type.Literal("monthDay"),
            ],
            {
              description:
                'Temporal precision intent. "date" uses calendar dates; "datetime" uses instants; "time" is time-of-day (portable numbers are seconds since midnight); "monthDay" collapses the year, so the same calendar day from any year shares one position — values parse with the "md" parser and resolve into a fixed leap reference year, and year, clock, weekday and zone label tokens are rejected. A month-day window cannot cross the year boundary. Supplying this option requests a time scale.',
            },
          ),
        ),
        parse: Type.Optional(
          Type.Ref("TemporalParserSpec", {
            description:
              "Explicit deterministic parser for temporal source values. Omit for value-driven inference.",
          }),
        ),
        parseFailure: Type.Optional(
          Type.Union([Type.Literal("error"), Type.Literal("censor")], {
            description:
              'Explicit parser failure policy: "error" (default) stops with bounded evidence; "censor" converts invalid values to missing and emits a warning.',
          }),
        ),
        timezone: Type.Optional(
          Type.String({
            minLength: 1,
            maxLength: 128,
            description:
              'IANA timezone used for timezone-less temporal input. Default "UTC". Invalid zones fail with an actionable diagnostic.',
          }),
        ),
        disambiguation: Type.Optional(
          Type.Union(
            [
              Type.Literal("compatible"),
              Type.Literal("earlier"),
              Type.Literal("later"),
              Type.Literal("reject"),
            ],
            {
              description:
                'DST gap/fold policy for IANA local times. Default "reject"; choose "earlier", "later", or Temporal-compatible behavior explicitly.',
            },
          ),
        ),
        dateBreaks: Type.Optional(TemporalIntervalSpecSchema),
        dateMinorBreaks: Type.Optional(TemporalIntervalSpecSchema),
        dateLabels: Type.Optional(TemporalLabelSpecSchema),
        locale: Type.Optional(
          Type.String({
            minLength: 1,
            maxLength: 128,
            description:
              'BCP 47 locale for temporal labels. Default "en-US". JSON Schema bounds the portable string shape; runtime validation canonicalizes the tag and verifies Intl support before rendering.',
          }),
        ),
        weekStart: Type.Optional(TemporalWeekStartSchema),
        domain: Type.Optional(
          Type.Array(Type.Ref("DomainValue"), {
            minItems: 1,
            description:
              "Explicit domain, PINNING the scale: [min, max] for continuous scales (numbers, or temporal strings for time); the full category list for band scales. Data outside the domain is dropped with a warning.",
          }),
        ),
        nice: Type.Optional(
          Type.Boolean({
            description:
              "Round the inferred domain to tick-friendly bounds. Default true. Ignored when `domain` is set.",
          }),
        ),
        zero: Type.Optional(
          Type.Boolean({
            description:
              "Force the domain to include zero. Bars, columns, and areas force this to true on the measure axis; set false explicitly to override. Ignored when `domain` is set.",
          }),
        ),
        reverse: Type.Optional(
          Type.Boolean({ description: "Reverse the scale's output direction. Default false." }),
        ),
        breaks: Type.Optional(
          Type.Array(Type.Union([Type.Number(), Type.String()]), {
            minItems: 1,
            description:
              "Explicit tick positions in data units (numbers, or ISO date strings for time scales); for binned scales these are the bin boundaries. Omit for automatic ticks. Binned scales allow at most 65 boundaries (64 bins); non-binned explicit ticks are not capped.",
          }),
        ),
        labels: Type.Optional(
          Type.Union(
            [
              Type.String({
                description:
                  'Tick label format string. Time scales: strftime-style ("%Y-%m", "%b %d", "%H:%M"). Numeric scales: ",d" (grouped integer), ".1f" (fixed decimals), ".0%" (percent), "~s" (SI prefix).',
              }),
              Type.Array(Type.String(), {
                minItems: 1,
                description:
                  'Author-given tick labels, as in scale_x_continuous(breaks = c(4, 14), labels = c("Group A", "Group B")). labels[i] is the text for breaks[i]; breaks must be an explicit array of the same length.',
              }),
            ],
            {
              description:
                "Tick label text: a format string, or an array of labels that names each explicit break in order. Omit for automatic formatting.",
            },
          ),
        ),
        expand: Type.Optional(
          Type.Ref("ScaleExpansion", {
            description:
              "Display-domain padding. Non-temporal continuous/binned axes default to { mult: 0.05, add: 0 }; time axes default to zero. Pinned domains still receive display expansion.",
          }),
        ),
        oob: Type.Optional(
          Type.Union([Type.Literal("censor"), Type.Literal("squish")], {
            description:
              'Out-of-bounds policy for values outside explicit source limits, applied before stats. "censor" (default) drops them to missing; "squish" clamps them to the nearest source limit before transform.',
          }),
        ),
        naValue: Type.Optional(
          Type.Union([Type.Number(), Type.Null()], {
            description:
              "Replacement for missing/censored positional values, resolved after OOB and before transform. A finite number substitutes; null (default) keeps them missing. The replacement is itself checked against the transform/domain rules.",
          }),
        ),
        minorBreaks: Type.Optional(
          Type.Array(Type.Number(), {
            minItems: 1,
            description:
              "Explicit minor gridline positions in semantic source units. Coincident major/minor values render only the major tick. Time scales use dateMinorBreaks instead.",
          }),
        ),
        guide: Type.Optional(Type.Union([Type.Ref("GuideSpec"), Type.Ref("BandAxisGuideSpec")])),
      },
      {
        additionalProperties: false,
        description: "Configuration for a positional (x or y) scale.",
      },
    ),
    Type.Union([
      Type.Object({
        type: Type.Literal("binned"),
        breaks: Type.Optional(
          Type.Array(Type.Union([Type.Number(), Type.String()]), {
            maxItems: MAX_BINNED_BREAKS + 1,
          }),
        ),
      }),
      Type.Object({
        type: Type.Optional(
          Type.Union([
            Type.Literal("linear"),
            Type.Literal("log"),
            Type.Literal("time"),
            Type.Literal("band"),
          ]),
        ),
      }),
    ]),
  ]),

  ColorScaleSpec: Type.Intersect([
    Type.Object(
      {
        type: Type.Optional(
          Type.Union(
            [
              Type.Literal("ordinal"),
              Type.Literal("sequential"),
              Type.Literal("binned"),
              Type.Literal("manual"),
              Type.Literal("identity"),
            ],
            {
              description:
                'Color scale family: "ordinal" for categories, "sequential" for a continuous ramp, "binned" for color steps, "manual" for an explicit domain/range mapping, or "identity" for validated source colors.',
            },
          ),
        ),
        transform: Type.Optional(
          Type.Union([Type.Literal("identity"), Type.Literal("log10"), Type.Literal("sqrt")], {
            description:
              "Pre-training quantitative transform for sequential/binned color values. log10/sqrt require non-temporal values; ordinal, manual, and identity families do not accept a transform.",
          }),
        ),
        temporalKind: Type.Optional(
          Type.Union([Type.Literal("date"), Type.Literal("datetime")], {
            description:
              'Temporal precision intent for sequential/binned colors. "date" uses calendar labels; "datetime" uses instant labels.',
          }),
        ),
        parse: Type.Optional(
          Type.Ref("TemporalParserSpec", {
            description:
              "Explicit deterministic parser for temporal color/fill source values. Omit for value-driven inference.",
          }),
        ),
        parseFailure: Type.Optional(
          Type.Union([Type.Literal("error"), Type.Literal("censor")], {
            description:
              'Explicit temporal parser failure policy: "error" (default) or "censor" with a bounded warning.',
          }),
        ),
        timezone: Type.Optional(
          Type.String({
            minLength: 1,
            maxLength: 128,
            description: 'IANA timezone for temporal color/fill input. Default "UTC".',
          }),
        ),
        disambiguation: Type.Optional(
          Type.Union([
            Type.Literal("compatible"),
            Type.Literal("earlier"),
            Type.Literal("later"),
            Type.Literal("reject"),
          ]),
        ),
        domain: Type.Optional(
          Type.Array(Type.Ref("DomainValue"), {
            minItems: 1,
            description:
              "Explicit semantic domain. Manual/ordinal scales use ordered values; sequential/binned scales use [min, max].",
          }),
        ),
        domainMode: Type.Optional(
          Type.Union([Type.Literal("grow"), Type.Literal("data")], {
            description:
              'Ordinal domain stability: "grow" (default) preserves assignments across filters; "data" rebuilds from current data.',
          }),
        ),
        breaks: Type.Optional(
          Type.Array(Type.Union([Type.Number(), Type.String()]), {
            minItems: 2,
            description:
              "Explicit semantic reference ticks for sequential colorbars or ordered boundaries for binned colorsteps.",
          }),
        ),
        range: Type.Optional(
          Type.Array(Type.String({ pattern: "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" }), {
            minItems: 1,
            description:
              "Explicit #rgb/#rrggbb colors. Manual pairs them with domain values; sequential/binned interpolate or sample them.",
          }),
        ),
        scheme: Type.Optional(
          Type.Union(COLOR_SCHEME_NAME_SCHEMAS, {
            description:
              'Named color scheme: categorical "observable10" (default), "ipsum", "flexoki", "colorblind", "hue", and ColorBrewer qualitative (Dark2); or sequential family "viridis" (default), "magma", "plasma", "inferno", "cividis", "turbo", plus ColorBrewer sequential/diverging (Blues, RdYlBu, …). Sequential-family names may also be used with ordinal scales (discrete sampling). When type is omitted, the named scheme selects its ordinal or sequential scale family.',
          }),
        ),
        reverse: Type.Optional(
          Type.Boolean({ description: "Reverse the output color range. Default false." }),
        ),
        oob: Type.Optional(
          Type.Union([Type.Literal("censor"), Type.Literal("squish"), Type.Literal("wrap")], {
            description:
              'Out-of-bounds policy for an explicit continuous domain: "censor" (default), "squish", or "wrap" (periodic; required for cyclic *O schemes). Not valid on binned color scales.',
          }),
        ),
        naValue: Type.Optional(
          Type.String({
            pattern: "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$",
            description: "Color for null/missing values. Default9.",
          }),
        ),
        unknownValue: Type.Optional(
          Type.String({
            pattern: "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$",
            description: "Color for invalid, out-of-domain, or unmapped values. Default9.",
          }),
        ),
        onExhaust: Type.Optional(
          Type.Union([Type.Literal("cycle"), Type.Literal("error")], {
            description:
              'Ordinal palette exhaustion policy: "cycle" (default) with a warning, or "error".',
          }),
        ),
        labels: Type.Optional(
          Type.String({
            description:
              'Guide label format: numeric (".1f", ",d", ".0%") or temporal strftime-style text.',
          }),
        ),
        guide: Type.Optional(Type.Ref("GuideSpec")),
      },
      {
        additionalProperties: false,
        description: "Configuration for a color or fill scale.",
      },
    ),
    Type.Union([
      Type.Object({
        type: Type.Literal("binned"),
        breaks: Type.Optional(
          Type.Array(Type.Union([Type.Number(), Type.String()]), {
            minItems: 2,
            maxItems: MAX_BINNED_BREAKS + 1,
          }),
        ),
        domainMode: forbiddenColorOption(),
        onExhaust: forbiddenColorOption(),
      }),
      Type.Object({
        type: Type.Literal("manual"),
        range: Type.Array(Type.String({ pattern: "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" }), {
          minItems: 1,
        }),
        transform: forbiddenColorOption(),
        temporalKind: forbiddenColorOption(),
        parse: forbiddenColorOption(),
        parseFailure: forbiddenColorOption(),
        timezone: forbiddenColorOption(),
        disambiguation: forbiddenColorOption(),
        domainMode: forbiddenColorOption(),
        breaks: forbiddenColorOption(),
        scheme: forbiddenColorOption(),
        reverse: forbiddenColorOption(),
        oob: forbiddenColorOption(),
        onExhaust: forbiddenColorOption(),
        labels: forbiddenColorOption(),
      }),
      Type.Object({
        type: Type.Literal("identity"),
        transform: forbiddenColorOption(),
        temporalKind: forbiddenColorOption(),
        parse: forbiddenColorOption(),
        parseFailure: forbiddenColorOption(),
        timezone: forbiddenColorOption(),
        disambiguation: forbiddenColorOption(),
        domain: forbiddenColorOption(),
        domainMode: forbiddenColorOption(),
        breaks: forbiddenColorOption(),
        range: forbiddenColorOption(),
        scheme: forbiddenColorOption(),
        reverse: forbiddenColorOption(),
        oob: forbiddenColorOption(),
        onExhaust: forbiddenColorOption(),
        labels: forbiddenColorOption(),
      }),
      Type.Object({
        type: Type.Literal("ordinal"),
        transform: forbiddenColorOption(),
        temporalKind: forbiddenColorOption(),
        parse: forbiddenColorOption(),
        parseFailure: forbiddenColorOption(),
        timezone: forbiddenColorOption(),
        disambiguation: forbiddenColorOption(),
        breaks: forbiddenColorOption(),
        oob: forbiddenColorOption(),
        labels: forbiddenColorOption(),
      }),
      Type.Object({
        type: Type.Literal("sequential"),
        domainMode: forbiddenColorOption(),
        onExhaust: forbiddenColorOption(),
      }),
      Type.Object({ type: forbiddenColorOption() }),
    ]),
  ]),
};

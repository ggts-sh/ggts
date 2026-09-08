/**
 * Temporal-scales guide section (docs pages + llms surfaces).
 */

import { SCALE_CAPABILITIES, TEMPORAL_PARSER_NAMES } from "@ggts-sh/spec";

export const TEMPORAL_SCALES_MD = `# Dates without preprocessing

ggts infers strict ISO dates/date-times, four-digit year strings,
year-months, month-years, year-quarters, and runtime \`Date\` values from data.
Classification inspects at most the first and last 32 non-null values; after it
selects one parser family, every non-null value must validate. A partially valid
column never becomes partially temporal.

## Let the default work

\`"1835"\`, \`"1900"\`, and \`"2026"\` are spaced as calendar years, not as
three equally spaced categories. Numeric \`1835\` stays quantitative.

\`\`\`svelte fragment
<script lang="ts">
  import { GGPlot, GeomLine } from "@ggts-sh/svelte";
  const rows = [
    { year: "1835", value: 12 },
    { year: "1900", value: 19 },
    { year: "2026", value: 31 },
  ];
</script>

<GGPlot data={rows} aes={{ x: "year", y: "value" }} width="container" height={360}>
  <GeomLine />
</GGPlot>
\`\`\`

## Inspect the choice

Read \`model.scaleDecisions\` in \`onrender\` for field, parser, precision,
bounded evidence, validated count, trained domain, ambiguity, and a portable
override. Exceptional or advisory choices also appear in
\`model.scaleDiagnostics\` as stable problem/cause/fix records. The responsive
axis decisions live in \`model.guidePlans\`: each drawn panel axis reports its
calendar interval, visible and complete labels, major/minor tier, locale,
timezone, overlap state, and stable ID. \`ScaleDecision.guidePlanIds\` links
inference to those panel plans without copying facet-specific arrays.

## Responsive calendar labels

Automatic temporal axes score calendar-aligned candidates from milliseconds to
centuries against the actual panel extent and measured label widths. They prefer
3–7 major labels, but no-overlap wins. Month, quarter, year, week, and day
stepping follows civil boundaries rather than average milliseconds. The planner
runs inside the existing two layout passes and may move only to a coarser
interval during pass B.

Default date labels keep UTC calendar meaning. Datetime labels use the configured
IANA timezone. The deterministic defaults are \`en-US\`, UTC, and Monday week
starts. Visible labels may suppress repeated context; every SVG major tick keeps
a complete standalone label in its \`<title>\`.

Use exact portable controls when the default is not the editorial choice:

\`\`\`ts fragment
const spec = gg(rows, aes({ x: "when", y: "value" }))
  .geomLine()
  .scaleXDatetime({
    dateBreaks: "2 weeks",
    dateMinorBreaks: "1 day",
    dateLabels: "%e %b",
    locale: "en-GB",
    timezone: "Europe/London",
    weekStart: "monday",
  })
  .spec();
\`\`\`

Canonical JSON uses the same fields. Interval strings are a positive integer plus
\`millisecond\`, \`second\`, \`minute\`, \`hour\`, \`day\`, \`week\`, \`month\`,
\`quarter\`, or \`year\` (singular or plural). Explicit \`breaks\` outrank
\`dateBreaks\`; \`dateLabels\` outranks the older soft-fallback \`labels\` field.
Authored breaks and labels are never silently thinned, rotated, or truncated.
If they cannot fit, the render keeps them and emits a structured scale
diagnostic with a coarser-interval or wider-layout fix.

## Override one choice

Ambiguous values such as \`03/04/2024\` stay discrete. Pick the intended order:

\`\`\`ts fragment
const spec = gg(rows, aes({ x: "when", y: "value" }))
  .geomLine()
  .scaleXDate({ parse: "dmy" })
  .spec();
\`\`\`

Canonical JSON uses \`scales: { x: { type: "time", parse: "dmy" } }\`.
The closed parser names are generated from the runtime registry:
\`${TEMPORAL_PARSER_NAMES.join("`, `")}\`. Exact bounded formats and epoch
seconds/milliseconds are object parser forms. Timezone-less values mean UTC;
IANA zones use Temporal with explicit DST disambiguation.

If four-digit strings are identifiers, force categories with
\`.scaleXDiscrete()\`, \`scale_x_discrete()\`, or
\`scales: { x: { type: "band" } }\`.

## PortableSpec boundary

PortableSpec remains strict JSON: no \`Date\`, callback, or regular expression.
The checked capability ledger records the temporal family as
\`${SCALE_CAPABILITIES.find((capability) => capability.family === "position-temporal")?.runtime ?? "missing"}\`; docs, helper tests, and agent checks consume that ledger.
Builder and Svelte authoring may contain runtime Dates; they canonicalize to ISO
before validation. The standalone \`ymd\`, \`mdy\`, \`dmy\`, related order and
timestamp helpers, exact-format parser, and epoch helpers return authoring Dates.
`;

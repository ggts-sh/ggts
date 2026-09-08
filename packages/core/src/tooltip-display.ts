/**
 * Default-tooltip display collapse for identical field lists (#385).
 *
 * Public inspection snapshots still list every axis-group candidate (line +
 * point, multi-layer, custom content / oninspect). Only presentation layers
 * that render the default field rows should collapse identical *display*
 * payloads so users never see the same period/value block twice.
 */
import { spaceFieldName, type CellValue } from "./index.js";

import type { NonEmptyReadonlyArray, PlotDatum, TooltipField } from "./interaction-types.js";

/** Position-axis formatters from `RenderModel.axisFormatters` (scale-aware). */
export type TooltipAxisFormatters = Readonly<{
  x: (value: CellValue) => string;
  y: (value: CellValue) => string;
}>;

export type FormatTooltipCellOptions = {
  readonly channel?: string;
  readonly axisFormatters?: TooltipAxisFormatters | null;
};

/**
 * Shared with Tooltip.svelte so equality matches what the user sees.
 *
 * Position channels (`x`/`y`) route through `axisFormatters` when provided —
 * the same path as the axis header — so stat-frame temporal values print as
 * dates rather than raw epoch milliseconds (#1113). Callers should pass
 * formatters only for members with no source row (`row === null`); identity
 * rows keep the plain cell path so linear points keep full precision.
 */
export function formatTooltipCell(value: CellValue, options?: FormatTooltipCellOptions): string {
  const channel = options?.channel;
  const formatters = options?.axisFormatters;
  if (formatters !== null && formatters !== undefined && (channel === "x" || channel === "y")) {
    return formatters[channel](value);
  }
  if (value === null) return "–";
  if (value instanceof Date) {
    // Invalid Date throws on toISOString — keyboard live-text tokens must not.
    const time = value.getTime();
    if (Number.isNaN(time)) return "–";
    return value.toISOString();
  }
  if (typeof value === "number") return String(Math.round(value * 1000) / 1000);
  return String(value);
}

/**
 * Lab keys that may title a default-tooltip field row (#752).
 * Matches plot labs aesthetic titles (not plot title/subtitle/caption).
 */
type TooltipLabChannel =
  | "x"
  | "y"
  | "color"
  | "fill"
  | "size"
  | "linewidth"
  | "alpha"
  | "shape"
  | "linetype";

/** Subset of plot labs used when resolving default tooltip `<dt>` text. */
export type TooltipFieldLabs = Readonly<Partial<Record<TooltipLabChannel, string>>>;

const TOOLTIP_LAB_CHANNELS = new Set<string>([
  "x",
  "y",
  "color",
  "fill",
  "size",
  "linewidth",
  "alpha",
  "shape",
  "linetype",
]);

function isTooltipLabChannel(channel: string): channel is TooltipLabChannel {
  return TOOLTIP_LAB_CHANNELS.has(channel);
}

/**
 * Default tooltip `<dt>` text (#752).
 *
 * Preference order:
 * 1. Explicit lab for the field's channel (x/y/color/…), when non-empty
 * 2. Light humanization of the column name via shared `spaceFieldName`
 *    (camelCase / snake_case → words; multi-word → lowercase for scanability)
 * 3. Raw field name as last resort (empty input)
 *
 * Does not invent domain semantics ("crimePersons" stays "crime persons").
 * Axis/legend titles use `humanizeFieldTitle` (sentence case) instead (#961).
 */
export function tooltipFieldLabel(
  fieldName: string,
  options?: {
    readonly channel?: string;
    readonly labs?: TooltipFieldLabs | null | undefined;
  },
): string {
  const channel = options?.channel;
  const labs = options?.labs;
  if (
    channel !== undefined &&
    labs !== undefined &&
    labs !== null &&
    isTooltipLabChannel(channel)
  ) {
    const lab = labs[channel];
    if (typeof lab === "string" && lab.trim() !== "") return lab;
  }

  if (fieldName.length === 0) return fieldName;
  const spaced = spaceFieldName(fieldName);
  // Preserve intentional Title Case single tokens (e.g. "Region"); only fold
  // multi-word camelCase into lowercase words for scanability.
  if (!/\s/.test(spaced)) return spaced;
  return spaced.replaceAll(/\S+/g, (word) => word.toLowerCase());
}

/**
 * Fields shown in the default tooltip body for a member (#754).
 * Axis-mode inspections already print the shared axis value as a header, so
 * repeating the matching channel under every member is pure noise.
 *
 * Also drops later channels that re-list the same column name. Position
 * channels are listed first in layer field maps, so `aes(x = cat, fill = cat)`
 * on categorical bars keeps the x row (labs-titled) and drops the fill echo.
 * A11y live-text already dedupes by field name in `labels.ts`; default
 * tooltips match that contract so paint-only remaps never invent a third row.
 *
 * Weight is a statistical input (feeds count/sum into y), not a display
 * aesthetic. When y already carries the aggregated reading, painting weight
 * as a second numeric row is pure redundancy (#1526 preferred this; #1532
 * recovered weight on the public snapshot for custom content, but default
 * presentation must still omit it).
 */
export function fieldsForDefaultTooltip(
  fields: readonly TooltipField[],
  mode: "exact" | "xy" | "x" | "y",
): readonly TooltipField[] {
  const withoutAxis =
    mode === "x" || mode === "y" ? fields.filter((field) => field.channel !== mode) : fields;
  // Seed with the axis column when it is already the header, so palette-only
  // `fill = x` (or color = x) echoes do not reappear as a body row and do not
  // trigger series-centric collapse that would hide the measure label.
  const seenColumns = new Set<string>();
  if (mode === "x" || mode === "y") {
    for (const field of fields) {
      if (field.channel === mode) seenColumns.add(field.field);
    }
  }
  return withoutAxis.filter((field) => {
    // Stat input, not a visual channel — y (or x on flipped) is the reading.
    if (field.channel === "weight") return false;
    if (seenColumns.has(field.field)) return false;
    seenColumns.add(field.field);
    return true;
  });
}

/**
 * Channels that identify a series/group in long-form data. First match wins
 * when building the compact axis-group tooltip row.
 */
const SERIES_IDENTITY_CHANNELS = ["color", "fill", "linetype", "shape"] as const;

/**
 * One rendered `<dt>/<dd>` pair in the default tooltip body.
 *
 * - `label` is the left-column text (may be a series value, not a field name)
 * - `value` is the right-column cell (formatted via `formatTooltipCell`)
 * - `valueChannel` selects axis formatters for position values
 * - `key` is a stable each-block key
 */
export type DefaultTooltipRow = Readonly<{
  key: string;
  label: string;
  value: CellValue;
  /** Channel used for axis-aware value formatting (`x`/`y` or other). */
  valueChannel: string;
  /**
   * Source column for the reading. Included in collapse tokens so two layers
   * with the same series name but different measures (sales vs target) stay
   * distinct even when the formatted numbers match.
   */
  valueField: string;
}>;

/**
 * Categorical series identity only. Continuous color/fill (numbers, dates)
 * must keep traditional field-label rows so the tooltip does not print
 * "12345: 41" with no titles (Devin review on #1527).
 */
function seriesIdentityField(fields: readonly TooltipField[]): TooltipField | null {
  for (const channel of SERIES_IDENTITY_CHANNELS) {
    for (const field of fields) {
      if (field.channel !== channel) continue;
      if (typeof field.value !== "string") continue;
      if (field.value.trim() === "") continue;
      return field;
    }
  }
  return null;
}

/**
 * Default tooltip body rows for one display member.
 *
 * Axis-group mode (`x` / `y`) with a series aesthetic collapses to one row
 * per member: **series value → measure value**. That removes the repeated
 * key-value noise of "Index: 12 / Series: Wheat / Index: 8 / Series: Bread…"
 * (themes multi-series specimens, stacked areas, multi-line groups).
 *
 * Exact / xy inspection, single-field members, and members without a usable
 * series identity keep the traditional field-label → value rows.
 */
export function defaultTooltipRows(
  fields: readonly TooltipField[],
  mode: "exact" | "xy" | "x" | "y",
  options?: {
    readonly labs?: TooltipFieldLabs | null | undefined;
  },
): readonly DefaultTooltipRow[] {
  const body = fieldsForDefaultTooltip(fields, mode);
  const labs = options?.labs;

  if (mode === "x" || mode === "y") {
    const valueChannel = mode === "x" ? "y" : "x";
    let valueField: TooltipField | null = null;
    for (const field of body) {
      if (field.channel === valueChannel) {
        valueField = field;
        break;
      }
    }
    const seriesField = seriesIdentityField(body);
    if (valueField !== null && seriesField !== null) {
      // Series name as the row label; measure as the reading. Keep other
      // data-bearing channels (ymin/ymax, mapped size, label, …) as normal
      // labelled rows so intervals and dual aesthetics are not dropped.
      const rows: DefaultTooltipRow[] = [
        {
          key: `${seriesField.channel}:${seriesField.field}:${valueField.field}`,
          label: formatTooltipCell(seriesField.value),
          value: valueField.value,
          valueChannel: valueField.channel,
          valueField: valueField.field,
        },
      ];
      for (const field of body) {
        if (field.channel === valueField.channel) continue;
        if (field.channel === seriesField.channel) continue;
        if (field.field === seriesField.field) continue;
        rows.push({
          key: field.channel,
          label: tooltipFieldLabel(field.field, { channel: field.channel, labs }),
          value: field.value,
          valueChannel: field.channel,
          valueField: field.field,
        });
      }
      return rows;
    }
  }

  return body.map((field) => ({
    key: field.channel,
    label: tooltipFieldLabel(field.field, { channel: field.channel, labs }),
    value: field.value,
    valueChannel: field.channel,
    valueField: field.field,
  }));
}

/**
 * Stable token for one member's default-tooltip body.
 *
 * Hashes the rows that will actually paint (`defaultTooltipRows`), not the
 * full field map — otherwise series-centric axis-group layout can drop
 * label/weight/size while two layers stay distinct and the same line prints
 * twice (Devin review on #1527).
 */
export function tooltipDisplayPayloadToken(
  fields: readonly TooltipField[],
  axisFormatters: TooltipAxisFormatters | null = null,
  mode: "exact" | "xy" | "x" | "y" = "exact",
): string {
  // Length-prefix each segment so labels / values cannot forge delimiters.
  const parts: string[] = [];
  for (const row of defaultTooltipRows(fields, mode)) {
    const display = formatTooltipCell(row.value, {
      channel: row.valueChannel,
      axisFormatters,
    });
    // Label + measure column + value. Omit channel (fill vs color for the same
    // series collapses). Keep measure column so sales vs target at the same
    // reading do not collapse while Total still counts both (#1527 Devin).
    parts.push(
      `${row.label.length}:${row.label}|${row.valueField.length}:${row.valueField}|${display.length}:${display}`,
    );
  }
  return parts.join("\n");
}

/**
 * Magnitude for hover ranking of a display member (#1274).
 * Group by x → |y|; group by y → |x|. Non-numeric → 0.
 */
function memberValueMagnitude(
  member: { readonly fields: readonly TooltipField[] },
  mode: "x" | "y",
): number {
  const channel = mode === "x" ? "y" : "x";
  for (const field of member.fields) {
    if (field.channel !== channel) continue;
    const value = field.value;
    if (typeof value === "number" && Number.isFinite(value)) return Math.abs(value);
    if (value instanceof Date) {
      const time = value.getTime();
      return Number.isFinite(time) ? Math.abs(time) : 0;
    }
    return 0;
  }
  return 0;
}

/**
 * Hover window for the default tooltip when the public snapshot is complete
 * (oninspect / custom content) but presentation still caps at `limit` (#1274).
 *
 * Focus is always included. Remaining slots prefer largest |value|. Under the
 * limit, preserves input order. Pinned tooltips should pass members through
 * without this helper (or with limit >= members.length).
 */
export function selectHoverDisplayMembers<Row, Key>(
  members: readonly PlotDatum<Row, Key>[],
  focus: PlotDatum<Row, Key>,
  options: {
    readonly mode: "exact" | "xy" | "x" | "y";
    readonly limit?: number;
  },
): NonEmptyReadonlyArray<PlotDatum<Row, Key>> {
  const limit = options.limit ?? 8;
  if (members.length === 0) return [focus];
  if (options.mode === "exact" || options.mode === "xy" || members.length <= limit) {
    return members as NonEmptyReadonlyArray<PlotDatum<Row, Key>>;
  }

  const mode = options.mode;
  let focusPresent = false;
  const others: PlotDatum<Row, Key>[] = [];
  for (const member of members) {
    if (member === focus) {
      focusPresent = true;
      continue;
    }
    others.push(member);
  }
  others.sort((left, right) => {
    const delta = memberValueMagnitude(right, mode) - memberValueMagnitude(left, mode);
    if (delta !== 0) return delta;
    return left.layerIndex - right.layerIndex;
  });

  if (!focusPresent) {
    // Focus outside the collapsed list: force-include, drop the smallest slot.
    const kept = others.slice(0, Math.max(0, limit - 1));
    return [focus, ...kept];
  }
  if (limit === 1) return [focus];
  return [focus, ...others.slice(0, limit - 1)];
}

/**
 * Collapse members that would render identical default field lists.
 * Prefer `focus` within each duplicate group; preserve first-seen order of
 * distinct payloads. If `focus` is missing from `members` but shares a payload
 * with a retained member, swap that slot to `focus`. Only prepend `focus` when
 * it is absent *and* no retained member shares its display payload (transient
 * cap edge where focus was outside the sliced window).
 */
export function collapseIdenticalDisplayMembers<Row, Key>(
  members: readonly PlotDatum<Row, Key>[],
  focus: PlotDatum<Row, Key>,
  axisFormatters: TooltipAxisFormatters | null = null,
  mode: "exact" | "xy" | "x" | "y" = "exact",
): NonEmptyReadonlyArray<PlotDatum<Row, Key>> {
  if (members.length === 0) return [focus];

  // Stat members (no source row) use axis formatters for position display;
  // identity members keep precise cell formatting (#1113).
  const formattersFor = (member: PlotDatum<Row, Key>): TooltipAxisFormatters | null =>
    member.row === null ? axisFormatters : null;

  const chosen = new Map<string, PlotDatum<Row, Key>>();
  const order: string[] = [];
  let focusInMembers = false;

  for (const member of members) {
    if (member === focus) focusInMembers = true;
    const token = tooltipDisplayPayloadToken(member.fields, formattersFor(member), mode);
    const existing = chosen.get(token);
    if (existing === undefined) {
      chosen.set(token, member);
      order.push(token);
      continue;
    }
    // Prefer focus when it collides with a prior duplicate payload.
    if (member === focus) chosen.set(token, member);
  }

  const focusToken = tooltipDisplayPayloadToken(focus.fields, formattersFor(focus), mode);
  if (chosen.has(focusToken)) {
    // Same display as a retained member — always surface focus for styling.
    chosen.set(focusToken, focus);
  } else if (!focusInMembers) {
    // Focus was outside the member window (e.g. transient cap) and is distinct.
    // Replace the last capped slot rather than growing past members.length so
    // live-text counts and the default tooltip stay within the transient bound.
    chosen.set(focusToken, focus);
    order.unshift(focusToken);
    if (order.length > members.length) {
      const dropped = order.pop()!;
      if (dropped !== focusToken) chosen.delete(dropped);
    }
  }

  const first = chosen.get(order[0]!)!;
  const rest = order.slice(1).map((token) => chosen.get(token)!);
  return [first, ...rest];
}

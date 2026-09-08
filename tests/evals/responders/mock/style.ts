/** Aesthetic and style-channel mapping helpers for the mock responder. */
import type { DataProfile } from "@ggts-sh/spec";

import type { Channel, MockAes, MockContext } from "./types.ts";

export const f = (field: string): Channel => ({ field });

export const COLOR_TRIGGER =
  /colou?red by|colou?r by|map .* to (?:binned )?colou?r|binned colou?r|colou?rsteps|split by|stacked by|grouped by|one (?:line|curve|area) per|shaded by|filled by|one per/;

export const STYLE_CHANNELS = ["size", "linewidth", "alpha", "shape", "linetype"] as const;
export type StyleChannel = (typeof STYLE_CHANNELS)[number];

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mappedStyleField(
  prompt: string,
  profile: DataProfile,
  channel: StyleChannel,
): string | undefined {
  const channelPattern =
    channel === "linewidth"
      ? "(?:linewidth|line[- ]width|stroke[- ]width)"
      : channel === "linetype"
        ? "(?:linetype|line[- ]type|dash(?: pattern)?)"
        : channel;
  for (const field of profile.fields) {
    const fieldPattern = escapeRegExp(field.name.toLowerCase());
    const mapping = new RegExp(
      `\\b${fieldPattern}\\b\\s+to\\s+(?:(?:continuous|discrete|binned|point|line)\\s+){0,3}${channelPattern}\\b`,
    );
    if (mapping.test(prompt)) return field.name;
  }
  return undefined;
}

// Aesthetic mapping phrases like "map y to station" / "map period to fill"
// must not trigger the geographic-map refusal. Only known aesthetic /
// position / style channels count — "map revenue to state" is geo-ish and
// must still refuse when the prompt also contains "map".
// Scale modifiers match mappedStyleField (continuous/discrete/binned/point/line)
// so "map z to continuous fill" and "map region to discrete color" stay aesthetic.
const AES_CHANNEL =
  "(?:(?:continuous|discrete|binned|point|line)\\s+){0,3}(?:colou?r|fill|x|y|xmin|xmax|ymin|ymax|width|height|size|alpha|shape|linewidth|linetype|label)";

export function hasAestheticMapping(prompt: string, profile: DataProfile): boolean {
  return (
    new RegExp(`\\bmap\\s+\\S+\\s+to\\s+${AES_CHANNEL}\\b`).test(prompt) ||
    new RegExp(`\\bmap\\s+${AES_CHANNEL}\\s+to\\s+\\S+\\b`).test(prompt) ||
    STYLE_CHANNELS.some((channel) => mappedStyleField(prompt, profile, channel) !== undefined)
  );
}

/** Color/fill mapping shared by the geom families (wantsColor + pick order). */
export function colorFor(ctx: MockContext, channel: "color" | "fill", aes: MockAes): void {
  if (!COLOR_TRIGGER.test(ctx.prompt)) return;
  const { prompt, profile, pick, scales } = ctx;
  const explicitlyMapped = profile.fields.find((field) =>
    prompt.includes(`map ${field.name.toLowerCase()} to`),
  );
  const cat = pick.mentionedCat();
  const which = explicitlyMapped?.name ?? cat ?? pick.mentionedQuant();
  if (which === undefined) return;
  aes[channel] = f(which);
  if (pick.typeOf(which) === "quantitative") scales[channel] = { type: "sequential" };
}

/** Style channels (size/linewidth/alpha/shape/linetype) mapped via "X to size" phrases. */
export function stylesFor(ctx: MockContext, aes: MockAes): void {
  for (const channel of STYLE_CHANNELS) {
    const field = mappedStyleField(ctx.prompt, ctx.profile, channel);
    if (field === undefined) continue;
    aes[channel] = f(field);
    const finite = channel === "shape" || channel === "linetype";
    ctx.scales[channel] = {
      type: finite || ctx.pick.typeOf(field) !== "quantitative" ? "ordinal" : "sequential",
    };
  }
}

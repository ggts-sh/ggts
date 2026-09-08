/**
 * Guide channel types + splitChannel for declaration-only guide shells
 * (#659 slice 6). Registration lives in {@link createPlotLayer} (#786).
 *
 * Guides are keyed by AESTHETIC, so this family is five type shells that each
 * take a `channel` prop — not a 5×9 codegen matrix. The aesthetic is the key,
 * never part of the helper: `<GuideLegend channel="color" position="bottom"/>`
 * assembles `guides: { color: { type: "legend", position: "bottom" } }`.
 *
 * guides is a keyed-MERGE family, but the VALUE at a key is replaced whole —
 * `builder.guides` shallow-merges by channel, so a child never field-merges
 * into a prop's guide object.
 */
import type { GuidesSpec } from "@ggts-sh/spec";

import { definedProps } from "../layers/plot-layer.svelte.js";

/** Every aesthetic a guide can be keyed by. */
export type GuideChannel = keyof GuidesSpec;
/** Aesthetics an axis guide can key: the positional pair. */
export type PositionGuideChannel = Extract<GuideChannel, "x" | "y">;
/** Aesthetics a legend/colorbar/colorsteps guide can key. */
export type NonPositionGuideChannel = Exclude<GuideChannel, "x" | "y">;

/**
 * Split a shell's live props into the channel key and the guide options.
 *
 * Stripping `channel` here — rather than in each shell — is load-bearing:
 * every *GuideSpec is `additionalProperties: false`, so a leaked `channel` key
 * inside the guide object fails validate() rather than being ignored.
 *
 * Uses shared {@link definedProps} so undefined option keys are dropped before
 * the rest-spread, matching the other grammar families.
 */
export function splitChannel<Props extends { channel: GuideChannel }>(
  props: Props,
): { channel: GuideChannel; options: Omit<Props, "channel"> } {
  const { channel, ...options } = definedProps(props);
  return { channel, options };
}

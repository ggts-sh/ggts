/**
 * Default-tooltip Total row placement. Independent of inspect `mode` so
 * stacked bars can keep exact hits and still opt into a group total.
 */
import type { TooltipTotal } from "../interaction/interaction.js";

export type TooltipTotalPlacement = "top" | "bottom";

export function tooltipTotalPlacement(input: {
  readonly tooltipTotal: TooltipTotal;
  readonly groupTotal: number | null | undefined;
  readonly memberCount: number;
  readonly mode: "exact" | "xy" | "x" | "y";
}): TooltipTotalPlacement | null {
  if (input.groupTotal === null || input.groupTotal === undefined) return null;
  if (input.tooltipTotal === "off") return null;
  if (input.tooltipTotal === "top" || input.tooltipTotal === "bottom") return input.tooltipTotal;
  // auto: current axis-mode Total (bottom, only when several series list)
  if ((input.mode === "x" || input.mode === "y") && input.memberCount > 1) return "bottom";
  return null;
}

/**
 * Shared legend-filter controller fixtures: pure data and pure helper
 * functions only — no vitest, no Svelte runtime state.
 */
import { aes, gg, type PortableSpec } from "@ggts-sh/spec";

import type { LegendFilterEvent } from "../../src/lib/legend/filter.js";

export const filterRows = [
  { x: 1, y: 1, group: "north" },
  { x: 2, y: 2, group: "south" },
];

type FilterCb = ((event: LegendFilterEvent) => void) | undefined;
/** Getter that supplies no host callback. */
export const noCallback = (): FilterCb => undefined;

export function colorSpec(
  data: readonly { x: number; y: number; group: string }[] = filterRows,
): PortableSpec {
  return gg([...data], aes({ x: "x", y: "y", color: "group" }))
    .geomPoint()
    .spec();
}

export function clickEvent(detail = 1): MouseEvent {
  return new MouseEvent("click", { bubbles: true, detail });
}

/**
 * Stat → LayerFrame builder registry.
 *
 * Heavy stats (loess/smooth, density, contour, sf, …) live in separate modules
 * and register here. The full package entry registers everything; the lean
 * `@ggts-sh/core/render` entry registers nothing extra so identity charts
 * (scatter, plain line) do not pull those modules into the client graph.
 */
import type { ColumnTable } from "../table.js";

import type { Advisory, LayerBinding, LayerFrame, PipelineWarning } from "./types.js";

export type StatFrameBuilder = (
  binding: LayerBinding,
  table: ColumnTable,
  groups: readonly number[],
  warnings: PipelineWarning[],
  advisories: Advisory[],
  binRange: [number, number] | undefined,
  functionDomain: [number, number] | undefined,
) => LayerFrame | null;

const builders = new Map<string, StatFrameBuilder>();

/** Register (or replace) a non-identity stat frame builder. */
export function registerStatFrame(stat: string, build: StatFrameBuilder): void {
  builders.set(stat, build);
}

/** Look up a registered builder; undefined if the stat is not loaded. */
export function getStatFrameBuilder(stat: string): StatFrameBuilder | undefined {
  return builders.get(stat);
}

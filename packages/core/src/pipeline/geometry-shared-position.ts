/**
 * Panel Frame type, position mapping, removed-row warnings, and mark defaults.
 */
import type { PositionScale } from "../scales/train.js";
import type { CellValue } from "../table.js";

import type { PipelineWarning } from "./types.js";

export const DEFAULT_POINT_SIZE = 2.5;
export const DEFAULT_LINEWIDTH = 1.5;
export const DEFAULT_RULE_LINEWIDTH = 1;
export const DEFAULT_BAR_WIDTH = 0.9;
/** ggplot2 geom_boxplot default (`width = 0.75`), distinct from bar's 0.9. */
export const DEFAULT_BOXPLOT_WIDTH = 0.75;
/**
 * Default boxplot boxes never exceed this fraction of the panel width. With
 * few categories, `width * band.step` otherwise grows into blocky slabs (#653).
 * Explicit `params.width` bypasses the cap.
 */
export const MAX_BOXPLOT_PANEL_FRAC = 0.15;
export const DEFAULT_TEXT_SIZE = 11;

/** Panel-local frame extents + trained positional scales for batch builders. */
export interface Frame {
  innerWidth: number;
  innerHeight: number;
  xScale: PositionScale;
  yScale: PositionScale;
}

export function positionOf(
  scale: PositionScale,
  numeric: Float64Array | null,
  column: readonly CellValue[] | null,
  row: number,
  offsets: Float64Array | null = null,
): number {
  if (scale.type === "band") {
    const t = scale.normalize(column?.[row] ?? null);
    if (t === undefined) return NaN;
    // Offsets on discrete axes are band-step fractions.
    return offsets === null ? t : t + offsets[row]! * scale.step;
  }
  const v = numeric?.[row];
  if (v === undefined || !Number.isFinite(v)) return NaN;
  // `numeric` is the already-transformed (scale-space) frame array; offsets
  // (stack/dodge/jitter/nudge) are also post-stat scale-space units. Use
  // normalizeTransformed so a transformed value is never forwarded twice.
  return scale.normalizeTransformed(offsets === null ? v : v + offsets[row]!);
}

/** Batch fields that map each kept mark to its frame row; empty when no mark was dropped. */
export function droppedFrameRows(
  keptRows: Uint32Array,
  n: number,
): { frameRowIndex?: Uint32Array } {
  return keptRows.length < n ? { frameRowIndex: keptRows.slice() } : {};
}

export function removedWarning(removed: number, index: number, warnings: PipelineWarning[]): void {
  if (removed > 0) {
    warnings.push({
      code: "removed-missing",
      message: `Removed ${removed} row(s) with missing or non-finite positions (layer ${index}).`,
    });
  }
}

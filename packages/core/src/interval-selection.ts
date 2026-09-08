import type { CellValue } from "./index.js";

import type { InteractionSource, IntervalSelection } from "./interaction-types.js";
import type { PlotRect } from "./semantic-viewport.js";
import { uniqueKeysFromRowIndexes } from "./host-selection.js";

/** Pointer brush-end gate only. Keyboard Enter/Space commits any size. */
export const BRUSH_MIN_SPAN_PX = 4;

/**
 * Whether a finished interval selection should remain painted as committed.
 * Host: `interactionConfig.select?.persistent === true` keeps the end event;
 * otherwise clear the committed bag (event is still emitted).
 */
export function persistentSelectionOrNull<T>(persistent: boolean | undefined, event: T): T | null {
  return persistent === true ? event : null;
}

export type SelectAreaMode = "x" | "y" | "xy";

export type IntervalDomain = {
  readonly x?: readonly [CellValue, CellValue];
  readonly y?: readonly [CellValue, CellValue];
};

/**
 * Pointer brush-end degeneracy: BOTH spans must be strictly less than min.
 * Input must already be normalized (x0≤x1, y0≤y1); this does not take abs.
 */
export function isBrushTooSmall(rect: PlotRect, minPx: number = BRUSH_MIN_SPAN_PX): boolean {
  return rect.x1 - rect.x0 < minPx && rect.y1 - rect.y0 < minPx;
}

/** Drop domain axes not requested by the interval select mode. */
export function filterDomainBySelectMode(
  domain: IntervalDomain,
  mode: SelectAreaMode,
): IntervalDomain {
  return {
    ...(mode !== "y" && domain.x !== undefined && { x: domain.x }),
    ...(mode !== "x" && domain.y !== undefined && { y: domain.y }),
  };
}

/** Freeze an interval domain bag (nested tuples when present). */
export function freezeIntervalDomain(domain: IntervalDomain): IntervalSelection["domain"] {
  return Object.freeze({
    ...(domain.x !== undefined && {
      x: Object.freeze([...domain.x]) as [CellValue, CellValue],
    }),
    ...(domain.y !== undefined && {
      y: Object.freeze([...domain.y]) as [CellValue, CellValue],
    }),
  });
}

export type BuildIntervalSelectionInput = {
  readonly phase: IntervalSelection["phase"];
  readonly mode: SelectAreaMode;
  readonly panelId: string | null;
  readonly domain: IntervalDomain;
  readonly pixels: PlotRect;
  readonly keys: readonly PropertyKey[];
  readonly lineageCount: number;
  readonly source: InteractionSource;
};

/** Build a frozen IntervalSelection event payload. */
export function buildIntervalSelection(input: BuildIntervalSelectionInput): IntervalSelection {
  return Object.freeze({
    type: "select",
    phase: input.phase,
    mode: input.mode,
    panelId: input.panelId,
    domain: freezeIntervalDomain(input.domain),
    pixels: Object.freeze({ ...input.pixels }),
    keys: Object.freeze([...input.keys]),
    lineageCount: input.lineageCount,
    source: input.source,
  });
}

/**
 * Clear event for a committed interval: preserves mode/panelId/pixels,
 * empties domain/keys, lineageCount 0.
 */
export function clearIntervalSelectionEvent(
  previous: Pick<IntervalSelection, "mode" | "panelId" | "pixels">,
  source: InteractionSource,
): IntervalSelection {
  return Object.freeze({
    type: "select",
    phase: "clear",
    mode: previous.mode,
    panelId: previous.panelId,
    domain: Object.freeze({}),
    pixels: Object.freeze({ ...previous.pixels }),
    keys: Object.freeze([]),
    lineageCount: 0,
    source,
  });
}

export type LineageCandidate = {
  readonly lineage: number;
};

/**
 * Collect source row indexes covered by interval candidates via lineage.
 * Order is insertion order (first candidate, then lineage key order).
 * Each lineage id is expanded once (#1140) — shared smooth/aggregate
 * memberships must not re-walk L rows per coincident mark.
 */
export function lineageRowIndexesFromCandidates(
  candidates: Iterable<LineageCandidate>,
  lineageKeys: (lineageId: number) => Iterable<number>,
): Set<number> {
  const sourceRows = new Set<number>();
  const seenLineages = new Set<number>();
  for (const candidate of candidates) {
    const lineageId = candidate.lineage;
    if (seenLineages.has(lineageId)) continue;
    seenLineages.add(lineageId);
    for (const rowIndex of lineageKeys(lineageId)) sourceRows.add(rowIndex);
  }
  return sourceRows;
}

export type IntervalSelectionFromRowsInput = {
  readonly phase: IntervalSelection["phase"];
  readonly mode: SelectAreaMode;
  readonly panelId: string | null;
  readonly pixels: PlotRect;
  readonly source: InteractionSource;
  /** Source row indexes (typically from lineageRowIndexesFromCandidates). */
  readonly rowIndexes: Iterable<number>;
  readonly keyForRow: (rowIndex: number) => PropertyKey | null;
  /** Pre-inverted panel domains; mode filtering is applied here. */
  readonly invertedDomain: IntervalDomain;
};

/**
 * Pure interval-selection assembly after candidate query + domain inversion.
 * Resolves keys from row indexes, filters domain by select mode, freezes payload.
 */
export function intervalSelectionFromRows(
  input: IntervalSelectionFromRowsInput,
): IntervalSelection {
  const sourceRows = input.rowIndexes instanceof Set ? input.rowIndexes : new Set(input.rowIndexes);
  const keys = uniqueKeysFromRowIndexes(sourceRows, input.keyForRow);
  const domain = filterDomainBySelectMode(input.invertedDomain, input.mode);
  return buildIntervalSelection({
    phase: input.phase,
    mode: input.mode,
    panelId: input.panelId,
    domain,
    pixels: input.pixels,
    keys,
    lineageCount: sourceRows.size,
    source: input.source,
  });
}

// Shared pure behavior used by React and Svelte.
export {
  BRUSH_MIN_SPAN_PX,
  persistentSelectionOrNull,
  type SelectAreaMode,
  type IntervalDomain,
  isBrushTooSmall,
  filterDomainBySelectMode,
  freezeIntervalDomain,
  type BuildIntervalSelectionInput,
  buildIntervalSelection,
  clearIntervalSelectionEvent,
  type LineageCandidate,
  lineageRowIndexesFromCandidates,
  type IntervalSelectionFromRowsInput,
  intervalSelectionFromRows,
} from "@ggts-sh/core/interaction";

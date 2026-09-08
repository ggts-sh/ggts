// Shared pure behavior used by React and Svelte.
export {
  BRUSH_MIN_SPAN_PX,
  persistentSelectionOrNull,
  isBrushTooSmall,
  filterDomainBySelectMode,
  freezeIntervalDomain,
  buildIntervalSelection,
  clearIntervalSelectionEvent,
  lineageRowIndexesFromCandidates,
  intervalSelectionFromRows,
} from "@ggts-sh/core/interaction";

// Shared pure behavior used by React and Svelte.
export {
  type PresentationChrome,
  type PresentationAnchor,
  EMPHASIS_RING_DENSITY_LIMIT,
  presentationChromeForKind,
  hoverChromeForKind,
  applyEmphasisRingDensityGate,
  sameOrderedPropertyKeys,
  buildPointSelectionEvent,
  uniqueKeysFromRowIndexes,
  nextPointSelectionKeys,
  iterateCandidates,
  collectCandidates,
  anchorsFromCandidateKeys,
  type PresentationInspectionFocus,
  presentationFocusFromInspection,
  mergePresentationFocusKeys,
} from "@ggts-sh/core/interaction";

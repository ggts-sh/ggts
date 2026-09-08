// Shared pure behavior used by React and Svelte.
export {
  type IntervalConsumptionCandidate,
  consumeIntervalKeys,
  sameIntervalRecord,
  nextLocalIntervalRecords,
  recomputePanelIntervalProjection,
  type PanelIntervalLookupCandidate,
  recomputePanelIntervalFromLookup,
} from "@ggts-sh/core/interaction";

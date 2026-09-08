// Shared pure behavior used by React and Svelte.
export {
  type IntervalConsumptionCandidate,
  type ConsumeIntervalKeysInput,
  type RecomputePanelIntervalProjectionInput,
  consumeIntervalKeys,
  sameIntervalRecord,
  nextLocalIntervalRecords,
  recomputePanelIntervalProjection,
  type PanelIntervalLookupCandidate,
  type RecomputePanelIntervalFromLookupInput,
  recomputePanelIntervalFromLookup,
} from "@ggsvelte/core/interaction";

// Shared pure behavior used by React and Svelte.
export {
  type LegendEntryIdentity,
  type LegendInteractionSource,
  type LegendEntryAction,
  type InteractiveLegendEntry,
  legendIdentityKey,
  buildInteractiveLegendEntries,
  samePropertyKeySet,
  legendInteractionSource,
  keysForLegendEntry,
  clampLegendRovingIndex,
  moveLegendRovingIndex,
} from "@ggsvelte/core/interaction";

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
  findLegendPressedIdentity,
  clampLegendRovingIndex,
  moveLegendRovingIndex,
} from "@ggts-sh/core/interaction";

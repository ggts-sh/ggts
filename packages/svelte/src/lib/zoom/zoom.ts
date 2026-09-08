// Shared pure behavior used by React and Svelte.
export {
  continuousZoomDomainsFromScopes,
  filterZoomDomainsByMode,
  filterScopeChannelsByZoomMode,
  sameZoomDomains,
  stableZoomDomains,
  applyZoomToSpec,
  sanitizePartialZoomDomains,
  buildZoomEvent,
  resolveBrushZoomDomains,
  resolveBrushZoomFromModel,
} from "@ggts-sh/core/interaction";

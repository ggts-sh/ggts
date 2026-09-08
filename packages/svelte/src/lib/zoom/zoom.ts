// Shared pure behavior used by React and Svelte.
export {
  type ZoomMode,
  type ScopedZoomChannel,
  continuousZoomDomainsFromScopes,
  filterZoomDomainsByMode,
  filterScopeChannelsByZoomMode,
  sameZoomDomains,
  stableZoomDomains,
  applyZoomToSpec,
  sanitizePartialZoomDomains,
  buildZoomEvent,
  resolveBrushZoomDomains,
  type BrushZoomModel,
  resolveBrushZoomFromModel,
} from "@ggts-sh/core/interaction";

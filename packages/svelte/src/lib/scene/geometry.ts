// Shared pure behavior used by React and Svelte.
export { type PlotRect } from "@ggts-sh/core";
export {
  type PanelBounds,
  panelBoundsFrom,
  type ContinuousZoomDomains,
  clamp,
  frozenZoomDomains,
  normalizedRect,
  HOVER_RING_RADIUS,
  HOVER_CROSSHAIR_GAP_RADIUS,
  glyphHoverBox,
  crosshairGapForBox,
  glyphExtentsFromBatch,
  type CrosshairGapBox,
  CROSSHAIR_BOX_GAP_PAD,
  gappedCrosshairSegmentsWithObstacles,
  gappedCrosshairSegments,
  crosshairGlyphObstacles,
} from "@ggts-sh/core/interaction";

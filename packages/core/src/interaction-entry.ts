/** Shared interaction mechanics for framework hosts. */
// @lifecycle-default experimental

export type {
  InteractionSource,
  InspectMode,
  TooltipTotal,
  ResolvedInspectMode,
  AreaMode,
  InteractionTool,
  AreaInteractionTool,
  TooltipField,
  PlotDatum,
  NonEmptyReadonlyArray,
  PlotInspectionChange,
  PlotInspectionClear,
  PlotInspection,
  IntervalSelection,
  PointSelection,
  PlotSelection,
  ZoomEvent,
  LegendFocusChange,
  LegendFocusClear,
  LegendFocusEvent,
  PlotInteractionEvent,
  ReadonlyZoomDomains,
  PlotInteractionScope,
  PlotInteractionChange,
  FacetIntervalPreset,
  SemanticIntervalAxis,
  ReadonlyIntervalDomains,
  PlotInteractionInterval,
  ScopedInteractionInterval,
  ScopedInteractionKeys,
  ScopedInteractionDomain,
  PlotInteractionSnapshot,
  PlotInteractionTransition,
  LegendFilterClause,
  LegendFilterOptions,
  LegendFilterInput,
  LegendFilterEvent,
  ZoomDomains,
} from "./interaction-types.js";
export { isAreaTool } from "./interaction-types.js";
export { createPlotInteraction } from "./interaction-controller.js";
export type {
  PlotInteractionController,
  CreatePlotInteractionOptions,
  ControllerDatumIdentity,
  PlotInteractionMutationOptions,
  PlotInteractionZoomOptions,
} from "./interaction-controller.js";

export {
  resolveInspection,
  materializeInspection,
  resolvedTarget,
  selectTransientMembers,
  TRANSIENT_MEMBER_LIMIT,
} from "./inspection-resolver.js";
export type {
  ResolveInspectionInput,
  InspectionSnapshotCompleteness,
  ResolvedTarget,
} from "./inspection-resolver.js";

export { a11yMarkCount, a11yRows, collectCanvasRowIndexes, A11Y_TABLE_CAP } from "./canvas-a11y.js";

export { normalizeInteractionConfig } from "./normalize-interaction-config.js";
export { INTERACTION_DIAGNOSTIC_CATALOG } from "./interaction-diagnostics.js";
export type {
  InteractionDiagnostic,
  InteractionDiagnosticCode,
} from "./interaction-diagnostics.js";
export type {
  InspectOptions,
  InspectInput,
  SelectOptions,
  SelectInput,
  ZoomOptions,
  ZoomInput,
  LegendFocusOptions,
  LegendFocusInput,
  ResolvedInteractionConfig,
  InteractionConfigInput,
} from "./interaction-options.js";
export {
  formatTooltipCell,
  tooltipFieldLabel,
  fieldsForDefaultTooltip,
  defaultTooltipRows,
  tooltipDisplayPayloadToken,
  selectHoverDisplayMembers,
  collapseIdenticalDisplayMembers,
} from "./tooltip-display.js";
export type {
  TooltipAxisFormatters,
  FormatTooltipCellOptions,
  TooltipFieldLabs,
  DefaultTooltipRow,
} from "./tooltip-display.js";
export { tooltipTotalPlacement } from "./tooltip-total.js";
export type { TooltipTotalPlacement } from "./tooltip-total.js";

export {
  buildPointSelectionEvent,
  nextPointSelectionKeys,
  uniqueKeysFromRowIndexes,
  iterateCandidates,
  anchorsFromCandidateKeys,
} from "./host-selection.js";
export { buildInteractiveLegendEntries, legendIdentityKey } from "./legend-focus.js";
export type { InteractiveLegendEntry, LegendEntryIdentity } from "./legend-focus.js";
export { buildLegendEntryKeyIndexForPlot } from "./legend-entry-key-index.js";
export {
  nextLegendFilterValues,
  isLegendValueVisible,
  reconcileLegendFilterValues,
} from "./legend-filter.js";
export {
  buildIntervalSelectionFromScene,
  intervalQuerySceneFromModel,
  resolveIntervalQueryParts,
} from "./interval-query.js";
export {
  buildIntervalSelection,
  clearIntervalSelectionEvent,
  filterDomainBySelectMode,
} from "./interval-selection.js";
export { consumeIntervalKeys, recomputePanelIntervalProjection } from "./interval-consumption.js";
export { boundsEditorInputForScale, semanticAxisFromBounds } from "./precise-bounds.js";
export { formatBoundsDraft, validateBoundsDraft } from "./bounds-editor.js";
export type {
  BoundsEditorInput,
  BoundsDraft,
  BoundsDraftErrors,
  PreciseBoundsApplyEvent,
} from "./bounds-editor.js";

export {
  applyZoomToSpec,
  filterZoomDomainsByMode,
  filterScopeChannelsByZoomMode,
  stableZoomDomains,
  sanitizePartialZoomDomains,
  buildZoomEvent,
  resolveBrushZoomDomains,
} from "./host-zoom.js";
export {
  nextLocalIntervalRecords,
  recomputePanelIntervalFromLookup,
} from "./interval-consumption.js";

export {
  candidateValueContribution,
  valueFieldName,
  contributionIdentity,
  groupHasAdditivePosition,
  groupMagnitudeTotal,
  compositionGroupTotal,
} from "./inspection-group-total.js";
export {
  type PresentationChrome,
  type PresentationAnchor,
  type CandidateAnchorKeys,
  EMPHASIS_RING_DENSITY_LIMIT,
  presentationChromeForKind,
  hoverChromeForKind,
  applyEmphasisRingDensityGate,
  sameOrderedPropertyKeys,
  type CandidateLookup,
  collectCandidates,
  type PresentationInspectionFocus,
  type PresentationSeedFacts,
  presentationFocusFromInspection,
  type MergePresentationFocusOptions,
  mergePresentationFocusKeys,
} from "./host-selection.js";
export {
  type LegendInteractionSource,
  type LegendEntryAction,
  samePropertyKeySet,
  legendInteractionSource,
  keysForLegendEntry,
  clampLegendRovingIndex,
  moveLegendRovingIndex,
} from "./legend-focus.js";
export {
  type LegendKeyIndexAdapter,
  type LegendKeyIndexPlotModel,
  buildLegendEntryKeyIndex,
} from "./legend-entry-key-index.js";
export { legendFilterValueKeys, isLegendValueKeyVisible } from "./legend-filter.js";
export {
  BRUSH_MIN_SPAN_PX,
  persistentSelectionOrNull,
  type SelectAreaMode,
  type IntervalDomain,
  isBrushTooSmall,
  freezeIntervalDomain,
  type BuildIntervalSelectionInput,
  type LineageCandidate,
  lineageRowIndexesFromCandidates,
  type IntervalSelectionFromRowsInput,
  intervalSelectionFromRows,
} from "./interval-selection.js";
export {
  type IntervalQueryScene,
  type IntervalQueryModelPort,
  type ResolveIntervalQueryPartsInput,
  type BuildIntervalSelectionFromSceneInput,
} from "./interval-query.js";
export {
  type IntervalConsumptionCandidate,
  type ConsumeIntervalKeysInput,
  type RecomputePanelIntervalProjectionInput,
  sameIntervalRecord,
  type PanelIntervalLookupCandidate,
  type RecomputePanelIntervalFromLookupInput,
} from "./interval-consumption.js";
export { type BoundsEditorInputForScaleOptions } from "./precise-bounds.js";
export {
  type BoundsAxis,
  type BoundsAction,
  type BoundsScale,
  type BoundsInputSource,
  type BoundsCategoryValue,
  type BoundsDraftValidation,
} from "./bounds-editor.js";
export {
  type ZoomMode,
  type ScopedZoomChannel,
  continuousZoomDomainsFromScopes,
  sameZoomDomains,
  type BrushZoomModel,
  resolveBrushZoomFromModel,
} from "./host-zoom.js";
export {
  type PanelBounds,
  panelBoundsFrom,
  type ContinuousZoomDomains,
  clamp,
  frozenZoomDomains,
  normalizedRect,
  HOVER_RING_RADIUS,
  HOVER_CROSSHAIR_GAP_RADIUS,
  type GlyphHoverBox,
  glyphHoverBox,
  crosshairGapForBox,
  type GlyphExtentBatch,
  glyphExtentsFromBatch,
  type CrosshairSegment,
  type CrosshairGapBox,
  CROSSHAIR_BOX_GAP_PAD,
  gappedCrosshairSegmentsWithObstacles,
  gappedCrosshairSegments,
  type GlyphObstacleBatch,
  type GlyphObstaclePanel,
  crosshairGlyphObstacles,
} from "./host-geometry.js";

export { resolveSemanticKeys, resolveSemanticKeysForPlot } from "./semantic-keys-resolve.js";
export type { ResolveSemanticKeysResult } from "./semantic-keys-resolve.js";

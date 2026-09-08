// @ggts-sh/core — PURE entrypoint: pipeline + SVG-string renderer +
// metrics-table measurer. Importable in Node/edge/workers with no DOM
// globals (enforced by the Node smoke test). Dependency direction (plan):
// spec <- core <- svelte. The DOM half (canvas renderer, browser measurer)
// lives behind "@ggts-sh/core/dom".
//
// Lean identity-chart surface (no heavy stats / specialty geoms):
// `@ggts-sh/core/render`.
//
// Lifecycle (Hadley lesson 13; meanings in CONTRIBUTING.md): tags collected
// into lifecycle.json by scripts/gen-lifecycle.ts.
// @lifecycle-default experimental

// Panel routing shared by every renderer (SVG string, canvas, Svelte scene).
export { groupBatchesByPanel } from "./group-batches-by-panel.js";

// Registration is explicit (#1420): this barrel has NO module-scope side
// effects. Call `registerAll()` for the full grammar (the pre-#1420 barrel
// behavior), `registerBasic()` for identity charts, or per-family
// `register<Family>()` functions. `@ggts-sh/core/render` keeps basic
// auto-registration on import for lean identity-chart graphs. Interaction
// candidates install explicitly too (#1421): `installCandidates()` — GGPlot
// calls it; headless renderers never need it.
export { registerAll, registerBasic } from "./register.js";
export { registerAllStatFrames } from "./pipeline/frame-stats-register-all.js";
export { registerAllGeomBatches } from "./pipeline/geometry-register-all.js";
export { installTemporal } from "./install-temporal.js";
export { installCandidates } from "./install-candidates.js";

// Per-family registration: granular opt-in for spec-driven apps, and the
// mechanism <Geom*> components use to self-register (#1422-generated shells).
export { registerContinuousLegend } from "./legend-register-continuous.js";
export { registerDiscreteLegend } from "./legend-register-discrete.js";
export { registerBandGuide } from "./layout/register-band-guide.js";
export { registerAllStyleKinds } from "./pipeline/register-style-all.js";
export { registerFiniteStyle } from "./pipeline/register-style-finite.js";
export { registerNumericStyle } from "./pipeline/register-style-numeric.js";
export { registerAllColorKinds } from "./pipeline/register-color-all.js";
export { registerBinnedColor } from "./pipeline/register-color-binned.js";
export { registerIdentityColor } from "./pipeline/register-color-identity.js";
export { registerManualColor } from "./pipeline/register-color-manual.js";
export { registerOrdinalColor } from "./pipeline/register-color-ordinal.js";
export { registerSequentialColor } from "./pipeline/register-color-sequential.js";
export { registerBasicAreas } from "./pipeline/register-basic-areas.js";
export { registerBasicBars } from "./pipeline/register-basic-bars.js";
export { registerBasicGlyphs } from "./pipeline/register-basic-glyphs.js";
export { registerBasicLines } from "./pipeline/register-basic-lines.js";
export { registerBasicPoints } from "./pipeline/register-basic-points.js";
export { registerBasicRects } from "./pipeline/register-basic-rects.js";
export { registerBasicSegments } from "./pipeline/register-basic-segments.js";
export { registerAbline } from "./pipeline/register-abline.js";
export { registerAlign } from "./pipeline/register-align.js";
export { registerBin } from "./pipeline/register-bin.js";
export { registerBin2d } from "./pipeline/register-bin-2d.js";
export { registerBoxplot } from "./pipeline/register-boxplot.js";
export { registerConnect } from "./pipeline/register-connect.js";
export { registerContour } from "./pipeline/register-contour.js";
export { registerCrossbar } from "./pipeline/register-crossbar.js";
export { registerCurve } from "./pipeline/register-curve.js";
export { registerDensity } from "./pipeline/register-density.js";
export { registerDensity2d } from "./pipeline/register-density-2d.js";
export { registerDensity2dFilled } from "./pipeline/register-density-2d-filled.js";
export { registerDotplot } from "./pipeline/register-dotplot.js";
export { registerEcdf } from "./pipeline/register-ecdf.js";
export { registerEllipse } from "./pipeline/register-ellipse.js";
export { registerErrorbar } from "./pipeline/register-errorbar.js";
export { registerFunction } from "./pipeline/register-function.js";
export { registerHex } from "./pipeline/register-hex.js";
export { registerLinerange } from "./pipeline/register-linerange.js";
export { registerManual } from "./pipeline/register-manual.js";
export { registerMap } from "./pipeline/register-map.js";
export { registerPointrange } from "./pipeline/register-pointrange.js";
export { registerPolygon } from "./pipeline/register-polygon.js";
export { registerQq } from "./pipeline/register-qq.js";
export { registerQqLine } from "./pipeline/register-qq-line.js";
export { registerQuantile } from "./pipeline/register-quantile.js";
export { registerRaster } from "./pipeline/register-raster.js";
export { registerRug } from "./pipeline/register-rug.js";
export { registerSf } from "./pipeline/register-sf.js";
export { registerSfLabel } from "./pipeline/register-sf-label.js";
export { registerSfText } from "./pipeline/register-sf-text.js";
export { registerSmooth } from "./pipeline/register-smooth.js";
export { registerSpoke } from "./pipeline/register-spoke.js";
export { registerSummary } from "./pipeline/register-summary.js";
export { registerSummaryBin } from "./pipeline/register-summary-bin.js";
export { registerSummaryRolling } from "./pipeline/register-summary-rolling.js";
export { registerTile } from "./pipeline/register-tile.js";
export { registerUnique } from "./pipeline/register-unique.js";
export { registerViolin } from "./pipeline/register-violin.js";

// Data binding
export {
  cellsToNumeric,
  cellToNumber,
  ColumnTable,
  discretenessOf,
  inferFieldType,
  isISODateString,
} from "./table.js";
export type { CellValue, Columns, Discreteness, FieldType, Rows } from "./table.js";

// Runtime data-changing filters (interactive legends and linked views)
export { compileRuntimeRowIndexFilter } from "./runtime-filter.js";
export type {
  RuntimeRowIndexFilter,
  RuntimeRowFilterClause,
  RuntimeRowFilterMode,
} from "./runtime-filter.js";

// Facet panel identity (typed and independent of display position)
export { createFacetPanelIdentity } from "./facet-identity.js";
export type {
  FacetPanelIdentity,
  FacetPanelIdentityInput,
  FacetPanelRole,
  FacetPanelValueIdentity,
} from "./facet-identity.js";

// Grouping (decision 0005)
export { deriveGroups, inferDiscreteness } from "./grouping.js";
export type { AesMapping, DeclaredDiscreteness, GroupDerivation } from "./grouping.js";

// Stats + positions
export { statCount } from "./stats/count.js";
export type { CountStatInput, CountStatResult } from "./stats/count.js";
export { statSum } from "./stats/sum.js";
export type { SumStatInput, SumStatResult } from "./stats/sum.js";
export { statEcdf } from "./stats/ecdf.js";
export type { EcdfStatInput, EcdfStatResult } from "./stats/ecdf.js";
export { statSummaryRolling } from "./stats/summary-rolling.js";
export type { SummaryRollingStatInput, SummaryRollingStatResult } from "./stats/summary-rolling.js";
export { positionDodge, positionStack } from "./positions/positions.js";
export type { DodgeInput, DodgeResult, StackInput, StackResult } from "./positions/positions.js";

// Scale state + training (decision 0002)
export {
  adoptScaleState,
  decodeKey,
  encodeKey,
  fnv1a,
  freshScaleState,
  PaletteExhaustedError,
  paletteFingerprint,
  SCALE_STATE_VERSION,
  serializeScaleState,
  trainDiscrete,
} from "./scales/state.js";
export type {
  DiscreteScaleSpec,
  ScaleState,
  ScaleWarning,
  ScaleWarningCode,
  TrainMode,
  TrainResult,
} from "./scales/state.js";
export {
  bandKey,
  CATEGORICAL_SCHEMES,
  CATEGORICAL_PALETTE_10,
  COLORBLIND_PALETTE,
  ECONOMIST_PALETTE,
  FEW_DARK_PALETTE,
  FEW_LIGHT_PALETTE,
  FEW_PALETTE,
  finiteExtent,
  FIVETHIRTYEIGHT_PALETTE,
  FLEXOKI_PALETTE,
  IPSUM_PALETTE,
  niceLinearDomain,
  PTOL_PALETTE,
  CANVA_PALETTE,
  ScaleConfigError,
  SOLARIZED_PALETTE,
  STATA_PALETTE,
  trainBand,
  trainColor,
  trainContinuous,
  trainLinear,
  WSJ_BLACK_GREEN_PALETTE,
  WSJ_DEM_REP_PALETTE,
  TABLEAU20_PALETTE,
  TABLEAU_COLORBLIND_PALETTE,
  TABLEAU_HUE_CIRCLE_PALETTE,
  TABLEAU_JEWEL_BRIGHT_PALETTE,
  TABLEAU_SEATTLE_GRAYS_PALETTE,
  WSJ_PALETTE,
  WSJ_RED_GREEN_PALETTE,
  WSJ_RGBY_PALETTE,
  PANDER_PALETTE,
} from "./scales/train.js";
export type {
  BandConfig,
  BandScale,
  ColorScale,
  ContinuousConfig,
  ContinuousScale,
  ContinuousTraining,
  OrdinalColorConfig,
  PositionScale,
} from "./scales/train.js";
export {
  buildRampLut,
  rampColor,
  RAMP_LUT_STEPS,
  sampleRampLut,
  trainSequential,
  VIRIDIS_RAMP_10,
} from "./scales/color.js";
export { sequentialSchemeRamp } from "./scales/sequential-schemes.js";
export { sampleSequentialPalette } from "./scales/train-color.js";
export type { SequentialColorScale, SequentialConfig } from "./scales/color.js";

// Pre-stat position scale transform registry (PR 3)
export { getScaleTransform, POSITION_TRANSFORM_NAMES, scaleTransform } from "./scales/transform.js";
export type { PositionTransformName, ScaleTransform } from "./scales/transform.js";
export { MAX_BINNED_BREAKS } from "./pipeline/binned-scale.js";

// Post-stat coordinate projector (PR 4)
export {
  buildCoordAxisProjector,
  buildPanelCoordProjector,
  scalesForCoordExpand,
} from "./coord-projector.js";
export type {
  CoordAxisProjector,
  CoordProjectorInput,
  PanelCoordProjector,
} from "./coord-projector.js";
export {
  buildPolarProjector,
  polarBBox,
  polarProject,
  polarProjectPanelPoint,
  polarUnproject,
} from "./coord-polar.js";
export type {
  PolarBBox,
  PolarProjector,
  PolarProjectorConfig,
  PolarReverse,
  PolarTheta,
} from "./coord-polar.js";

// Model-owned plot-pixel ↔ semantic projection
export type {
  AxisEditModel,
  ClientRect,
  CreateSemanticViewportInput,
  NormalizedSpan,
  PlotRect,
  SemanticViewportAxisSelection,
  SemanticViewport,
  SemanticViewportDomains,
  SemanticViewportPanel,
  SemanticViewportSelection,
} from "./semantic-viewport.js";

// Theme registry
export { BUILTIN_THEMES, resolveTheme, themeVar, UnknownThemeError } from "./theme.js";
export type { ThemeColorRole, ThemeRole, ThemeTokens } from "./theme.js";

// Defaults editions (Hadley lesson 13; normalize() stamps spec.edition)
export { EDITION_DEFAULTS, resolveEditionDefaults } from "./editions.js";
export type { EditionDefaults, ResolvedEdition } from "./editions.js";

// Diagnostics catalog (render-time errors/warnings/advisories — docs render from it)
export {
  ADVISORY_CATALOG,
  CLI_DIAGNOSTIC_CATALOG,
  PIPELINE_ERROR_CATALOG,
  PIPELINE_WARNING_CATALOG,
} from "./diagnostics.js";
export type {
  AdvisoryCode,
  CLIDiagnosticCode,
  DiagnosticCode,
  PipelineErrorCatalogEntry,
  PipelineErrorCode,
  PipelineWarningCode,
} from "./diagnostics.js";

// Layout (decision 0003)
export { humanizeFieldTitle, spaceFieldName } from "./humanize-field.js";
export { DEFAULT_FONT_STACK, MetricsTableMeasurer } from "./layout/measure.js";
export type { MetricsTable, TextMeasurer } from "./layout/measure.js";
export { FONT_METRICS } from "./layout/font-metrics.js";
export {
  defaultLogTickFormat,
  defaultTickFormat,
  linearTicks,
  logTicks,
  tickStep,
} from "./layout/ticks.js";
export { defaultTimeTickFormat, timeTicks } from "./layout/time.js";
export type { TimeTicksResult } from "./layout/time.js";
export {
  compileTemporalLabelFormat,
  formatTemporalTickSequence,
  formatTime,
  numberFormatter,
} from "./layout/format.js";
export type {
  NumberFormatter,
  TemporalLabelFormatOptions,
  TemporalTickLabel,
} from "./layout/format.js";
export { planTemporalAxis } from "./layout/temporal-guide.js";
export type {
  AxisGuidePlan,
  AxisGuideTick,
  ColorbarGuidePlan,
  ColorbarGuideTick,
  ColorstepsGuidePlan,
  ColorstepsGuideStep,
  DiscreteGuideEntry,
  DiscreteGuidePlan,
  GuidePlan,
  TemporalAxisPlanInput,
} from "./layout/temporal-guide.js";
export { planBandAxis } from "./layout/band-guide.js";
export type {
  BandAxisPlan,
  BandAxisPlanInput,
  BandGuideConfig,
  BandLabelMode,
} from "./layout/band-guide.js";
export { DEFAULT_LAYOUT_THEME, layout, layoutPass, marginDelta } from "./layout/layout.js";
export type {
  AxisResult,
  Domain,
  LayoutAxisPresentation,
  LayoutInput,
  LayoutResult,
  LayoutTheme,
  Margins,
  PassResult,
  Tick,
  TickFormatter,
} from "./layout/layout.js";

// Domain presentation labels (scale-domain; legend.ts re-exports for one-release compat)
export { disambiguatedLabels } from "./domain-labels.js";

// Legends
export { buildLegends, LEGEND_ROW_HEIGHT } from "./legend.js";
export type {
  DiscreteLegendInput,
  LegendBlock,
  LegendInput,
  LegendOrder,
  RampLegendInput,
  StepsLegendInput,
} from "./legend.js";

// Pipeline
export { batchMarkCount, CANVAS_AUTO_THRESHOLD, PipelineError } from "./pipeline/public-api.js";
export { runPipeline } from "./pipeline/run-pipeline-full.js";
export type {
  Advisory,
  AxisValueFormatter,
  LayerBackend,
  MappedField,
  NamedData,
  PipelineWarning,
  RenderModel,
  ResolvedColorScale,
  RunOptions,
  ScaleDecision,
  ScaleDiagnostic,
  ScaleDiagnosticFix,
  TrainedScales,
  ScaleDomainSnapshot,
} from "./pipeline/public-api.js";
export { LineageStore } from "./identity.js";
export type { LineageRef } from "./identity.js";
export { buildCandidateStore, canonicalAxisToken } from "./candidate-store.js";
export type {
  CandidateBatchFacts,
  CandidateBuildFacts,
  CandidateDatum,
  CandidateDatumColumns,
  CandidateFacts,
  CandidateGroup,
  CandidateInspectMode,
  CandidateMatch,
  CandidateRange,
  CandidateStyleColumn,
  ResolvedCandidateInspectMode,
  CandidateStore,
  CandidateStoreOptions,
  CanonicalAxisToken,
  TraversalDirection,
} from "./candidate-store.js";
export { buildInteractionMasks, buildPrimitiveInteractionMasks } from "./interaction-mask.js";
export type {
  BatchInteractionMask,
  FocusedPrimitive,
  SemanticCandidateKeys,
} from "./interaction-mask.js";
export { PANEL_SPACING, STRIP_BAND } from "./scene.js";
export { letterboxGutterRects } from "./letterbox-gutters.js";
export type { LetterboxRect } from "./letterbox-gutters.js";
export { LINETYPE_DASHES, linetypeIndex, pointShapeIndex } from "./scales/style.js";
export type {
  Linetype,
  PointShape,
  ResolvedStyleScale,
  StyleOutput,
  StyleScale,
} from "./scales/style.js";
export type {
  GeometryBatch,
  GlyphsBatch,
  PathsBatch,
  PointsBatch,
  RectsBatch,
  Scene,
  SceneAxis,
  SceneDiscreteLegend,
  SceneLegend,
  SceneLegendEntry,
  ScenePanel,
  SceneRampLegend,
  SceneStepsLegend,
  SceneTick,
  SegmentsBatch,
} from "./scene.js";

// Strata planning (pure — the DOM adapter builds the stratum elements)
export { planStrata } from "./strata.js";
export type { Stratum } from "./strata.js";

// SVG renderer (pure)
export { countMarks, pathData, sceneLabel, sceneToSVGString } from "./render-svg.js";
export {
  renderToSVGString, // @lifecycle stable-intent
} from "./render-svg-full.js";
/** @lifecycle stable-intent */
export type { RenderSVGOptions } from "./render-svg.js";

// Renderer-neutral mark style (shapes, dash, stroke-null) for SVG/canvas/Svelte
export {
  areaOutlineActive,
  linetypeDash,
  markLinetype,
  pointShapeGeometry,
  pointShapePathD,
  resolveGlyphMark,
  resolvePathMark,
  resolvePointMark,
  resolveRectMark,
  resolveSegmentMark,
} from "./mark-style.js";
export type {
  PointShapeGeometry,
  ResolvedGlyphMark,
  ResolvedPathMark,
  ResolvedPointMark,
  ResolvedRectMark,
  ResolvedSegmentMark,
} from "./mark-style.js";

// Within-mark paint (#591) — resource ids and resolved gradient/glow
export { paintResourceId } from "./mark-paint.js";
export type { ResolvedGlow, ResolvedGradientPaint } from "./mark-paint.js";

// CLI implementation (the `ggts render` bin on @ggts-sh/cli wraps this)
export { runCLI } from "./cli.js";
export type { CLIIO } from "./cli.js";

// Inspect×geom pure collectors (host ondiagnostic + CLI --inspect, #1531)
export {
  collectInspectIntentDiagnostics,
  discreteColorFillDomainSizes,
  HIGH_CARDINALITY_DISCRETE_THRESHOLD,
  INSPECT_GEOM_DIAGNOSTIC_CATALOG,
  INSPECT_INTENT_MODES,
  inspectAxisOnBarColDiagnostics,
  inspectAxisOnDistributionDiagnostics,
  inspectHighCardinalityDiagnostics,
  isInspectIntentMode,
  layerGeomsFromSpecLayers,
} from "./inspect-geom-advisories.js";
export type {
  InspectGeomAdvisory,
  InspectGeomAdvisoryCode,
  InspectIntentMode,
} from "./inspect-geom-advisories.js";

// Instrumentation
export { perfMark, perfMeasure } from "./perf.js";

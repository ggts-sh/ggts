// @ggts-sh/spec — spec types, schemas, normalize(), validate(), portability,
// fluent builder. Zero d3, zero DOM. TypeBox is the schema source of truth
// (decision 0004): the same definitions provide the TS types (Static<>), the
// runtime validator, and the published JSON Schema artifact (schema/v0.json).
//
// Lifecycle (Hadley lesson 13; meanings in CONTRIBUTING.md): every export
// carries a lifecycle tag, collected into the generated lifecycle.json by
// scripts/gen-lifecycle.ts. Untagged exports inherit the file default below;
// statements tag themselves with a one-line "@lifecycle <tag>" JSDoc marker;
// individual names use a trailing "@lifecycle <tag>" line comment.
// @lifecycle-default experimental

// Schemas + Static types
export { AesSchema, AreaLayerSchema, BarLayerSchema, BoxplotLayerSchema } from "./schema.js";
export { CATEGORICAL_SCHEME_NAMES, CHANNELS, COLOR_SCHEME_NAMES } from "./schema.js";
export { CYCLIC_SCHEME_NAMES, ChannelValueSchema, ColLayerSchema } from "./schema.js";
export { CoordSpecSchema, CoordFixedSpecSchema, CoordSfSpecSchema } from "./schema.js";
export { CoordRadialSpecSchema, CoordTransformAxisSpecSchema } from "./schema.js";
export { CoordTransformSpecSchema, CURRENT_EDITION, DataRefSchema } from "./schema.js";
export { DensityLayerSchema, DotplotLayerSchema, ErrorbarLayerSchema } from "./schema.js";
export { LinerangeLayerSchema, PointrangeLayerSchema, CrossbarLayerSchema } from "./schema.js";
export { RectLayerSchema, TileLayerSchema, Bin2dLayerSchema, RasterLayerSchema } from "./schema.js";
export { HexLayerSchema, RibbonLayerSchema, SegmentLayerSchema } from "./schema.js";
export { CountLayerSchema, ViolinLayerSchema, FunctionLayerSchema } from "./schema.js";
export { PolygonLayerSchema, AblineLayerSchema, CurveLayerSchema } from "./schema.js";
export { RugLayerSchema, StepLayerSchema, QqLayerSchema, QqLineLayerSchema } from "./schema.js";
export { FacetFieldRefSchema, FacetStripSpecSchema, FacetSpecSchema } from "./schema.js";
export { ALIAS_GEOMS, GEOM_ALIASES, GEOM_DEFAULTS, HistogramLayerSchema } from "./schema.js";
export { FreqpolyLayerSchema, HlineLayerSchema, JitterLayerSchema, KNOWN_GEOMS } from "./schema.js";
export { KNOWN_POSITIONS, KNOWN_STATS, LayerSpecSchema, LineLayerSchema } from "./schema.js";
export { PathLayerSchema, LINETYPE_NAMES, MAX_BINNED_BREAKS, MAX_GLOW_RADIUS } from "./schema.js";
export { MAX_PAINT_STOPS, POINT_SHAPE_NAMES, PlotSpecSchema, PointLayerSchema } from "./schema.js";
export { RuleLayerSchema, VlineLayerSchema, ScalesSchema } from "./schema.js";
export { SEQUENTIAL_SCHEME_NAMES, TemporalParserSpecSchemaRef } from "./schema.js";
export { SmoothLayerSchema, SpecModule, TextLayerSchema, LabelLayerSchema } from "./schema.js";
export { THEME_NAMES, THEME_NAME_ALIASES } from "./schema.js";
export type { A11yMode, Aes, AreaLayer, AreaParams, BarLayer, BarParams } from "./schema.js";
export type { BoxplotLayer, BoxplotParams, CellValue, ChannelName } from "./schema.js";
export type { ChannelValue, ColorStop, ColLayer, ColorScaleSpec, GradientPaint } from "./schema.js";
export type { GlowSpec, LinearGradientPaint, PaintSpace, RadialGradientPaint } from "./schema.js";
export type { AlphaScaleSpec, ColParams, CoordSpec, CoordFixedSpec } from "./schema.js";
export type { CoordSfSpec, CoordRadialSpec, CoordTransformAxisSpec } from "./schema.js";
export type { CoordTransformSpec, DataColumns, DataName, DataRef, DataValues } from "./schema.js";
export type { DensityLayer, DensityParams, Density2dParams, Density2dLayer } from "./schema.js";
export type { Density2dFilledLayer, DotplotLayer, DotplotParams, ErrorbarLayer } from "./schema.js";
export type { ErrorbarParams, LinerangeLayer, LinerangeParams, PointrangeLayer } from "./schema.js";
export type { PointrangeParams, CrossbarLayer, CrossbarParams, RectLayer } from "./schema.js";
export type { RectParams, TileLayer, TileParams, Bin2dLayer, Bin2dParams } from "./schema.js";
export type { RasterLayer, RasterParams, HexLayer, HexParams, RibbonLayer } from "./schema.js";
export type { RibbonParams, FacetFieldRef, FacetScales, FacetSpec } from "./schema.js";
export type { FacetStripSpec, AliasGeomName, GeomName, NormalizedGeomName } from "./schema.js";
export type { NormalizedLayerSpec, NormalizedSpec, GuideSpec, GuidesSpec } from "./schema.js";
export type { GuideThemeSpec, AxisGuideSpec, LegendGuideSpec } from "./schema.js";
export type { ColorbarGuideSpec, ColorstepsGuideSpec, NoneGuideSpec } from "./schema.js";
export type { HistogramLayer, FreqpolyLayer, HlineLayer, HlineParams } from "./schema.js";
export type { InlineData, JitterLayer, Labs, LayerSpec, LegendSpec, LineLayer } from "./schema.js";
export type { LineParams, PathParams, PathLayer, StepLayer, StepParams } from "./schema.js";
export type { PointLayer, PointParams, PointPosition } from "./schema.js";
export type {
  PortableSpec, // @lifecycle stable-intent
} from "./schema.js";
export type { PositionName, PositionParams, PositionScaleSpec } from "./schema.js";
export type { PositiveStyleScaleSpec, ShapeScaleSpec, LinetypeScaleSpec } from "./schema.js";
export type { LinetypeName, PointShapeName, RenderBackend, RuleLayer } from "./schema.js";
export type { RuleParams, VlineLayer, VlineParams, SegmentLayer, CurveLayer } from "./schema.js";
export type { SfLayer, SfTextLayer, SfLabelLayer, SpokeLayer, SpokeParams } from "./schema.js";
export type { SegmentParams, CountLayer, ViolinLayer, ViolinParams } from "./schema.js";
export type { FunctionLayer, FunctionParams, FunctionRegistryName } from "./schema.js";
export type { FunctionArgs, PolygonLayer, PolygonParams, AblineLayer } from "./schema.js";
export type { AblineParams, CurveParams, MapParams, SfParams, MapLayer } from "./schema.js";
export type { SfTextParams, SfLabelParams, BlankLayer, BlankParams, RugLayer } from "./schema.js";
export type { RugParams, QqLayer, QqParams, QqLineLayer, QqLineParams } from "./schema.js";
export type { ScaleExpansion, Scales, QuantileLayer, QuantileParams } from "./schema.js";
export type { ContourParams, ContourLayer, SmoothLayer, SmoothParams } from "./schema.js";
export type { StackablePosition, StatName, SummaryFun, TextLayer, LabelLayer } from "./schema.js";
export type { TemporalParserSpec, TextParams, LabelParams, ThemeName } from "./schema.js";
export type { ThemeSpec } from "./schema.js";

export { guideAxis, guideColorbar, guideColorsteps, guideLegend } from "./guide-helpers.js";
export { guideNone, guides, guide_axis, guide_colorbar } from "./guide-helpers.js";
export { guide_colorsteps, guide_legend, guide_none } from "./guide-helpers.js";
export type { AxisGuideOptions, ColorbarGuideOptions } from "./guide-helpers.js";
export type { ColorstepsGuideOptions, LegendGuideOptions } from "./guide-helpers.js";

// Checked public capability ledger
export { buildGreyPalette, buildHuePalette, GREY_PALETTE_10 } from "./hue-grey-palettes.js";
export { HUE_PALETTE_10, hslToHex } from "./hue-grey-palettes.js";
export { SCALE_CAPABILITIES, STYLE_AESTHETIC_GEOMS } from "./capabilities.js";
export { STYLE_ORDINAL_SCALE_HELPERS, scaleCapabilityCamelHelpers } from "./capabilities.js";
export { builderScaleHelperNames } from "./capabilities.js";
export type { ScaleCapability, StyleAesthetic } from "./capabilities.js";
/** @lifecycle experimental */
export { GEOM_PARAM_KEYS } from "./geom-params.js";
/** @lifecycle experimental */
export { GEOM_REFERENCE, SHARED_LAYER_PROPS, componentNameForGeom } from "./geom-reference.js";
/** @lifecycle experimental */
export { geomReferenceList } from "./geom-reference.js";
/** @lifecycle experimental */
export type { GeomParamDoc, GeomReferenceEntry, SharedLayerPropDoc } from "./geom-reference.js";
/** @lifecycle experimental */
export { STAT_REFERENCE, statReferenceList } from "./stat-reference.js";
/** @lifecycle experimental */
export type { StatReferenceEntry } from "./stat-reference.js";
/** @lifecycle experimental */
export { POSITION_REFERENCE, positionReferenceList } from "./position-reference.js";
/** @lifecycle experimental */
export type { PositionParamDoc, PositionReferenceEntry } from "./position-reference.js";
/** @lifecycle experimental */
export { COORD_REFERENCE, KNOWN_COORD_TYPES, coordReferenceList } from "./coord-reference.js";
/** @lifecycle experimental */
export type { CoordParamDoc, CoordReferenceEntry, CoordTypeName } from "./coord-reference.js";
/** @lifecycle experimental */
export { SCALE_FAMILY_LABELS, SCALE_REFERENCE, allScaleHelpers } from "./scale-reference.js";
/** @lifecycle experimental */
export { componentNameForScaleHelper, knownScaleSlugs } from "./scale-reference.js";
/** @lifecycle experimental */
export { primaryScaleHelpers, scaleReferenceByFamily } from "./scale-reference.js";
/** @lifecycle experimental */
export { scaleReferenceList, scaleReferencePrimaries } from "./scale-reference.js";
/** @lifecycle experimental */
export { slugForScaleHelper } from "./scale-reference.js";
/** @lifecycle experimental */
export type { ScaleAesthetic, ScaleFamily, ScaleParamDoc } from "./scale-reference.js";
/** @lifecycle experimental */
export type { ScaleReferenceEntry } from "./scale-reference.js";
/** @lifecycle experimental */
export { GUIDE_CHANNELS, GUIDE_REFERENCE, KNOWN_GUIDE_TYPES } from "./guide-reference.js";
/** @lifecycle experimental */
export { guideReferenceList } from "./guide-reference.js";
/** @lifecycle experimental */
export type { GuideChannelName, GuideParamDoc, GuideReferenceEntry } from "./guide-reference.js";
/** @lifecycle experimental */
export type { GuideTypeName } from "./guide-reference.js";

// Temporal parsing, inference, and authoring conversions
export { canonicalTemporalParserKey, dmy, dmy_hm, dmy_hms, dym, dym_hm } from "./temporal.js";
export { dym_hms, fromEpochMilliseconds, fromEpochSeconds } from "./temporal.js";
export { inferTemporalColumn, mdy, mdy_hm, mdy_hms, my, myd, myd_hm, myd_hms } from "./temporal.js";
export { parseTemporal, parseTemporalColumn, parseTemporalFormat } from "./temporal.js";
export { TEMPORAL_PARSER_NAMES, temporalParserConfigurationError } from "./temporal.js";
export { TemporalParseError, TemporalParserSpecSchema, ydm, ydm_hm, ydm_hms } from "./temporal.js";
export { ym, ymd, ymd_hm, ymd_hms, yq } from "./temporal.js";
export type { TemporalDecision, TemporalDisambiguation, TemporalFailure } from "./temporal.js";
export type { TemporalKind, TemporalScaleKind, ParsedTemporalColumn } from "./temporal.js";
export type { TemporalParseOptions, TemporalParseResult, TemporalParserName } from "./temporal.js";
export type { TemporalPrecision } from "./temporal.js";
export { MONTH_DAY_REFERENCE_YEAR } from "./temporal.js";
/** Registers `@js-temporal/polyfill` for full temporal graphs (not lean render). */
export { ensureTemporalPolyfill } from "./temporal-polyfill.js";
export { MAX_TEMPORAL_CANDIDATES, MAX_TEMPORAL_MAJOR_TICKS } from "./temporal-guides.js";
export { MAX_TEMPORAL_MINOR_TICKS, MIN_TEMPORAL_LABEL_GAP_PX } from "./temporal-guides.js";
export { parseTemporalInterval, TEMPORAL_INTERVAL_UNITS } from "./temporal-guides.js";
export { TEMPORAL_LABEL_TOKENS, TEMPORAL_WEEKDAYS } from "./temporal-guides.js";
export { TemporalIntervalError, TemporalIntervalSpecSchema } from "./temporal-guides.js";
export { TemporalLabelSpecSchema, temporalIntervalTicks } from "./temporal-guides.js";
export { temporalLabelConfigurationError } from "./temporal-guides.js";
export { temporalLocaleConfigurationError, TemporalWeekStartSchema } from "./temporal-guides.js";
export type { TemporalInterval, TemporalIntervalSpec } from "./temporal-guides.js";
export type { TemporalIntervalUnit, TemporalWeekStart } from "./temporal-guides.js";

// Coordinate helpers
export { coord_equal, coord_fixed, coord_polar, coord_radial, coord_sf } from "./coord-helpers.js";
export { coord_transform, coordEqual, coordFixed, coordPolar } from "./coord-helpers.js";
export { coordRadial, coordSf, coordTransform } from "./coord-helpers.js";
export type { CoordFixedOptions, CoordPolarOptions, CoordRadialOptions } from "./coord-helpers.js";
export type { CoordRadialReverse, CoordRadialTheta, CoordSfOptions } from "./coord-helpers.js";
export type { CoordTransformAxisOptions, CoordTransformName } from "./coord-helpers.js";
export type { CoordTransformOptions } from "./coord-helpers.js";
// Scale helpers
export { configuredColorScaleType, canonicalMultiScaleChannel } from "./scale-helpers.js";
export { scaleContinuousIdentity, scaleDiscreteIdentity } from "./scale-helpers.js";
export { scaleDiscreteManual, scaleType, scale_continuous_identity } from "./scale-helpers.js";
export { scale_discrete_identity, scale_discrete_manual, scale_type } from "./scale-helpers.js";
export { scaleColorBinned, scaleColorBrewer, scaleColorContinuous } from "./scale-helpers.js";
export { scaleColorDate, scaleColorDatetime, scaleColorDiscrete } from "./scale-helpers.js";
export { scaleColorDistiller, scaleColorFermenter, scaleColorGradient } from "./scale-helpers.js";
export { scaleColorGradient2, scaleColorGradientn, scaleColorIdentity } from "./scale-helpers.js";
export { scaleColorLog10, scaleColorManual, scaleColorSqrt } from "./scale-helpers.js";
export { scaleColorSteps, scaleColorSteps2, scaleColorStepsn } from "./scale-helpers.js";
export { scaleColorHue, scaleColorGrey, scaleColorGray } from "./scale-helpers.js";
export { scaleColorOrdinal, scaleColourBinned, scaleColourBrewer } from "./scale-helpers.js";
export { scaleColourContinuous, scaleColourDate, scaleColourDatetime } from "./scale-helpers.js";
export { scaleColourDiscrete, scaleColourDistiller } from "./scale-helpers.js";
export { scaleColourFermenter, scaleColourGradient } from "./scale-helpers.js";
export { scaleColourGradient2, scaleColourGradientn } from "./scale-helpers.js";
export { scaleColourIdentity, scaleColourLog10, scaleColourManual } from "./scale-helpers.js";
export { scaleColourSqrt, scaleColourSteps, scaleColourSteps2 } from "./scale-helpers.js";
export { scaleColourStepsn, scaleColourHue, scaleColourGrey } from "./scale-helpers.js";
export { scaleColourGray, scaleColourOrdinal, scaleFillBinned } from "./scale-helpers.js";
export { scaleFillBrewer, scaleFillContinuous, scaleFillDate } from "./scale-helpers.js";
export { scaleFillDatetime, scaleFillDiscrete, scaleFillDistiller } from "./scale-helpers.js";
export { scaleFillFermenter, scaleFillGradient, scaleFillGradient2 } from "./scale-helpers.js";
export { scaleFillGradientn, scaleFillIdentity, scaleFillLog10 } from "./scale-helpers.js";
export { scaleFillManual, scaleFillSqrt, scaleFillSteps } from "./scale-helpers.js";
export { scaleFillSteps2, scaleFillStepsn, scaleColorViridisB } from "./scale-helpers.js";
export { scaleColorViridisC, scaleColorViridisD, scaleColourViridisB } from "./scale-helpers.js";
export { scaleColourViridisC, scaleColourViridisD, scaleFillViridisB } from "./scale-helpers.js";
export { scaleFillViridisC, scaleFillViridisD, scaleFillHue } from "./scale-helpers.js";
export { scaleFillGrey, scaleFillGray, scaleFillOrdinal } from "./scale-helpers.js";
export { scale_color_binned, scale_color_brewer, scale_color_continuous } from "./scale-helpers.js";
export { scale_color_date, scale_color_datetime, scale_color_discrete } from "./scale-helpers.js";
export { scale_color_distiller, scale_color_fermenter } from "./scale-helpers.js";
export { scale_color_gradient, scale_color_gradient2 } from "./scale-helpers.js";
export { scale_color_gradientn, scale_color_identity, scale_color_log10 } from "./scale-helpers.js";
export { scale_color_manual, scale_color_sqrt, scale_color_steps } from "./scale-helpers.js";
export { scale_color_steps2, scale_color_stepsn, scale_color_viridis_b } from "./scale-helpers.js";
export { scale_color_viridis_c, scale_color_viridis_d, scale_color_hue } from "./scale-helpers.js";
export { scale_color_grey, scale_color_gray, scale_color_ordinal } from "./scale-helpers.js";
export { scale_colour_binned, scale_colour_brewer } from "./scale-helpers.js";
export { scale_colour_continuous, scale_colour_date } from "./scale-helpers.js";
export { scale_colour_datetime, scale_colour_discrete } from "./scale-helpers.js";
export { scale_colour_distiller, scale_colour_fermenter } from "./scale-helpers.js";
export { scale_colour_gradient, scale_colour_gradient2 } from "./scale-helpers.js";
export { scale_colour_gradientn, scale_colour_identity } from "./scale-helpers.js";
export { scale_colour_log10, scale_colour_manual, scale_colour_sqrt } from "./scale-helpers.js";
export { scale_colour_steps, scale_colour_steps2, scale_colour_stepsn } from "./scale-helpers.js";
export { scale_colour_viridis_b, scale_colour_viridis_c } from "./scale-helpers.js";
export { scale_colour_viridis_d, scale_colour_hue, scale_colour_grey } from "./scale-helpers.js";
export { scale_colour_gray, scale_colour_ordinal, scale_fill_binned } from "./scale-helpers.js";
export { scale_fill_brewer, scale_fill_continuous, scale_fill_date } from "./scale-helpers.js";
export { scale_fill_datetime, scale_fill_discrete, scale_fill_distiller } from "./scale-helpers.js";
export { scale_fill_fermenter, scale_fill_gradient } from "./scale-helpers.js";
export { scale_fill_gradient2, scale_fill_gradientn } from "./scale-helpers.js";
export { scale_fill_identity, scale_fill_log10, scale_fill_manual } from "./scale-helpers.js";
export { scale_fill_sqrt, scale_fill_steps, scale_fill_steps2 } from "./scale-helpers.js";
export { scale_fill_stepsn, scale_fill_viridis_b, scale_fill_viridis_c } from "./scale-helpers.js";
export { scale_fill_viridis_d, scale_fill_hue, scale_fill_grey } from "./scale-helpers.js";
export { scale_fill_gray, scale_fill_ordinal, scaleXBinned } from "./scale-helpers.js";
export { scaleXContinuous, scaleXDate, scaleXDatetime, scaleXTime } from "./scale-helpers.js";
export { scaleXDiscrete, scaleXLog10, scaleXReverse, scaleXSqrt } from "./scale-helpers.js";
export { scaleYBinned, scaleYContinuous, scaleYDate, scaleYDatetime } from "./scale-helpers.js";
export { scaleYTime, scaleXMonthDay, scaleYMonthDay, scaleYDiscrete } from "./scale-helpers.js";
export { scaleYLog10, scaleYReverse, scaleYSqrt, scale_x_binned } from "./scale-helpers.js";
export { scale_x_continuous, scale_x_date, scale_x_datetime } from "./scale-helpers.js";
export { scale_x_time, scale_x_discrete, scale_x_log10, scale_x_reverse } from "./scale-helpers.js";
export { scale_x_sqrt, scale_y_binned, scale_y_continuous, scale_y_date } from "./scale-helpers.js";
export { scale_y_datetime, scale_y_time, scale_x_month_day } from "./scale-helpers.js";
export { scale_y_month_day, scale_y_discrete, scale_y_log10 } from "./scale-helpers.js";
export { scale_y_reverse, scale_y_sqrt } from "./scale-helpers.js";
export { scaleAlpha, scaleAlphaBinned, scaleAlphaContinuous } from "./scale-helpers.js";
export { scaleAlphaDate, scaleAlphaDatetime, scaleAlphaDiscrete } from "./scale-helpers.js";
export { scaleAlphaIdentity, scaleAlphaManual, scaleAlphaOrdinal } from "./scale-helpers.js";
export { scaleLinewidth, scaleLinewidthBinned, scaleLinewidthContinuous } from "./scale-helpers.js";
export { scaleLinewidthDate, scaleLinewidthDatetime } from "./scale-helpers.js";
export { scaleLinewidthDiscrete, scaleLinewidthIdentity } from "./scale-helpers.js";
export { scaleLinewidthManual, scaleLinewidthOrdinal, scaleLinetype } from "./scale-helpers.js";
export { scaleLinetypeBinned, scaleLinetypeDiscrete } from "./scale-helpers.js";
export { scaleLinetypeIdentity, scaleLinetypeManual, scaleShape } from "./scale-helpers.js";
export { scaleShapeBinned, scaleShapeDiscrete, scaleShapeIdentity } from "./scale-helpers.js";
export { scaleShapeManual, scaleShapeOrdinal, scaleSize, scaleSizeArea } from "./scale-helpers.js";
export { scaleSizeBinned, scaleSizeBinnedArea, scaleSizeContinuous } from "./scale-helpers.js";
export { scaleSizeDate, scaleSizeDatetime, scaleSizeDiscrete } from "./scale-helpers.js";
export { scaleSizeIdentity, scaleSizeManual, scaleSizeOrdinal } from "./scale-helpers.js";
export { scaleRadius, scale_alpha, scale_alpha_binned } from "./scale-helpers.js";
export { scale_alpha_continuous, scale_alpha_date, scale_alpha_datetime } from "./scale-helpers.js";
export { scale_alpha_discrete, scale_alpha_identity, scale_alpha_manual } from "./scale-helpers.js";
export { scale_alpha_ordinal, scale_linetype, scale_linetype_binned } from "./scale-helpers.js";
export { scale_linetype_discrete, scale_linetype_identity } from "./scale-helpers.js";
export { scale_linetype_manual, scale_linewidth, scale_linewidth_binned } from "./scale-helpers.js";
export { scale_linewidth_continuous, scale_linewidth_date } from "./scale-helpers.js";
export { scale_linewidth_datetime, scale_linewidth_discrete } from "./scale-helpers.js";
export { scale_linewidth_identity, scale_linewidth_manual } from "./scale-helpers.js";
export { scale_linewidth_ordinal, scale_shape, scale_shape_binned } from "./scale-helpers.js";
export { scale_shape_discrete, scale_shape_identity, scale_shape_manual } from "./scale-helpers.js";
export { scale_shape_ordinal, scale_size, scale_size_area } from "./scale-helpers.js";
export { scale_size_binned, scale_size_binned_area } from "./scale-helpers.js";
export { scale_size_continuous, scale_size_date, scale_size_datetime } from "./scale-helpers.js";
export { scale_size_discrete, scale_size_identity, scale_size_manual } from "./scale-helpers.js";
export { scale_size_ordinal, scale_radius } from "./scale-helpers.js";
export type { BinnedColorScaleOptions, ColorBrewerScaleOptions } from "./scale-helpers.js";
export type { ColorDistillerScaleOptions, ColorFermenterScaleOptions } from "./scale-helpers.js";
export type { ColorScaleOptions, ContinuousPositionScaleOptions } from "./scale-helpers.js";
export type { DiscreteColorScaleOptions, IdentityColorScaleOptions } from "./scale-helpers.js";
export type { StepsScaleOptions, Steps2ScaleOptions, StepsnScaleOptions } from "./scale-helpers.js";
export type { GradientScaleOptions, Gradient2ScaleOptions } from "./scale-helpers.js";
export type { GradientnScaleOptions, HueScaleOptions, GreyScaleOptions } from "./scale-helpers.js";
export type { OrdinalColorScaleOptions, ManualColorScaleOptions } from "./scale-helpers.js";
export type { ViridisOptionName, ViridisScaleOptions } from "./scale-helpers.js";
export type { MultiIdentityScaleOptions, MultiManualScaleOptions } from "./scale-helpers.js";
export type { MultiScaleAesthetic, MultiScaleChannel } from "./scale-helpers.js";
export type { RecommendedScaleType, ScaleTypeAesthetic } from "./scale-helpers.js";
export type { DiscreteNumericStyleScaleOptions } from "./scale-helpers.js";
export type { BinnedFiniteStyleScaleOptions } from "./scale-helpers.js";
export type { DiscreteFiniteStyleScaleOptions, FiniteStyleScaleOptions } from "./scale-helpers.js";
export type { IdentityFiniteStyleScaleOptions } from "./scale-helpers.js";
export type { IdentityNumericStyleScaleOptions } from "./scale-helpers.js";
export type { ManualFiniteStyleScaleOptions } from "./scale-helpers.js";
export type { ManualNumericStyleScaleOptions, NumericStyleScaleOptions } from "./scale-helpers.js";
export type { SequentialStyleScaleOptions, SizeAreaScaleOptions } from "./scale-helpers.js";
export type { SizeSequentialStyleScaleOptions } from "./scale-helpers.js";
export type { SizeTemporalNumericStyleScaleOptions } from "./scale-helpers.js";
export type { TemporalNumericStyleScaleOptions } from "./scale-helpers.js";
export type { SequentialColorScaleOptions, TemporalColorScaleOptions } from "./scale-helpers.js";
export type { TransformedColorScaleOptions } from "./scale-helpers.js";
export type { DiscretePositionScaleOptions, TemporalScaleOptions } from "./scale-helpers.js";
export type { TransformedPositionScaleOptions } from "./scale-helpers.js";

// Portability (PortableSpec vs RuntimeSpec)
export { isPortable, portabilityIssues, toPortable, toPortableLossy } from "./portability.js";
export { UnportableSpecError } from "./portability.js";
export type { JSONValue, LossyResult, PortabilityIssue } from "./portability.js";
export type { ChannelFn, RuntimeAes, RuntimeAreaLayer, RuntimeBarLayer } from "./runtime.js";
export type { RuntimeBoxplotLayer, RuntimeChannelValue, RuntimeColLayer } from "./runtime.js";
export type { RuntimeDensityLayer, RuntimeErrorbarLayer } from "./runtime.js";
export type { RuntimeLinerangeLayer, RuntimePointrangeLayer } from "./runtime.js";
export type { RuntimeCrossbarLayer, RuntimeRibbonLayer, RuntimeHistogramLayer } from "./runtime.js";
export type { RuntimeFreqpolyLayer, RuntimeHlineLayer, RuntimeJitterLayer } from "./runtime.js";
export type { RuntimeLayerSpec, RuntimeLineLayer, RuntimePathLayer } from "./runtime.js";
export type { RuntimePointLayer, RuntimeRasterLayer, RuntimeHexLayer } from "./runtime.js";
export type { RuntimeRectLayer, RuntimeSegmentLayer, RuntimeCountLayer } from "./runtime.js";
export type { RuntimeViolinLayer, RuntimeFunctionLayer, RuntimePolygonLayer } from "./runtime.js";
export type { RuntimeAblineLayer, RuntimeContourLayer, RuntimeDensity2dLayer } from "./runtime.js";
export type { RuntimeDensity2dFilledLayer, RuntimeDotplotLayer } from "./runtime.js";
export type { RuntimeMapLayer, RuntimeBlankLayer, RuntimeSpokeLayer } from "./runtime.js";
export type { RuntimeRugLayer, RuntimeSfLayer, RuntimeSfTextLayer } from "./runtime.js";
export type { RuntimeSfLabelLayer, RuntimeCurveLayer, RuntimeStepLayer } from "./runtime.js";
export type { RuntimeQqLayer, RuntimeQqLineLayer, RuntimeRuleLayer } from "./runtime.js";
export type { RuntimeSmoothLayer, RuntimeQuantileLayer, RuntimeSpec } from "./runtime.js";
export type { RuntimeTextLayer, RuntimeLabelLayer, RuntimeTileLayer } from "./runtime.js";
export type { RuntimeBin2dLayer, RuntimeVlineLayer } from "./runtime.js";

// Canonicalizer
/** @lifecycle stable-intent */
export { normalize } from "./normalize.js";
export { normalizeChannel } from "./normalize.js";
export type { AesInput, AreaLayerInput, BarLayerInput, BoxplotLayerInput } from "./normalize.js";
export type { ChannelInput, ColLayerInput, DensityLayerInput } from "./normalize.js";
export type { ErrorbarLayerInput, LinerangeLayerInput, PointrangeLayerInput } from "./normalize.js";
export type { CrossbarLayerInput, RibbonLayerInput, SegmentLayerInput } from "./normalize.js";
export type { CountLayerInput, ViolinLayerInput, FunctionLayerInput } from "./normalize.js";
export type { PolygonLayerInput, AblineLayerInput, ContourLayerInput } from "./normalize.js";
export type { Density2dLayerInput, Density2dFilledLayerInput } from "./normalize.js";
export type { DotplotLayerInput, MapLayerInput, BlankLayerInput } from "./normalize.js";
export type { SpokeLayerInput, RugLayerInput, SfLayerInput } from "./normalize.js";
export type { SfTextLayerInput, SfLabelLayerInput, CurveLayerInput } from "./normalize.js";
export type { StepLayerInput, QqLayerInput, QqLineLayerInput } from "./normalize.js";
export type { FacetFieldInput, FacetInput, HistogramLayerInput } from "./normalize.js";
export type { FreqpolyLayerInput, HlineLayerInput, JitterLayerInput } from "./normalize.js";
export type { LayerInput, LineLayerInput, PathLayerInput, PointLayerInput } from "./normalize.js";
export type { RasterLayerInput, HexLayerInput, RectLayerInput } from "./normalize.js";
export type { RuleLayerInput, QuantileLayerInput, SmoothLayerInput } from "./normalize.js";
export type { TileLayerInput, Bin2dLayerInput, SpecInput, TextLayerInput } from "./normalize.js";
export type { LabelLayerInput, VlineLayerInput } from "./normalize.js";

// Validation + agent error contract
/** @lifecycle stable-intent */
export { validate } from "./validate.js";
/** @lifecycle stable-intent */
export type { ValidateResult } from "./validate.js";
/** TypeBox-free structural gate used by the render pipeline. */
export { assertStructuralGate, structuralGateErrors } from "./structural-gate.js";
/** Shared temporal-guide vs explicit scale-type check for validate and render. */
export { temporalGuideTypeMismatchError } from "./validate-data-checks-position.js";
export { LINT_CATALOG, lintSpec } from "./lint.js";
export type { LintAdvisoryCode, LintCatalogEntry, SpecAdvisory } from "./lint.js";
export { ERROR_CATALOG } from "./errors.js";
export type { ErrorCatalogEntry } from "./errors.js";
export { PIPELINE_ERROR_CATALOG } from "./pipeline-error-catalog.js";
export type { PipelineErrorCatalogEntry, PipelineErrorCode } from "./pipeline-error-catalog.js";
export { DEFAULT_VALIDATE_LIMITS, effectiveChannel, STAT_COLUMNS } from "./validate-data.js";
export type { DataProfile, DataProfileField, ProfileFieldType } from "./validate-data.js";
export type { ValidateLimits, ValidateOptions } from "./validate-data.js";
export { didYouMean, ERROR_CODES, levenshtein } from "./errors.js";
export {
  SpecValidationError, // @lifecycle stable-intent
} from "./errors.js";
/** @lifecycle stable-intent */
export type { SpecError, SpecErrorCode, SpecErrorFix } from "./errors.js";

// Fluent builder
export { aes, gg, GGBuilder } from "./builder.js";
/** Authoring data snapshot + portable Date→ISO (shared by builder + assemble). */
export { calendarDateFields, toAuthoringDataRef, toDataRef } from "./builder-data.js";
export type { AuthoringCellValue, AuthoringColumns, AuthoringDataRef } from "./builder.js";
export type { AuthoringRows, DataInput, GeomAreaOptions, GeomBarOptions } from "./builder.js";
export type { GeomBoxplotOptions, GeomColOptions, GeomDensityOptions } from "./builder.js";
export type { GeomDensity2dOptions, GeomDensity2dFilledOptions } from "./builder.js";
export type { GeomDotplotOptions, GeomErrorbarOptions, GeomLinerangeOptions } from "./builder.js";
export type { GeomPointrangeOptions, GeomCrossbarOptions } from "./builder.js";
export type { GeomHistogramOptions, GeomFreqpolyOptions, GeomHlineOptions } from "./builder.js";
export type { GeomJitterOptions, GeomLineOptions, GeomPathOptions } from "./builder.js";
export type { GeomPointOptions, GeomQuantileOptions, GeomContourOptions } from "./builder.js";
export type { GeomRasterOptions, GeomHexOptions, GeomRectOptions } from "./builder.js";
export type { GeomRuleOptions, GeomRugOptions, GeomSegmentOptions } from "./builder.js";
export type { GeomCountOptions, GeomViolinOptions, GeomFunctionOptions } from "./builder.js";
export type { GeomPolygonOptions, GeomAblineOptions, GeomCurveOptions } from "./builder.js";
export type { GeomMapOptions, GeomBlankOptions, GeomSpokeOptions } from "./builder.js";
export type { GeomSfOptions, GeomSfTextOptions, GeomSfLabelOptions } from "./builder.js";
export type { GeomStepOptions, GeomQqOptions, GeomQqLineOptions } from "./builder.js";
export type { GeomSmoothOptions, GeomTextOptions, GeomLabelOptions } from "./builder.js";
export type { GeomTileOptions, GeomBin2dOptions, GeomVlineOptions } from "./builder.js";

// Within-mark paint helpers (#591)
export { fillPaintLinear, fillPaintRadial, glow, strokePaintLinear } from "./paint-helpers.js";
export { strokePaintRadial } from "./paint-helpers.js";
export type { ColorStopInput, GlowOptions, LinearPaintOptions } from "./paint-helpers.js";
export type { RadialPaintOptions } from "./paint-helpers.js";

// Schema artifact (schema/v0.json)
export { buildSchemaArtifact, SCHEMA_VERSION, schemaArtifactJSON } from "./artifact.js";

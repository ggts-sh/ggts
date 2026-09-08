// @lifecycle-default experimental
/**
 * Side-effect-free headless pipeline and pure renderers.
 *
 * Unlike `@ggts-sh/core/render`, this entry registers no geom, stat,
 * color-kind, style-kind, or band-guide families. Import the required
 * `registerBasic*` / `register*Color` / `registerNumericStyle` /
 * `registerFiniteStyle` / `registerBandGuide` functions from
 * `@ggts-sh/core/headless/register` before running a spec.
 */
export { batchMarkCount, CANVAS_AUTO_THRESHOLD, PipelineError } from "./pipeline/public-api.js";
export { runPipeline } from "./pipeline/run-pipeline.js";
// Scene-only runner for the lean SVG path (no RenderModel-only contracts);
// pairs with mountSceneSvg from "@ggts-sh/core/svg-live" for live updates.
export { runScene } from "./pipeline/run-scene.js";
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
  ScaleDomainSnapshot,
  TrainedScales,
} from "./pipeline/public-api.js";
export {
  countMarks,
  pathData,
  renderToSVGString,
  sceneLabel,
  sceneToSVGString,
} from "./render-svg.js";
export type { RenderSVGOptions } from "./render-svg.js";
export { planStrata } from "./strata.js";
export type { Stratum } from "./strata.js";
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

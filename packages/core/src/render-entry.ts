/**
 * Lean render entry (`@ggts-sh/core/render`).
 *
 * Pipeline + SVG string renderer with basic geom registration only.
 * Does not register heavy stats (smooth/loess, density_2d, sf, …) or specialty
 * geoms. Identity charts (scatter, line, bar, area) stay on this graph.
 *
 * Full grammar: import from `@ggts-sh/core` instead.
 *
 * Lifecycle (Hadley lesson 13; meanings in CONTRIBUTING.md): tags collected
 * into lifecycle.json by scripts/gen-lifecycle.ts.
 */
// @lifecycle-default experimental
// Side-effect contract of this subpath: importing `@ggts-sh/core/render`
// registers basic geom batches + basic stat frames (identity charts).
import { registerBasicStatFrames } from "./pipeline/frame-stats-register-basic.js";
import { registerBasicGeomBatches } from "./pipeline/geometry-register-basic.js";
import { registerAllColorKinds } from "./pipeline/register-color-all.js";
import { registerAllStyleKinds } from "./pipeline/register-style-all.js";
import { registerBandGuide } from "./layout/register-band-guide.js";

registerBasicStatFrames();
registerBasicGeomBatches();
registerAllColorKinds();
registerAllStyleKinds();
registerBandGuide();

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
  ScaleDomainSnapshot,
  TrainedScales,
} from "./pipeline/public-api.js";

export { countMarks, pathData, sceneLabel, sceneToSVGString } from "./render-svg.js";
export { renderToSVGString } from "./render-svg-full.js";
export type { RenderSVGOptions } from "./render-svg.js";

// Strata planning is pure (no DOM, no temporal install) — lean canvas charts
// compose it with @ggts-sh/core/dom drawStratum.
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

export { registerStatFrame } from "./pipeline/frame-stats-registry.js";
export { registerGeomBatch } from "./pipeline/geometry-registry.js";

/**
 * Public pipeline contract re-exports (import path stability for consumers
 * of @ggts-sh/core via ./pipeline.ts).
 */
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
} from "./types.js";
export { CANVAS_AUTO_THRESHOLD, PipelineError } from "./types.js";
export { batchMarkCount } from "./geometry.js";

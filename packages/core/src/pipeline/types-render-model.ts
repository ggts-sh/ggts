/**
 * Public RenderModel surface returned by runPipeline.
 */
import type { PanelCoordProjector } from "../coord-projector.js";
import type { GuidePlan } from "../layout/temporal-guide.js";
import type { Scene } from "../scene.js";
import type { CellValue } from "../table.js";
import type { CandidateStore } from "../candidate-store.js";
import type { LineageStore } from "../identity.js";
import type { SemanticViewport } from "../semantic-viewport.js";

import type { Advisory, PipelineWarning } from "./types-advisory.js";
import type { ScaleDecision, ScaleDiagnostic } from "./types-scale-diagnostics.js";
import type {
  AxisValueFormatter,
  LayerBackend,
  MappedField,
  ScaleDomainSnapshot,
  TrainedScales,
} from "./types-model-scales.js";

export interface RenderModel {
  scene: Scene;
  scales: TrainedScales;
  warnings: PipelineWarning[];
  advisories: Advisory[];
  /** Structured scale inference/parser diagnostics for tools and hosts. */
  scaleDiagnostics: ScaleDiagnostic[];
  /** Inspectable position-scale semantic decisions. */
  scaleDecisions: ScaleDecision[];
  /** Semantic axis plans for every actually drawn panel axis. */
  guidePlans: readonly GuidePlan[];
  /** Per-panel post-stat coordinate forward/inverse projectors. */
  coordProjectors: readonly PanelCoordProjector[];
  /** Model-owned plot-pixel ↔ semantic projection for interaction adapters. */
  viewport: SemanticViewport;
  /** Monotonic run identity (module-global, increases every runPipeline call). */
  runId: number;
  /**
   * Resolved rendering backend per layer: the layer's `render` hint, with
   * "auto" resolving to canvas above the mark-count threshold (advisory
   * `canvas-auto`), and `a11y: "force-svg"` forcing every layer to "svg".
   * renderToSVGString ignores this (always all-SVG).
   */
  layerBackends: LayerBackend[];
  /** Field-mapped channels per layer (drives default tooltip content). */
  layerFields: MappedField[][];
  /**
   * Resolved position adjustment per layer (`identity` / `stack` / `fill` /
   * `dodge` / …). Axis-inspect tooltips use this to show a stack Total only
   * when the group includes an additive (`stack` or `fill`) layer.
   */
  layerPositions: readonly string[];
  /**
   * Scaled constant aes values per layer (`{ value, scale: true }` on color/fill).
   * Used by legend-focus key indexing when no field mapping exists for a scale.
   */
  layerScaledConstants: ReadonlyArray<Readonly<Partial<Record<string, CellValue>>>>;
  /** Stable baseline plus the domains actually used for this render. */
  domains: Readonly<{ baseline: ScaleDomainSnapshot; effective: ScaleDomainSnapshot }>;
  /** Interned source-row memberships. Public adapters resolve these through keys.
   *  Populated when the candidate store assembles (first candidate read /
   *  hit-test); reading it before that yields an empty store — unchanged from
   *  the pre-#1421 eager build, which assembled lazily too. */
  lineage: LineageStore<number>;
  /** Shared epoch-scoped interaction candidate storage. Built lazily on first
   *  access (#1421): headless renders never pay for it, and the lean
   *  `@ggts-sh/core/render` entry throws here (full entry required). */
  candidates: CandidateStore;
  /** Trained semantic formatters. Coord transforms never swap x and y here. */
  axisFormatters: Readonly<{ x: AxisValueFormatter; y: AxisValueFormatter }>;
  /** The source data row behind a hit-index rowIndex (null for synthesized
   *  stat rows). Reads the bound table — do not call after dispose(). */
  row(index: number): Record<string, CellValue> | null;
  /**
   * Release this model's geometry and caches (plan: memory ownership). The
   * Svelte adapter disposes the previous model on commit and the current one
   * on unmount. After dispose() the scene's batches are empty and row()
   * returns null; rendering a disposed model is a caller bug.
   */
  dispose(): void;
}

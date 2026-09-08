/**
 * Finalize phase: layout → geometry → scene → contracts → candidates →
 * RenderModel. One module, one name for the run state (#1075).
 *
 * Real work stays in finalize-layout-pass and finalize-geometry-scene;
 * contract resolution, candidate construction, and model assembly are
 * statements here rather than hop-only modules.
 */
import type { PortableSpec } from "@ggts-sh/spec";

import { getCandidateRuntime, RELEASED_CANDIDATE_STORE } from "../candidate-runtime.js";
import type { CandidateBuildInput, LazyInteraction } from "../candidate-runtime.js";
import type { CandidateStore } from "../candidate-store.js";
import { buildPanelCoordProjector, scalesForCoordExpand } from "../coord-projector.js";
import type { PanelCoordProjector } from "../coord-projector.js";
import { LineageStore } from "../identity.js";
import type { Scene } from "../scene.js";
import type { ThemeTokens } from "../theme.js";

import { assembleRenderModel } from "./assemble-render-model.js";
import { computeBaselineDomains, computeEffectiveDomains } from "./compute-domains.js";
import { dedupeScaleDiagnostics } from "./diagnostics-emit.js";
import { finalizeGeometryAndScene } from "./finalize-geometry-scene.js";
import { finalizePanelLayoutPass } from "./finalize-layout-pass.js";
import type { PanelLayoutResult } from "./panel-layout.js";
import { resolveLayerBackends } from "./layer-backends.js";
import { resolveLayerFields, resolveLayerScaledConstants } from "./layer-fields.js";
import type { PreparedPanels } from "./prepare-panels.js";
import type { TrainedPipelineScales } from "./train-pipeline-scales.js";
import type { Advisory, PipelineWarning, RenderModel, RunOptions } from "./types.js";

/** The finalize phase's view of the run, declared once. */
export interface PipelineRunState {
  readonly runId: number;
  readonly normalized: PortableSpec;
  readonly options: RunOptions;
  readonly theme: ThemeTokens;
  readonly flip: boolean;
  readonly prepared: PreparedPanels;
  readonly trained: TrainedPipelineScales;
  readonly warnings: PipelineWarning[];
  readonly advisories: Advisory[];
}

export interface FinalizedScene {
  readonly scene: Scene;
  readonly panelLayout: PanelLayoutResult;
  readonly coordProjectors: readonly PanelCoordProjector[];
}

/** Layout → geometry → scene, without RenderModel-only contracts. */
export function finalizeScene(run: PipelineRunState): FinalizedScene {
  const { normalized, options, theme, flip, prepared, trained, warnings } = run;
  const panelLayout = finalizePanelLayoutPass({
    normalized,
    options,
    theme,
    flip,
    prepared,
    trained,
    warnings,
  });
  const coord =
    normalized.coord?.type === "transform" || normalized.coord?.type === "radial"
      ? normalized.coord
      : undefined;
  const coordProjectors = trained.panelScales.map((scales) =>
    buildPanelCoordProjector(scales, coord),
  );
  const scene = finalizeGeometryAndScene({
    normalized,
    options,
    theme,
    flip,
    prepared,
    trained,
    panelLayout,
    coordProjectors,
    warnings,
  });
  return { scene, panelLayout, coordProjectors };
}

/**
 * Layout → geometry → scene → render model. Owns the two-pass layout call,
 * contract resolution, candidate construction and model assembly.
 */
export function finalize(run: PipelineRunState): RenderModel {
  const { runId, normalized, options, flip, prepared, trained, warnings, advisories } = run;
  const { scene, panelLayout, coordProjectors } = finalizeScene(run);

  // --- layer contracts ---
  const { bindings } = prepared;
  const layerBackends = resolveLayerBackends(
    normalized.layers,
    scene.batches,
    normalized.a11y,
    options.canvasThreshold,
    advisories,
  );
  const layerFields = resolveLayerFields(normalized.layers.length, bindings);
  // Normalize always fills position; keep a string[] aligned with layer index
  // so axis-inspect can tell additive (stack/fill) groups from parallel series.
  const layerPositions = Object.freeze(
    normalized.layers.map((layer) => layer.position ?? "identity"),
  );
  const layerScaledConstants = resolveLayerScaledConstants(normalized.layers.length, bindings);

  // --- domain snapshots ---
  const { freeX, freeY, facetPanels, panelFrames } = prepared;
  const { xTraining, yTraining, panelScales, xInputs, yInputs } = trained;
  // Radial expand:false / limits remaps geometry via scalesForCoordExpand —
  // use the same remapped scales for reported domains so brush baselines and
  // domain snapshots match the drawn sectors.
  const panelScalesForDomains = panelScales.map((scales, i) => {
    const projector = coordProjectors[i];
    if (projector === undefined || !projector.joint) return scales;
    return scalesForCoordExpand(scales, projector.expand, {
      ...(projector.polarTheta !== undefined && { theta: projector.polarTheta }),
      ...(projector.thetaLimits !== undefined && { thetaLimits: projector.thetaLimits }),
      ...(projector.rLimits !== undefined && { rLimits: projector.rLimits }),
    });
  });
  const effectiveDomains = computeEffectiveDomains(
    xTraining.scale,
    yTraining.scale,
    panelScalesForDomains,
  );
  const baselineDomains = computeBaselineDomains({
    options,
    freeX,
    freeY,
    facetPanels,
    panelFrames,
    xInputs,
    yInputs,
    effectiveDomains,
  });

  // --- lineage + interaction candidates (lazy, #1421) ---
  // The candidate store builds on first `model.candidates` access so
  // headless/SSR renders never pay for it, and the lean render entry
  // never carries the candidate-store graph (no runtime installed there).
  // `lineageStore` is created eagerly and populated by the store's assembly
  // (first candidate read) — the same deferred shape as the pre-#1421 eager
  // build, so `model.lineage` needs no ensure of its own.
  const lineageStore = new LineageStore<number>();
  let builtCandidates: CandidateStore | null = null;
  // Retained build inputs live in a null-able box: a successful build hands
  // its own references to the store (which dispose() clears), and model
  // dispose drops the box either way — a released model must not keep the
  // source table / prepared panels alive through this closure.
  let retained: CandidateBuildInput | null = {
    scene,
    runId,
    flip,
    bindings,
    panelFrames: prepared.panelFrames,
    facetPanels: prepared.facetPanels,
    // Candidate sourceRow indexes and lineage rows are source-table based
    // (runtime filters preserve identity), so value lookups must be too.
    table: prepared.sourceTable,
    sources: prepared.sourceRegistry,
    layerFields,
    color: trained.colorResolution.resolved,
    fill: trained.fillResolution.resolved,
    lineage: lineageStore,
  };
  const interaction: LazyInteraction = {
    lineageStore,
    ensure(): CandidateStore {
      if (builtCandidates !== null) return builtCandidates;
      const input = retained;
      if (input === null) {
        // Disposed before any interaction: quiet-null inert store, matching
        // the pre-#1421 built-then-disposed contract for late hit-tests.
        builtCandidates = RELEASED_CANDIDATE_STORE;
        return builtCandidates;
      }
      const runtime = getCandidateRuntime();
      if (runtime === null) {
        throw new Error(
          "Interaction candidates require @ggts-sh/core (full entry); the lean @ggts-sh/core/render graph does not carry the candidate store.",
        );
      }
      builtCandidates = runtime.build(input);
      retained = null;
      return builtCandidates;
    },
    built(): CandidateStore | null {
      return builtCandidates;
    },
    release(): void {
      retained = null;
    },
  };

  // --- pack trained scales + contracts into the render model ---
  const { colorResolution, fillResolution, styleResolutions } = trained;
  return assembleRenderModel({
    scene,
    xScale: xTraining.scale,
    yScale: yTraining.scale,
    color: colorResolution.resolved,
    fill: fillResolution.resolved,
    styles: Object.fromEntries(
      Object.entries(styleResolutions).map(([aesthetic, resolution]) => [
        aesthetic,
        resolution.resolved,
      ]),
    ),
    panelScales: panelScalesForDomains,
    colorState: colorResolution.state,
    fillState: fillResolution.state,
    styleStates: Object.fromEntries(
      Object.entries(styleResolutions).map(([aesthetic, resolution]) => [
        aesthetic,
        resolution.state,
      ]),
    ),
    warnings,
    advisories,
    scaleDecisions: prepared.scaleDecisions,
    // Prepare-time (transform/temporal, one-per-field) + train-time dual-channel
    // (#628). Only training diagnostics need once-per-axis dedupe (free panels
    // can re-emit the same break/baseline event); prepare entries stay distinct.
    scaleDiagnostics: [
      ...prepared.scaleDiagnostics,
      ...dedupeScaleDiagnostics(trained.scaleDiagnostics),
    ],
    guidePlans: Object.freeze([
      ...panelLayout.guidePlans,
      ...(colorResolution.guidePlan === null ? [] : [colorResolution.guidePlan]),
      ...(fillResolution.guidePlan === null ? [] : [fillResolution.guidePlan]),
      ...Object.values(styleResolutions).flatMap((resolution) =>
        resolution.guidePlan === null ? [] : [resolution.guidePlan],
      ),
    ]),
    coordProjectors,
    flipped: flip,
    xConversion: prepared.xConversion,
    yConversion: prepared.yConversion,
    runId,
    layerBackends,
    layerFields,
    layerPositions,
    layerScaledConstants,
    baselineDomains,
    effectiveDomains,
    interaction,
    formatX: panelLayout.formatX,
    formatY: panelLayout.formatY,
    // Retain the unfiltered source table + multi-table registry: model.row()
    // resolves global source-row indices (#589).
    table: prepared.sourceTable,
    sourceRegistry: prepared.sourceRegistry,
  });
}

/**
 * Finalize phase: geometry batches and scene assembly after layout.
 */
import type { PortableSpec } from "@ggts-sh/spec";

import type { PanelCoordProjector } from "../coord-projector.js";
import { perfMark, perfMeasure } from "../perf.js";
import type { Scene } from "../scene.js";
import type { ThemeTokens } from "../theme.js";

import { buildGeometryBatches } from "./assemble-geometry-batches.js";
import { assembleScene } from "./assemble-scene-build.js";
import type { PanelLayoutResult } from "./panel-layout.js";
import type { PreparedPanels } from "./prepare-panels.js";
import type { TrainedPipelineScales } from "./train-pipeline-scales.js";
import type { PipelineWarning, RunOptions } from "./types.js";

function resolvedStyleScales(
  styleResolutions: TrainedPipelineScales["styleResolutions"],
): import("./geometry-style.js").ResolvedStyleScales {
  return Object.fromEntries(
    Object.entries(styleResolutions).map(([aesthetic, resolution]) => [
      aesthetic,
      resolution.resolved,
    ]),
  ) as import("./geometry-style.js").ResolvedStyleScales;
}

function minorBreakOptions(
  normalized: PortableSpec,
  flip: boolean,
): {
  hMinorBreaks?: readonly number[];
  vMinorBreaks?: readonly number[];
} {
  const h = flip ? normalized.scales?.y?.minorBreaks : normalized.scales?.x?.minorBreaks;
  const v = flip ? normalized.scales?.x?.minorBreaks : normalized.scales?.y?.minorBreaks;
  return {
    ...(h !== undefined && { hMinorBreaks: h }),
    ...(v !== undefined && { vMinorBreaks: v }),
  };
}

export function finalizeGeometryAndScene(input: {
  normalized: PortableSpec;
  options: RunOptions;
  theme: ThemeTokens;
  flip: boolean;
  prepared: PreparedPanels;
  trained: TrainedPipelineScales;
  panelLayout: PanelLayoutResult;
  coordProjectors: readonly PanelCoordProjector[];
  warnings: PipelineWarning[];
}): Scene {
  const {
    normalized,
    options,
    theme,
    flip,
    prepared,
    trained,
    panelLayout,
    coordProjectors,
    warnings,
  } = input;
  const { facetPanels, panelFrames } = prepared;
  const { panelScales, colorResolution, fillResolution, styleResolutions } = trained;

  // LAYER-major order: layer order is paint order across the whole plot, and
  // it keeps each layer's batches contiguous so strata planning (contiguous
  // same-backend batches share a stratum) never fragments on facet panels.
  perfMark("ggts:geometry:start");
  const batches = buildGeometryBatches({
    layerCount: normalized.layers.length,
    facetPanels,
    panelFrames,
    placements: panelLayout.placements,
    panelScales,
    color: colorResolution.resolved,
    fill: fillResolution.resolved,
    styles: resolvedStyleScales(styleResolutions),
    flip,
    coordProjectors,
    warnings,
  });
  perfMark("ggts:geometry:end");
  perfMeasure("ggts:geometry", "ggts:geometry:start", "ggts:geometry:end");

  // Guides were resolved once in finalizePanelLayoutPass / layoutPanels and
  // carried on panelLayout — do not call resolveAxisGuide again (#1076).
  return assembleScene({
    width: options.width,
    height: options.height,
    placements: panelLayout.placements,
    facetPanels,
    strip: panelLayout.strip,
    stripBand: panelLayout.stripBand,
    displayScales: panelLayout.displayScales,
    hTitle: panelLayout.hTitle,
    vTitle: panelLayout.vTitle,
    hGuide: panelLayout.guides.h,
    vGuide: panelLayout.guides.v,
    coordProjectors,
    ...(options.measureText !== undefined && { measureText: options.measureText }),
    axisTextSize: theme.axisTextSize,
    ...minorBreakOptions(normalized, flip),
    batches,
    legendBlock: panelLayout.legendBlock,
    topBand: panelLayout.topBand,
    bottomBand: panelLayout.bottomBand,
    degraded: panelLayout.degraded,
    theme,
    title: panelLayout.title,
    subtitle: panelLayout.subtitle,
    caption: panelLayout.caption,
  });
}

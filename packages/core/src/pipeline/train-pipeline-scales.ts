/**
 * Train fixed/free positional scales and global color/fill scales for a run.
 */
import type { GuideSpec, PortableSpec, StyleAesthetic } from "@ggts-sh/spec";

import type { EditionDefaults } from "../editions.js";
import type { PositionScale } from "../scales/train.js";
import type { ColumnTable } from "../table.js";

import type { FacetPanelDef } from "./facets.js";
import { collectAxisInputs } from "./scale-axis-collect.js";
import { trainAxis } from "./scale-axis-train.js";
import { resolveColorScale } from "./scale-color.js";
import type { StyleResolution } from "./scale-style-types.js";
import type { PositionConversionContext } from "./temporal-position.js";
import { trainPipelineColorScales } from "./train-pipeline-scales-color.js";
import { trainPipelinePositionScales } from "./train-pipeline-scales-position.js";
import { trainPipelineStyleScales } from "./train-pipeline-scales-style.js";
import type {
  Advisory,
  LayerBinding,
  LayerFrame,
  PipelineWarning,
  RunOptions,
  ScaleDiagnostic,
} from "./types.js";

export interface TrainedPipelineScales {
  xTraining: ReturnType<typeof trainAxis>;
  yTraining: ReturnType<typeof trainAxis>;
  panelScales: { x: PositionScale; y: PositionScale }[];
  colorResolution: ReturnType<typeof resolveColorScale>;
  fillResolution: ReturnType<typeof resolveColorScale>;
  styleResolutions: Record<StyleAesthetic, StyleResolution>;
  xInputs: ReturnType<typeof collectAxisInputs>;
  yInputs: ReturnType<typeof collectAxisInputs>;
  scalesConfig: NonNullable<PortableSpec["scales"]>;
  allFrames: LayerFrame[];
  /** Rich diagnostics from positional scale training (#628). */
  scaleDiagnostics: ScaleDiagnostic[];
}

export interface TrainPipelineScalesInput {
  normalized: PortableSpec;
  options: RunOptions;
  table: ColumnTable;
  /** Unfiltered bound table; color/fill scales train on its value catalog. */
  sourceTable: ColumnTable;
  bindings: readonly LayerBinding[];
  facetPanels: readonly FacetPanelDef[];
  panelFrames: readonly (readonly LayerFrame[])[];
  freeX: boolean;
  freeY: boolean;
  xConversion: PositionConversionContext;
  yConversion: PositionConversionContext;
  editionDefaults: EditionDefaults;
  warnings: PipelineWarning[];
  advisories: Advisory[];
}

function withResolvedParser(
  config: NonNullable<PortableSpec["scales"]>["x"],
  conversion: PositionConversionContext,
): NonNullable<PortableSpec["scales"]>["x"] {
  if (
    config === undefined ||
    config.parse !== undefined ||
    conversion.parser === "auto" ||
    config.type === "band" ||
    config.type === "linear" ||
    config.type === "log"
  ) {
    return config;
  }
  return { ...config, parse: conversion.parser };
}

function applyGuideOverrides(
  scalesConfig: NonNullable<PortableSpec["scales"]>,
  guides: PortableSpec["guides"],
): void {
  for (const aesthetic of [
    "x",
    "y",
    "color",
    "fill",
    "size",
    "linewidth",
    "alpha",
    "shape",
    "linetype",
  ] as const) {
    const top = guides?.[aesthetic];
    if (top === undefined) continue;
    const scale = (scalesConfig[aesthetic] ?? {}) as { guide?: unknown };
    const local = scale.guide;
    if (aesthetic === "x" || aesthetic === "y") {
      const localBandGuide =
        typeof local === "object" && local !== null && !("type" in local)
          ? (local as { mode?: string })
          : undefined;
      const topOverridesBandLayout =
        top.type === "axis" &&
        (top.collision !== undefined ||
          (localBandGuide?.mode === "off" && top.showLabels === true));
      if (topOverridesBandLayout) {
        const { guide: _guide, ...withoutBandGuide } = scale;
        Object.assign(scalesConfig, { [aesthetic]: withoutBandGuide });
      }
      continue;
    }
    const localGuide = local as GuideSpec | undefined;
    const guide: GuideSpec =
      localGuide !== undefined && localGuide.type === top.type && top.type !== "none"
        ? ({
            ...localGuide,
            ...top,
            theme: {
              ...(localGuide.type === "none" ? undefined : localGuide.theme),
              ...top.theme,
            },
          } as GuideSpec)
        : top;
    Object.assign(scalesConfig, { [aesthetic]: { ...scale, guide } });
  }
}

function resolveTrainingScalesConfig(input: {
  normalized: PortableSpec;
  xConversion: PositionConversionContext;
  yConversion: PositionConversionContext;
}): NonNullable<PortableSpec["scales"]> {
  const sourceScalesConfig = input.normalized.scales ?? {};
  const scalesConfig: NonNullable<typeof sourceScalesConfig> = { ...sourceScalesConfig };
  const resolvedX = withResolvedParser(sourceScalesConfig.x, input.xConversion);
  const resolvedY = withResolvedParser(sourceScalesConfig.y, input.yConversion);
  if (resolvedX !== undefined) scalesConfig.x = resolvedX;
  if (resolvedY !== undefined) scalesConfig.y = resolvedY;
  applyGuideOverrides(scalesConfig, input.normalized.guides);
  return scalesConfig;
}

export function trainPipelineScales(input: TrainPipelineScalesInput): TrainedPipelineScales {
  const {
    normalized,
    options,
    table,
    sourceTable,
    bindings,
    facetPanels,
    panelFrames,
    freeX,
    freeY,
    xConversion,
    yConversion,
    editionDefaults,
    warnings,
    advisories,
  } = input;

  const scalesConfig = resolveTrainingScalesConfig({ normalized, xConversion, yConversion });
  const position = trainPipelinePositionScales({
    scalesConfig,
    facetPanels,
    panelFrames,
    freeX,
    freeY,
    warnings,
    advisories,
  });
  const color = trainPipelineColorScales({
    scalesConfig,
    labs: normalized.labs ?? {},
    allFrames: position.allFrames,
    bindings,
    table,
    sourceTable,
    options,
    editionDefaults,
    warnings,
    advisories,
  });
  const styles = trainPipelineStyleScales({
    scalesConfig,
    labs: normalized.labs ?? {},
    allFrames: position.allFrames,
    bindings,
    table,
    sourceTable,
    options,
    warnings,
    advisories,
  });

  return {
    ...position,
    ...color,
    ...styles,
    scalesConfig,
  };
}

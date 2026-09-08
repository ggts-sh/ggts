/**
 * Finalize phase: two-pass panel layout only.
 */
import type { CellValue, CoordRadialSpec, PortableSpec, TemporalScaleKind } from "@ggts-sh/spec";
import { getTemporalRuntime } from "../temporal-runtime.js";

import { buildPolarProjector } from "../coord-polar.js";
import { scalesForCoordExpand } from "../coord-projector.js";
import { perfMark, perfMeasure } from "../perf.js";
import type { ThemeTokens } from "../theme.js";

import { TemporalGuideIntervalError } from "../layout/temporal-guide.js";
import { prepareLegendInputs, resolveAxisGuide } from "./guide-config.js";
import { layoutPanels } from "./panel-layout.js";
import type { PanelLayoutResult } from "./panel-layout.js";
import type { PreparedPanels } from "./prepare-panels.js";
import type { TrainedPipelineScales } from "./train-pipeline-scales.js";
import { PipelineError, type PipelineWarning, type RunOptions } from "./types.js";

/** ggplot2 polar panel aspect: diff(bbox.y) / diff(bbox.x). Full circle → 1. */
function radialPanelAspect(coord: CoordRadialSpec): number {
  const polar = buildPolarProjector({
    ...(coord.theta !== undefined && { theta: coord.theta }),
    ...(coord.start !== undefined && { start: coord.start }),
    ...(coord.end !== undefined && { end: coord.end }),
    ...(coord.innerRadius !== undefined && { innerRadius: coord.innerRadius }),
    ...(coord.reverse !== undefined && { reverse: coord.reverse }),
  });
  const [x0, x1] = polar.bbox.x;
  const [y0, y1] = polar.bbox.y;
  const bx = x1 - x0;
  const by = y1 - y0;
  if (!(bx > 0) || !(by > 0) || !Number.isFinite(bx) || !Number.isFinite(by)) return 1;
  return by / bx;
}

function temporalDecisionKind(
  values: readonly CellValue[] | undefined,
  conversion: PreparedPanels["xConversion"],
): TemporalScaleKind | null {
  if (!conversion.requestedTime || values === undefined || values.length === 0) return null;
  const runtime = getTemporalRuntime();
  if (runtime === null) return null;
  const decision = runtime.parseColumn(values, conversion.parser, conversion.options).decision;
  return decision.kind ?? null;
}

function scalarInterceptValues(normalized: PortableSpec, axis: "x" | "y"): CellValue[] {
  const values: CellValue[] = [];
  for (const layer of normalized.layers) {
    const params = layer.params as
      | { xintercept?: CellValue | CellValue[]; yintercept?: CellValue | CellValue[] }
      | undefined;
    const value = axis === "x" ? params?.xintercept : params?.yintercept;
    if (value !== undefined) values.push(...(Array.isArray(value) ? value : [value]));
  }
  return values;
}

function resolveTemporalKind(
  normalized: PortableSpec,
  prepared: PreparedPanels,
  xTraining: TrainedPipelineScales["xTraining"],
  yTraining: TrainedPipelineScales["yTraining"],
  axis: "x" | "y",
): TemporalScaleKind | null {
  const conversion = axis === "x" ? prepared.xConversion : prepared.yConversion;
  if (conversion.requestedKind !== undefined) return conversion.requestedKind;
  const kinds = prepared.scaleDecisions
    .filter((decision) => decision.aesthetic === axis && decision.status === "temporal")
    .map((decision) => decision.kind)
    .filter((kind): kind is "date" | "datetime" | "time" => kind !== null);
  if (kinds.length > 0) return kinds.includes("datetime") ? "datetime" : kinds[0]!;
  const scalarKind = temporalDecisionKind(scalarInterceptValues(normalized, axis), conversion);
  if (scalarKind !== null) return scalarKind;
  const config = normalized.scales?.[axis];
  for (const values of [config?.domain, config?.breaks]) {
    const configuredKind = temporalDecisionKind(values, conversion);
    if (configuredKind !== null) return configuredKind;
  }
  const scale = axis === "x" ? xTraining.scale : yTraining.scale;
  return scale.type === "time" && conversion.requestedTime ? "datetime" : null;
}

function guideLabels(
  normalized: PortableSpec,
  xGuide: ReturnType<typeof resolveAxisGuide>,
  yGuide: ReturnType<typeof resolveAxisGuide>,
): NonNullable<PortableSpec["labs"]> {
  const labs = { ...normalized.labs };
  if (xGuide.visible) {
    if (xGuide.title !== undefined) labs.x = xGuide.title;
  } else labs.x = "";
  if (yGuide.visible) {
    if (yGuide.title !== undefined) labs.y = yGuide.title;
  } else labs.y = "";
  return labs;
}

function scalesForLayout(
  normalized: PortableSpec,
  panelScales: TrainedPipelineScales["panelScales"],
): TrainedPipelineScales["panelScales"] {
  const radialCoord = normalized.coord?.type === "radial" ? normalized.coord : undefined;
  if (radialCoord === undefined) return panelScales;
  return panelScales.map((scales) =>
    scalesForCoordExpand(scales, radialCoord.expand !== false, {
      theta: radialCoord.theta === "y" ? "y" : "x",
      ...(radialCoord.thetaLimits !== undefined &&
        radialCoord.thetaLimits.length === 2 && {
          thetaLimits: [radialCoord.thetaLimits[0]!, radialCoord.thetaLimits[1]!] as const,
        }),
      ...(radialCoord.rLimits !== undefined &&
        radialCoord.rLimits.length === 2 && {
          rLimits: [radialCoord.rLimits[0]!, radialCoord.rLimits[1]!] as const,
        }),
    }),
  );
}

function legendInputsForLayout(
  trained: TrainedPipelineScales,
  prepared: PreparedPanels,
  normalized: PortableSpec,
) {
  return prepareLegendInputs({
    items: [
      { input: trained.colorResolution.legendInput, plan: trained.colorResolution.guidePlan },
      { input: trained.fillResolution.legendInput, plan: trained.fillResolution.guidePlan },
      ...Object.values(trained.styleResolutions).map((resolution) => ({
        input: resolution.legendInput,
        plan: resolution.guidePlan,
      })),
    ],
    bindings: prepared.bindings,
    scales: trained.scalesConfig,
    guides: normalized.guides,
  });
}

function runLayoutPanels(input: Parameters<typeof layoutPanels>[0]): PanelLayoutResult {
  try {
    return layoutPanels(input);
  } catch (error) {
    if (!(error instanceof TemporalGuideIntervalError)) throw error;
    const intervalError = error.cause;
    const path = `/scales/${error.aesthetic}/${error.option}`;
    const code = intervalError.message.includes("progression")
      ? "temporal-break-progression"
      : "temporal-break-limit";
    throw new PipelineError(code, path, intervalError.message, {
      code,
      severity: "error",
      path,
      problem:
        code === "temporal-break-limit"
          ? "The requested temporal interval produces too many ticks."
          : "The requested temporal interval did not advance monotonically.",
      cause: intervalError.message,
      fixes: [{ description: "Choose a coarser calendar interval." }],
      documentationUrl: "/guide/temporal-scales#explicit-intervals",
    });
  }
}

export function finalizePanelLayoutPass(input: {
  normalized: PortableSpec;
  options: RunOptions;
  theme: ThemeTokens;
  flip: boolean;
  prepared: PreparedPanels;
  trained: TrainedPipelineScales;
  warnings: PipelineWarning[];
}): PanelLayoutResult {
  const { normalized, options, theme, flip, prepared, trained, warnings } = input;
  const { faceted, freeX, freeY, nrow, ncol, facetPanels, strip } = prepared;
  const { xTraining, yTraining, panelScales, scalesConfig, allFrames } = trained;

  const temporalKind = (axis: "x" | "y") =>
    resolveTemporalKind(normalized, prepared, xTraining, yTraining, axis);

  /** Shared column precision for axisFormatters defaults; mixed precisions → null. */
  const temporalPrecision = (axis: "x" | "y") => {
    const precisions = prepared.scaleDecisions
      .filter((decision) => decision.aesthetic === axis && decision.status === "temporal")
      .map((decision) => decision.precision)
      .filter((value): value is NonNullable<typeof value> => value !== null);
    if (precisions.length === 0) return null;
    const first = precisions[0]!;
    return precisions.every((value) => value === first) ? first : null;
  };

  const xGuide = resolveAxisGuide("x", scalesConfig, normalized.guides, theme);
  const yGuide = resolveAxisGuide("y", scalesConfig, normalized.guides, theme);
  const labs = guideLabels(normalized, xGuide, yGuide);
  const legendInputs = legendInputsForLayout(trained, prepared, normalized);

  // Radial expand:false / theta·r limits remaps geometry via scalesForCoordExpand
  // (assemble-geometry-batches). Layout ticks and displayScales must use the same
  // remapped domains so cartesian chrome describes the arc that sectors fill
  // (#1514). Polar-aware guide_axis_theta remains deferred v1 work.
  const panelScalesForLayout = scalesForLayout(normalized, panelScales);

  perfMark("ggts:layout:start");
  const panelLayout = runLayoutPanels({
    flip,
    faceted,
    freedom: { freeX, freeY },
    ...((normalized.coord?.type === "fixed" || normalized.coord?.type === "sf") && {
      coordFixed: normalized.coord,
    }),
    // Polar panel aspect = polar_bbox height/width (1 for a full circle).
    ...(normalized.coord?.type === "radial" && {
      coordFixed: {
        type: "radial" as const,
        aspect: radialPanelAspect(normalized.coord),
      },
    }),
    nrow,
    ncol,
    facetPanels,
    strip,
    panelScales: panelScalesForLayout,
    allFrames,
    hGuide: flip ? yGuide : xGuide,
    vGuide: flip ? xGuide : yGuide,
    labs,
    scalesConfig,
    xScale: xTraining.scale,
    yScale: yTraining.scale,
    xTemporalKind: temporalKind("x"),
    yTemporalKind: temporalKind("y"),
    xTemporalPrecision: temporalPrecision("x"),
    yTemporalPrecision: temporalPrecision("y"),
    legendInputs,
    legendOrder: normalized.legend?.order ?? "stable-domain",
    theme,
    layoutAxisTitleSize: Math.max(
      theme.axisTitleSize,
      xGuide.theme?.titleSize ?? 0,
      yGuide.theme?.titleSize ?? 0,
    ),
    layoutAxisTextSize: Math.max(
      theme.axisTextSize,
      xGuide.theme?.labelSize ?? 0,
      yGuide.theme?.labelSize ?? 0,
    ),
    options,
    warnings,
  });
  perfMark("ggts:layout:end");
  perfMeasure("ggts:layout", "ggts:layout:start", "ggts:layout:end");
  return panelLayout;
}

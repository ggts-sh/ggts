/**
 * Point mark geometry batch builder.
 */
import type { PointsBatch } from "../scene.js";
import { pointShapeIndex, type PointShape } from "../scales/style.js";

import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";

import type { Frame } from "./geometry-shared.js";
import {
  indexedStyleVector,
  constantStyle,
  mappedPaintIndexVector,
  mappedPaintVector,
  numericStyleVector,
  type ResolvedStyleScales,
} from "./geometry-style.js";
import { DEFAULT_POINT_SIZE, droppedFrameRows, removedWarning } from "./geometry-shared.js";
import {
  collectPointPositions,
  packContinuousPointsOnePass,
  packPointPixels,
} from "./geometry-points-collect.js";

type PointParams = {
  size?: number;
  alpha?: number;
  shape?: PointShape;
  binwidth?: number;
  dotsize?: number;
};

function pointParams(binding: LayerFrame["binding"]): PointParams {
  switch (binding.layer.geom) {
    case "point":
    case "count":
    case "qq":
    case "dotplot":
    case "sf":
      return binding.layer.params ?? {};
    default:
      return {};
  }
}

function pointParamShape(geom: string, params: PointParams): PointShape | undefined {
  return geom === "point" || geom === "count" || geom === "qq" || geom === "dotplot"
    ? params.shape
    : undefined;
}

/** Diameter ≈ binwidth in x data units × dotsize, converted to px radius. */
function dotplotRadiusPx(
  frame: LayerFrame,
  fx: Frame,
  params: { binwidth?: number; dotsize?: number },
): number {
  let binwidth = params.binwidth;
  if (
    (binwidth === undefined || !(binwidth > 0)) &&
    frame.xmin !== null &&
    frame.xmax !== null &&
    frame.n > 0
  ) {
    const w = frame.xmax[0]! - frame.xmin[0]!;
    if (w > 0) binwidth = w;
  }
  if (binwidth === undefined || !(binwidth > 0) || fx.xScale.type === "band") {
    return DEFAULT_POINT_SIZE;
  }
  const domain = fx.xScale.transformedDomain;
  const span = domain[1] - domain[0];
  if (!(span > 0) || !(fx.innerWidth > 0)) return DEFAULT_POINT_SIZE;
  const dotsize = params.dotsize ?? 1;
  const diameterPx = (binwidth / span) * fx.innerWidth * dotsize;
  return Math.max(0.5, diameterPx / 2);
}

function pointMarkSize(
  frame: LayerFrame,
  fx: Frame,
  params: PointParams,
  literalSize: unknown,
): number {
  if (typeof literalSize === "number") return literalSize;
  if (typeof params.size === "number") return params.size;
  return frame.binding.layer.geom === "dotplot"
    ? dotplotRadiusPx(frame, fx, params)
    : DEFAULT_POINT_SIZE;
}

function attachMappedPointStyles(
  batch: PointsBatch,
  frame: LayerFrame,
  styles: ResolvedStyleScales,
  keptRows: Uint32Array,
): void {
  const sizes = numericStyleVector(frame, "size", keptRows, styles);
  const alphas = numericStyleVector(frame, "alpha", keptRows, styles);
  const shapeIndexes = indexedStyleVector(frame, "shape", keptRows, styles, (value) =>
    pointShapeIndex(value as PointShape),
  );
  if (sizes !== undefined) batch.sizes = sizes;
  if (alphas !== undefined) {
    batch.alpha = 1;
    batch.alphas = alphas;
  }
  if (shapeIndexes !== undefined) batch.shapeIndexes = shapeIndexes;
}

function attachMappedPointPaint(
  batch: PointsBatch,
  frame: LayerFrame,
  paintKey: "color" | "fill",
  paintScale: ResolvedColorScale | null,
  paintValues: LayerFrame["colorValues"],
  paintChannel: LayerFrame["binding"]["color"],
  keptRows: Uint32Array,
): void {
  if (paintScale === null || (paintValues === null && paintChannel.scaledConstant === null)) return;
  const indexed = mappedPaintIndexVector(frame, paintKey, paintScale, keptRows);
  if (indexed === null) {
    batch.colors = mappedPaintVector(frame, paintKey, paintScale, keptRows);
  } else if (indexed.palette.length === 1) {
    batch.fill = indexed.palette[0]!;
  } else {
    batch.colorPalette = indexed.palette;
    batch.colorIndexes = indexed.indexes;
  }
}

export function pointsBatch(
  frame: LayerFrame,
  fx: Frame,
  color: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
  /** Fill scale — used as paint for geom_dotplot (ggplot2 fill grouping; #900). */
  fill: ResolvedColorScale | null = null,
): PointsBatch | null {
  const { binding, n } = frame;
  let packed = packContinuousPointsOnePass(frame, fx);
  if (packed === null) {
    const collected = collectPointPositions(frame, fx);
    packed = {
      ...packPointPixels(collected, frame, fx),
      keptRows: collected.keptRows,
      kept: collected.kept,
    };
  }
  removedWarning(n - packed.kept, binding.index, warnings);
  if (packed.kept === 0) return null;

  const kept = packed.kept;
  const positions =
    kept === packed.positions.length / 2 ? packed.positions : packed.positions.slice(0, kept * 2);
  const rowIndex =
    kept === packed.rowIndex.length ? packed.rowIndex : packed.rowIndex.slice(0, kept);
  const collectedKeptRows =
    kept === packed.keptRows.length ? packed.keptRows : packed.keptRows.subarray(0, kept);
  // point / count / qq / dotplot / geom_sf point family share this builder.
  // SfParams has size/alpha (not shape); DotplotParams adds binwidth/dotsize.
  const geom = binding.layer.geom;
  const params = pointParams(binding);
  const paramShape = pointParamShape(geom, params);
  const literalSize = binding.size.constant;
  const literalShape = binding.shape.constant;
  const markSize = pointMarkSize(frame, fx, params, literalSize);

  // geom_dotplot paints with fill when present (schema: "Map fill/color for groups").
  // Solid point marks only have one paint channel; fill wins over color when both map.
  const fillMapped =
    frame.fillValues !== null ||
    binding.fill.scaledConstant !== null ||
    binding.fill.constant !== null;
  const paintWithFill = geom === "dotplot" && fillMapped;
  const paintScale = paintWithFill ? fill : color;
  const paintValues = paintWithFill ? frame.fillValues : frame.colorValues;
  const paintChannel = paintWithFill ? binding.fill : binding.color;
  const paintKey = paintWithFill ? ("fill" as const) : ("color" as const);

  const batch: PointsBatch = {
    kind: "points",
    layerIndex: binding.index,
    panelIndex: 0,
    positions,
    rowIndex,
    ...droppedFrameRows(collectedKeptRows, n),
    size: markSize,
    alpha: constantStyle(binding, params, "alpha", 1),
    shape:
      typeof literalShape === "string" ? (literalShape as PointShape) : (paramShape ?? "circle"),
    fill: paintChannel.constant,
  };
  attachMappedPointStyles(batch, frame, styles, collectedKeptRows);
  attachMappedPointPaint(
    batch,
    frame,
    paintKey,
    paintScale,
    paintValues,
    paintChannel,
    collectedKeptRows,
  );
  return batch;
}

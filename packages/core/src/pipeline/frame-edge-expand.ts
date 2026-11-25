/**
 * Pre-geometry edge expansion for continuous tile/raster so scale training
 * sees xmin/xmax/ymin/ymax. Band tile leaves edges null (centers train).
 */
import { tileResolution } from "../stats/numeric.js";
import type { CellValue } from "../table.js";

import { positionFieldType } from "./temporal-position.js";
import type { LayerFrame, PipelineWarning } from "./types.js";
import { PipelineError } from "./types.js";

const RASTER_SPACING_EPS = Math.sqrt(Number.EPSILON);

function sizeAt(
  sizeColumn: readonly CellValue[] | null,
  param: number | undefined,
  defaultSize: number,
  row: number,
): number {
  if (sizeColumn !== null) {
    // Panel-local table after faceting — index by frame row, not source id.
    const raw = sizeColumn[row]!;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }
  if (param !== undefined) return param;
  return defaultSize;
}

function uniqueSorted(values: Float64Array): number[] {
  const set = new Set<number>();
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (Number.isFinite(v)) set.add(v);
  }
  return [...set].toSorted((a, b) => a - b);
}

function spacingOf(unique: readonly number[]): { size: number; irregular: boolean } {
  if (unique.length <= 1) return { size: 1, irregular: false };
  let min = Infinity;
  let irregular = false;
  let firstGap = NaN;
  for (let i = 1; i < unique.length; i++) {
    const d = unique[i]! - unique[i - 1]!;
    if (!(d > 0)) continue;
    if (!Number.isFinite(firstGap)) firstGap = d;
    else if (Math.abs(d - firstGap) > RASTER_SPACING_EPS) irregular = true;
    if (d < min) min = d;
  }
  return { size: Number.isFinite(min) && min > 0 ? min : 1, irregular };
}

/** Expand continuous tile/raster frames with edge arrays before scale training. */
export function expandEdgeFrame(frame: LayerFrame, warnings: PipelineWarning[]): void {
  const geom = frame.binding.layer.geom;
  if (geom !== "tile" && geom !== "raster") return;
  if (frame.xNumeric === null || frame.yNumeric === null) return;

  if (geom === "tile") {
    expandTileFrame(frame);
    return;
  }
  expandRasterFrame(frame, warnings);
}

function expandTileFrame(frame: LayerFrame): void {
  const xNumeric = frame.xNumeric;
  const yNumeric = frame.yNumeric;
  if (xNumeric === null || yNumeric === null) return;
  const xType =
    frame.binding.xField === null
      ? "quantitative"
      : positionFieldType(frame.table, frame.binding.xField, frame.binding.xConversion);
  const yType =
    frame.binding.yField === null
      ? "quantitative"
      : positionFieldType(frame.table, frame.binding.yField, frame.binding.yConversion);

  // Band axes train from centers only. Expand edges only on continuous axes
  // (mixed band+continuous tiles keep continuous-axis domain expansion).
  // Clear inactive edge arrays so inherited plot-level ymin/ymax (or xmin/xmax)
  // meant for rect/ribbon cannot train continuous edge evidence on a band axis.
  if (xType === "nominal") {
    frame.xmin = null;
    frame.xmax = null;
  }
  if (yType === "nominal") {
    frame.ymin = null;
    frame.ymax = null;
  }
  if (xType === "nominal" && yType === "nominal") return;
  const params = (frame.binding.layer.params ?? {}) as { width?: number; height?: number };
  const widthCol =
    frame.binding.widthField === null ? null : frame.table.column(frame.binding.widthField);
  const heightCol =
    frame.binding.heightField === null ? null : frame.table.column(frame.binding.heightField);
  if (xType !== "nominal") {
    [frame.xmin, frame.xmax] = expandTileAxis(xNumeric, widthCol, params.width);
  }
  if (yType !== "nominal") {
    [frame.ymin, frame.ymax] = expandTileAxis(yNumeric, heightCol, params.height);
  }
}

function expandTileAxis(
  values: Float64Array,
  sizeColumn: readonly CellValue[] | null,
  param: number | undefined,
): readonly [Float64Array, Float64Array] {
  const fallback = sizeColumn === null && param === undefined ? tileResolution(values) : 1;
  const low = new Float64Array(values.length);
  const high = new Float64Array(values.length);
  for (let row = 0; row < values.length; row++) {
    const center = values[row]!;
    const size = sizeAt(sizeColumn, param, fallback, row);
    if (!Number.isFinite(center) || !(size > 0) || !Number.isFinite(size)) {
      low[row] = NaN;
      high[row] = NaN;
      continue;
    }
    low[row] = center - size / 2;
    high[row] = center + size / 2;
  }
  return [low, high];
}

function expandRasterFrame(frame: LayerFrame, warnings: PipelineWarning[]): void {
  const xNumeric = frame.xNumeric;
  const yNumeric = frame.yNumeric;
  if (xNumeric === null || yNumeric === null) return;
  const params = (frame.binding.layer.params ?? {}) as {
    interpolate?: unknown;
    hjust?: number;
    vjust?: number;
  };
  // Schema only admits false; reject any non-false truthy at runtime too.
  if ((params as { interpolate?: unknown }).interpolate === true) {
    throw new PipelineError(
      "unsupported-param",
      `/layers/${frame.binding.index}/params/interpolate`,
      "geom raster only supports interpolate: false (nearest / no interpolation).",
    );
  }
  const hjust = params.hjust ?? 0.5;
  const vjust = params.vjust ?? 0.5;
  const seen = new Map<string, number>();
  for (let row = 0; row < frame.n; row++) {
    const x = xNumeric[row]!;
    const y = yNumeric[row]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const key = `${x}\0${y}`;
    if (seen.has(key)) {
      throw new PipelineError(
        "raster-duplicate-cells",
        `/layers/${frame.binding.index}`,
        `The raster geom found duplicate coordinates at (x=${String(x)}, y=${String(y)}). Aggregate to one value per cell or use geom "tile".`,
      );
    }
    seen.set(key, row);
  }
  const xSpace = spacingOf(uniqueSorted(xNumeric));
  const ySpace = spacingOf(uniqueSorted(yNumeric));
  if (xSpace.irregular || ySpace.irregular) {
    warnings.push({
      code: "raster-irregular-spacing",
      message: `Raster cells at layer ${frame.binding.index} are not on a regular grid; cells will use the minimum spacing. Consider geom "tile" instead.`,
    });
  }
  const left = new Float64Array(frame.n);
  const right = new Float64Array(frame.n);
  const bottom = new Float64Array(frame.n);
  const top = new Float64Array(frame.n);
  for (let row = 0; row < frame.n; row++) {
    const x = xNumeric[row]!;
    const y = yNumeric[row]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      left[row] = NaN;
      right[row] = NaN;
      bottom[row] = NaN;
      top[row] = NaN;
      continue;
    }
    left[row] = x - xSpace.size * (1 - hjust);
    right[row] = x + xSpace.size * hjust;
    bottom[row] = y - ySpace.size * (1 - vjust);
    top[row] = y + ySpace.size * vjust;
  }
  frame.xmin = left;
  frame.xmax = right;
  frame.ymin = bottom;
  frame.ymax = top;
}

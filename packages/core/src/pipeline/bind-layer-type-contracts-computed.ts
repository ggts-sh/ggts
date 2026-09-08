/**
 * Computed-y and bin-param contracts for bindLayer.
 */
import type { BarParams, LayerSpec } from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";

import { positionFieldType, type PositionConversionContext } from "./temporal-position.js";
import { PipelineError } from "./types.js";

function computedYMessage(geom: LayerSpec["geom"], stat: string): string | null {
  if (geom === "bar")
    return `The bar geom computes y with the ${stat} stat, so aes.y must not map data. Use geom "col" for pre-computed heights.`;
  if (geom === "density")
    return "The density geom computes y with the density stat, so aes.y must not map data. Map only x.";
  if (geom === "function" || stat === "function")
    return "The function geom/stat computes y from the named function, so aes.y must not map data.";
  if (stat === "ecdf")
    return "The ecdf stat computes y (cumulative proportion), so aes.y must not map data. Map only x.";
  if (geom === "dotplot" || stat === "bindot")
    return "The dotplot geom computes y with the bindot stat, so aes.y must not map data. Map only x.";
  return null;
}

function validateBinContracts(input: {
  stat: string;
  params: LayerSpec["params"];
  index: number;
  table: ColumnTable;
  xField: string | null;
  xConversion: PositionConversionContext;
}): void {
  if (input.stat !== "bin" && input.stat !== "summary_bin" && input.stat !== "bindot") return;
  const params = input.params as BarParams;
  if (params.center !== undefined && params.boundary !== undefined) {
    throw new PipelineError(
      "bin-center-and-boundary",
      `/layers/${input.index}/params`,
      `The ${input.stat} stat accepts params.center OR params.boundary (both align the bin grid), never both.`,
    );
  }
  if (
    input.xField === null ||
    positionFieldType(input.table, input.xField, input.xConversion) !== "nominal"
  )
    return;
  const msg =
    input.stat === "summary_bin"
      ? `The summary_bin stat needs a continuous x, but field "${input.xField}" is nominal.`
      : input.stat === "bindot"
        ? `The bindot stat needs a continuous x, but field "${input.xField}" is nominal.`
        : `The bin stat needs a continuous x, but field "${input.xField}" is nominal. Use geom "bar" (the count stat) to count categories instead.`;
  throw new PipelineError("channel-type-mismatch", `/layers/${input.index}/aes/x`, msg);
}

export function validateComputedYAndBinContracts(input: {
  layer: LayerSpec;
  index: number;
  table: ColumnTable;
  xField: string | null;
  yField: string | null;
  xConversion: PositionConversionContext;
  yConversion: PositionConversionContext;
}): void {
  const { layer, index, table, xField, yField, xConversion } = input;
  const geom = layer.geom;
  const stat = layer.stat ?? "identity";
  const message = computedYMessage(geom, stat);
  if (yField !== null && message !== null) {
    throw new PipelineError("computed-y-mapped", `/layers/${index}/aes/y`, message);
  }
  validateBinContracts({ stat, params: layer.params ?? {}, index, table, xField, xConversion });
}

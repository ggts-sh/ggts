/**
 * Density/smooth/boxplot channel-type contracts for bindLayer.
 */
import type { LayerSpec } from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";

import { positionFieldType, type PositionConversionContext } from "./temporal-position.js";
import { PipelineError } from "./types.js";

interface ChannelTypeContext {
  index: number;
  table: ColumnTable;
  xField: string | null;
  yField: string | null;
  xConversion: PositionConversionContext;
  yConversion: PositionConversionContext;
}

function assertContinuousChannels(
  context: ChannelTypeContext,
  channels: readonly ("x" | "y")[],
  message: (field: string, channel: "x" | "y") => string,
): void {
  for (const channel of channels) {
    const field = channel === "x" ? context.xField : context.yField;
    const conversion = channel === "x" ? context.xConversion : context.yConversion;
    if (field === null || positionFieldType(context.table, field, conversion) !== "nominal")
      continue;
    throw new PipelineError(
      "channel-type-mismatch",
      `/layers/${context.index}/aes/${channel}`,
      message(field, channel),
    );
  }
}

function validateBoxplotChannels(context: ChannelTypeContext): void {
  const { index, table, xField, yField, xConversion, yConversion } = context;
  if (xField !== null && positionFieldType(table, xField, xConversion) !== "nominal") {
    throw new PipelineError(
      "channel-type-mismatch",
      `/layers/${index}/aes/x`,
      `The boxplot geom needs a DISCRETE x this milestone, but field "${xField}" is ${positionFieldType(table, xField, xConversion)}. Map x to a categorical field.`,
    );
  }
  if (yField !== null && positionFieldType(table, yField, yConversion) === "nominal") {
    throw new PipelineError(
      "channel-type-mismatch",
      `/layers/${index}/aes/y`,
      `The boxplot stat needs a quantitative y, but field "${yField}" is nominal.`,
    );
  }
}

export function validateGeomChannelTypeContracts(input: {
  layer: LayerSpec;
  index: number;
  table: ColumnTable;
  xField: string | null;
  yField: string | null;
  xConversion: PositionConversionContext;
  yConversion: PositionConversionContext;
}): void {
  const { layer, index, table, xField, yField, xConversion, yConversion } = input;
  const geom = layer.geom;
  const context = { index, table, xField, yField, xConversion, yConversion };

  if (geom === "density")
    assertContinuousChannels(
      context,
      ["x"],
      (field) =>
        `The density stat needs a continuous x, but field "${field}" is nominal. Use geom "bar" (the count stat) to count categories instead.`,
    );
  if (geom === "smooth" || geom === "quantile") {
    assertContinuousChannels(
      context,
      ["x", "y"],
      (field, channel) =>
        `The ${geom} stat needs quantitative x and y, but field "${field}" (${channel}) is nominal.`,
    );
  }
  if (layer.stat === "ellipse")
    assertContinuousChannels(
      context,
      ["x", "y"],
      (field, channel) =>
        `The ellipse stat needs quantitative x and y, but field "${field}" (${channel}) is nominal.`,
    );
  if (geom === "boxplot") validateBoxplotChannels(context);
  if (geom === "raster")
    assertContinuousChannels(
      context,
      ["x", "y"],
      (field, channel) =>
        `The raster geom needs continuous ${channel}, but field "${field}" is nominal. Use geom "tile" for discrete axes.`,
    );
  if (geom === "spoke")
    assertContinuousChannels(
      context,
      ["x", "y"],
      (field, channel) =>
        `The spoke geom needs continuous ${channel} for endpoint math (${channel} + radius·${channel === "x" ? "cos" : "sin"}(angle)); field "${field}" is nominal.`,
    );
}

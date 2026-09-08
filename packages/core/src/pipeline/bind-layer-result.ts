/**
 * Assemble LayerBinding from resolved channel fields and extras.
 */
import type { NormalizedLayerSpec } from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";

import type { LayerBinding } from "./types.js";

export function makeLayerBinding(input: {
  layer: NormalizedLayerSpec;
  index: number;
  sourceTable: ColumnTable;
  sourceId: number;
  xField: string | null;
  yField: string | null;
  yStatColumn: string | null;
  xConversion: LayerBinding["xConversion"];
  yConversion: LayerBinding["yConversion"];
  yminField: string | null;
  ymaxField: string | null;
  xminField: string | null;
  xmaxField: string | null;
  widthField: string | null;
  heightField: string | null;
  xendField: string | null;
  yendField: string | null;
  angleField: string | null;
  radiusField: string | null;
  ribbonOrientation?: "x" | "y";
  color: LayerBinding["color"];
  fill: LayerBinding["fill"];
  size: LayerBinding["size"];
  linewidth: LayerBinding["linewidth"];
  alpha: LayerBinding["alpha"];
  shape: LayerBinding["shape"];
  linetype: LayerBinding["linetype"];
  labelField: string | null;
  labelConstant: string | null;
  weightField: string | null;
  sampleField: string | null;
  zField: string | null;
  mapIdField: string | null;
  ruleForm: LayerBinding["ruleForm"];
}): LayerBinding {
  return {
    layer: input.layer,
    index: input.index,
    sourceTable: input.sourceTable,
    sourceId: input.sourceId,
    xField: input.xField,
    yField: input.yField,
    yStatColumn: input.yStatColumn,
    xConversion: input.xConversion,
    yConversion: input.yConversion,
    yminField: input.yminField,
    ymaxField: input.ymaxField,
    xminField: input.xminField,
    xmaxField: input.xmaxField,
    widthField: input.widthField,
    heightField: input.heightField,
    xendField: input.xendField,
    yendField: input.yendField,
    angleField: input.angleField,
    radiusField: input.radiusField,
    zField: input.zField,
    mapIdField: input.mapIdField,
    ...(input.ribbonOrientation !== undefined && { ribbonOrientation: input.ribbonOrientation }),
    color: input.color,
    fill: input.fill,
    size: input.size,
    linewidth: input.linewidth,
    alpha: input.alpha,
    shape: input.shape,
    linetype: input.linetype,
    labelField: input.labelField,
    labelConstant: input.labelConstant,
    weightField: input.weightField,
    sampleField: input.sampleField,
    ruleForm: input.ruleForm,
  };
}

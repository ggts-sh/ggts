/**
 * Per-layer aes channel resolution and structural geom/stat validation.
 */
import type { Aes, NormalizedLayerSpec } from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";

import { resolveLabelWeightColorFill } from "./bind-layer-extras.js";
import { resolveLayerPositionChannels } from "./bind-layer-position.js";
import { makeLayerBinding } from "./bind-layer-result.js";
import { AUTO_POSITION_CONVERSION, type PositionConversionContext } from "./temporal-position.js";
import type { LayerBinding, PipelineWarning } from "./types.js";
import { PipelineError } from "./types.js";

const DEFAULT_BIND_CONVERSIONS = Object.freeze({
  x: AUTO_POSITION_CONVERSION,
  y: AUTO_POSITION_CONVERSION,
});

export function bindLayer(
  layer: NormalizedLayerSpec,
  index: number,
  table: ColumnTable,
  warnings: PipelineWarning[],
  conversions: Readonly<{
    x: PositionConversionContext;
    y: PositionConversionContext;
  }> = DEFAULT_BIND_CONVERSIONS,
  /** Unfiltered source table + registry id; defaults to `table` / 0 for legacy tests. */
  source?: { sourceTable: ColumnTable; sourceId: number },
): LayerBinding {
  const resolvedSource = source ?? { sourceTable: table, sourceId: 0 };
  const aes: Aes = layer.aes ?? {};
  const position = resolveLayerPositionChannels({
    layer,
    aes,
    index,
    table,
    warnings,
    xConversion: conversions.x,
    yConversion: conversions.y,
  });
  const extras = resolveLabelWeightColorFill({
    aes,
    geom: layer.geom,
    stat: layer.stat ?? "identity",
    index,
    table,
    warnings,
  });

  // A fixed-intercept annotation rule emits no data rows, so a field- or
  // after-stat-mapped style has nothing to map — the packer would produce NaN
  // or invalid style vectors. Reject it here (scaled/literal constants are
  // still fine). Compatibility with the rule geom is enforced upstream, so only
  // linewidth/linetype/alpha realistically reach this guard.
  if (position.ruleForm === "annotation" || layer.geom === "abline") {
    const styleBindings = {
      size: extras.size,
      linewidth: extras.linewidth,
      alpha: extras.alpha,
      shape: extras.shape,
      linetype: extras.linetype,
    } as const;
    for (const channelName of Object.keys(styleBindings) as (keyof typeof styleBindings)[]) {
      const style = styleBindings[channelName];
      if (style.field !== null || style.statColumn !== null) {
        throw new PipelineError(
          "unsupported-annotation-style",
          `/layers/${String(index)}/aes/${channelName}`,
          `A fixed-intercept ${layer.geom} annotation has no data rows, so aes.${channelName} cannot map a field or after-stat column. Use a constant value (optionally { value, scale: true }).`,
        );
      }
    }
  }

  return makeLayerBinding({
    layer,
    index,
    sourceTable: resolvedSource.sourceTable,
    sourceId: resolvedSource.sourceId,
    xField: position.xField,
    yField: position.yField,
    yStatColumn: position.yStatColumn,
    xConversion: conversions.x,
    yConversion: conversions.y,
    yminField: position.yminField,
    ymaxField: position.ymaxField,
    xminField: position.xminField,
    xmaxField: position.xmaxField,
    widthField: position.widthField,
    heightField: position.heightField,
    xendField: position.xendField,
    yendField: position.yendField,
    angleField: position.angleField,
    radiusField: position.radiusField,
    ...(position.ribbonOrientation !== undefined && {
      ribbonOrientation: position.ribbonOrientation,
    }),
    color: extras.color,
    fill: extras.fill,
    size: extras.size,
    linewidth: extras.linewidth,
    alpha: extras.alpha,
    shape: extras.shape,
    linetype: extras.linetype,
    labelField: extras.labelField,
    labelConstant: extras.labelConstant,
    weightField: extras.weightField,
    sampleField: extras.sampleField,
    zField: extras.zField,
    mapIdField: extras.mapIdField,
    ruleForm: position.ruleForm,
  });
}

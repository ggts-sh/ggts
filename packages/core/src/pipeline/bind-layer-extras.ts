/**
 * Label, weight, and color/fill resolution after required-channel checks.
 */
import type { Aes, NormalizedGeomName, StatName } from "@ggts-sh/spec";

import type { ColumnTable } from "../table.js";

import { checkField } from "./bind-layer-check-field.js";
import { colorBinding } from "./bind-layer-color-binding.js";
import { styleBinding } from "./bind-layer-style-binding.js";
import { applyColorOnFillGeomWarning } from "./bind-layer-color-warn.js";
import type { ColorBinding, PipelineWarning, StyleBinding } from "./types.js";
import { PipelineError } from "./types.js";

function resolveLabel(input: {
  aes: Aes;
  geom: NormalizedGeomName;
  index: number;
  table: ColumnTable;
  warnings: PipelineWarning[];
}): { labelField: string | null; labelConstant: string | null } {
  let labelField: string | null = null;
  let labelConstant: string | null = null;
  const label = input.aes.label;
  if (label !== undefined && label !== null) {
    if ("field" in label)
      labelField = checkField(label, "label", input.index, input.table, input.warnings);
    else if ("value" in label) labelConstant = String(label.value);
  }
  const requiresLabel =
    input.geom === "text" ||
    input.geom === "label" ||
    input.geom === "sf_text" ||
    input.geom === "sf_label";
  if (requiresLabel && labelField === null && labelConstant === null) {
    throw new PipelineError(
      "missing-channel",
      `/layers/${input.index}/aes/label`,
      `The ${input.geom} geom requires a "label" channel (map it with aes).`,
    );
  }
  return { labelField, labelConstant };
}

function requireExtraField(input: {
  mapping: Aes[keyof Aes];
  channel: "sample" | "z" | "map_id";
  required: boolean;
  index: number;
  table: ColumnTable;
  warnings: PipelineWarning[];
  message: string;
}): string | null {
  const field = checkField(input.mapping, input.channel, input.index, input.table, input.warnings);
  if (input.required && field === null) {
    throw new PipelineError(
      "missing-channel",
      `/layers/${input.index}/aes/${input.channel}`,
      input.message,
    );
  }
  return field;
}

function warnUnsupportedWeight(
  weightField: string | null,
  stat: StatName,
  index: number,
  warnings: PipelineWarning[],
): void {
  if (
    weightField === null ||
    (stat !== "boxplot" && stat !== "smooth" && stat !== "summary" && stat !== "summary_bin")
  )
    return;
  warnings.push({
    code: "weight-unsupported",
    message: `Layer ${index}: the ${stat} stat does not support aes.weight; the weight mapping is ignored.`,
  });
}

export function resolveLabelWeightColorFill(input: {
  aes: Aes;
  geom: NormalizedGeomName;
  stat: StatName;
  index: number;
  table: ColumnTable;
  warnings: PipelineWarning[];
}): {
  labelField: string | null;
  labelConstant: string | null;
  weightField: string | null;
  sampleField: string | null;
  zField: string | null;
  mapIdField: string | null;
  color: ColorBinding;
  fill: ColorBinding;
  size: StyleBinding;
  linewidth: StyleBinding;
  alpha: StyleBinding;
  shape: StyleBinding;
  linetype: StyleBinding;
} {
  const { aes, geom, stat, index, table, warnings } = input;

  const { labelField, labelConstant } = resolveLabel(input);
  const weightField = checkField(aes.weight, "weight", index, table, warnings);
  const sampleField = requireExtraField({
    mapping: aes.sample,
    channel: "sample",
    required: geom === "qq" || geom === "qq_line",
    index,
    table,
    warnings,
    message: `The ${geom} geom requires a "sample" channel (map the distribution column with aes.sample).`,
  });
  const zField = requireExtraField({
    mapping: aes.z,
    channel: "z",
    required: geom === "contour",
    index,
    table,
    warnings,
    message: 'The contour geom requires a continuous "z" channel (map it with aes).',
  });
  const mapIdField = requireExtraField({
    mapping: aes.map_id,
    channel: "map_id",
    required: geom === "map",
    index,
    table,
    warnings,
    message: 'The map geom requires a "map_id" channel (map it with aes).',
  });

  const color = colorBinding(aes.color, "color", stat, index, table, warnings);
  const fill = colorBinding(aes.fill, "fill", stat, index, table, warnings);
  applyColorOnFillGeomWarning(geom, index, color, warnings);
  const size = styleBinding(aes.size, "size", geom, stat, index, table, warnings);
  const linewidth = styleBinding(aes.linewidth, "linewidth", geom, stat, index, table, warnings);
  const alpha = styleBinding(aes.alpha, "alpha", geom, stat, index, table, warnings);
  const shape = styleBinding(aes.shape, "shape", geom, stat, index, table, warnings);
  const linetype = styleBinding(aes.linetype, "linetype", geom, stat, index, table, warnings);
  warnUnsupportedWeight(weightField, stat, index, warnings);

  return {
    labelField,
    labelConstant,
    weightField,
    sampleField,
    zField,
    mapIdField,
    color,
    fill,
    size,
    linewidth,
    alpha,
    shape,
    linetype,
  };
}

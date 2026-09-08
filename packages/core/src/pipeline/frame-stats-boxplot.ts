/**
 * Boxplot stat → LayerFrame (hinges, whiskers, outliers).
 */
import type { BoxplotParams } from "@ggts-sh/spec";

import { statBoxplot } from "../stats/boxplot.js";
import type { ColumnTable } from "../table.js";

import { carriedColumns, removedStatWarning } from "./frame-helpers.js";
import { makeColumnOf } from "./frame-stats-shared.js";
import { statLayerFrame } from "./layer-frame.js";
import { positionColumn } from "./temporal-position.js";
import type { LayerBinding, LayerFrame, PipelineWarning } from "./types.js";

export function buildBoxplotFrame(
  binding: LayerBinding,
  table: ColumnTable,
  groups: readonly number[],
  warnings: PipelineWarning[],
): LayerFrame {
  const { layer, index } = binding;
  const carried = carriedColumns(binding, table);
  const columnOf = makeColumnOf(binding);
  const params = (layer.params ?? {}) as BoxplotParams;
  const result = statBoxplot({
    x: table.column(binding.xField!),
    y: positionColumn(table, binding.yField!, binding.yConversion, binding.yTransform),
    groups,
    ...(params.coef !== undefined && { coef: params.coef }),
    carried,
  });
  removedStatWarning(result.dropped, index, "missing or non-finite y", warnings);
  return statLayerFrame({
    binding,
    table,
    n: result.x.length,
    x: { values: result.x, numeric: null },
    y: { numeric: null, values: null },
    groups: result.groups,
    inputGroups: groups,
    columns: {
      ymin: result.ymin,
      lower: result.lower,
      middle: result.middle,
      upper: result.upper,
      ymax: result.ymax,
    },
    columnOf: columnOf(result, result.x),
    lineage: "none",
    extras: {
      ymin: result.ymin,
      ymax: result.ymax,
      box: {
        lower: result.lower,
        middle: result.middle,
        upper: result.upper,
        outlierX: result.outliers.map((o) => o.x),
        outlierY: Float64Array.from(result.outliers.map((o) => o.y)),
        outlierBox: Uint32Array.from(result.outliers.map((o) => o.boxRow)),
        outlierRow: Uint32Array.from(result.outliers.map((o) => o.sourceRow)),
      },
    },
  });
}

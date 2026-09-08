/**
 * Quantile stat → LayerFrame (linear RQ lines per group × τ).
 */
import type { QuantileParams } from "@ggts-sh/spec";

import { normalizeQuantiles, statQuantile } from "../stats/quantile.js";
import type { ColumnTable } from "../table.js";

import { carriedColumns, removedStatWarning } from "./frame-helpers.js";
import { makeColumnOf } from "./frame-stats-shared.js";
import { statLayerFrame } from "./layer-frame.js";
import { positionColumn } from "./temporal-position.js";
import type { LayerBinding, LayerFrame, PipelineWarning } from "./types.js";

export function buildQuantileFrame(
  binding: LayerBinding,
  table: ColumnTable,
  groups: readonly number[],
  warnings: PipelineWarning[],
): LayerFrame {
  const { layer, index } = binding;
  const carried = carriedColumns(binding, table);
  const columnOf = makeColumnOf(binding);
  const params = (layer.params ?? {}) as QuantileParams;
  const quantiles = normalizeQuantiles(params.quantiles);
  if (quantiles.length === 0) {
    warnings.push({
      code: "quantile-empty",
      message: `Layer ${index} (quantile): no valid quantiles in (0,1); nothing drawn.`,
    });
  }
  const result = statQuantile({
    x: positionColumn(table, binding.xField!, binding.xConversion, binding.xTransform),
    y: positionColumn(table, binding.yField!, binding.yConversion, binding.yTransform),
    groups,
    quantiles,
    ...(params.n !== undefined && { n: params.n }),
    carried,
  });
  removedStatWarning(result.dropped, index, "missing or non-finite x/y before quantile", warnings);
  if (result.droppedGroups > 0) {
    warnings.push({
      code: "quantile-group-dropped",
      message: `Layer ${index} (quantile): ${result.droppedGroups} group(s) too small or degenerate (constant x) were dropped.`,
    });
  }
  return statLayerFrame({
    binding,
    table,
    n: result.x.length,
    x: { numeric: result.x },
    y: { numeric: result.y },
    groups: result.groups,
    inputGroups: groups,
    columns: { x: result.x, y: result.y },
    columnOf: columnOf(result, null),
    lineage: "none",
  });
}

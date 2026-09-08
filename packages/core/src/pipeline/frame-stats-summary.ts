/**
 * Summary stat → LayerFrame (y/ymin/ymax for errorbars and related geoms).
 */
import type { ErrorbarParams } from "@ggts-sh/spec";

import { statSummary } from "../stats/summary.js";
import type { CellValue, ColumnTable } from "../table.js";

import { carriedColumns, removedStatWarning } from "./frame-helpers.js";
import { makeColumnOf, shouldAggregateOnSemanticTemporalX } from "./frame-stats-shared.js";
import { statLayerFrame } from "./layer-frame.js";
import { positionColumn, positionValuesToNumeric } from "./temporal-position.js";
import type { LayerBinding, LayerFrame, PipelineWarning } from "./types.js";

export function buildSummaryFrame(
  binding: LayerBinding,
  table: ColumnTable,
  groups: readonly number[],
  warnings: PipelineWarning[],
): LayerFrame {
  const { layer, index } = binding;
  const carried = carriedColumns(binding, table);
  const columnOf = makeColumnOf(binding);
  const params = (layer.params ?? {}) as ErrorbarParams;
  const xField = binding.xField!;
  const parsedX = table.parsed(
    xField,
    binding.xConversion.sourceParser,
    binding.xConversion.options,
  );
  const temporalX = shouldAggregateOnSemanticTemporalX(binding, parsedX.decision.status);
  const transformedContinuousX =
    !temporalX && binding.xTransform !== undefined
      ? positionColumn(table, xField, binding.xConversion, binding.xTransform)
      : null;
  const summaryX: readonly (CellValue | null)[] = temporalX
    ? Array.from(parsedX.semantic, (value, row) => (parsedX.valid[row] === 1 ? value : null))
    : transformedContinuousX === null
      ? table.column(xField)
      : Array.from(transformedContinuousX, (value) => (Number.isFinite(value) ? value : null));
  const result = statSummary({
    x: summaryX,
    y: positionColumn(table, binding.yField!, binding.yConversion, binding.yTransform),
    groups,
    fun: params.fun,
    funMin: params.funMin,
    funMax: params.funMax,
    carried,
  });
  removedStatWarning(result.dropped, index, "missing x or non-finite y", warnings);
  const displayX: CellValue[] =
    transformedContinuousX === null
      ? result.x
      : result.x.map((value) => binding.xTransform!.transform.inverse(value as number));
  return statLayerFrame({
    binding,
    table,
    n: result.x.length,
    x: {
      values: displayX,
      numeric:
        temporalX || transformedContinuousX !== null
          ? Float64Array.from(result.x, (value) => (typeof value === "number" ? value : Number.NaN))
          : positionValuesToNumeric(result.x, binding.xConversion).values,
    },
    y: { numeric: result.y },
    groups: result.groups,
    inputGroups: groups,
    columns: {
      y: result.y,
      ymin: result.ymin,
      ymax: result.ymax,
    },
    columnOf: columnOf(result, displayX),
    lineage: "none",
    extras: {
      ymin: result.ymin,
      ymax: result.ymax,
    },
  });
}

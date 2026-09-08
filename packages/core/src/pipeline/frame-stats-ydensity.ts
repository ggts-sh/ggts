/**
 * ydensity stat → LayerFrame (violin polygons from mirrored density).
 */
import type { ViolinParams } from "@ggts-sh/spec";

import { statYDensity } from "../stats/ydensity.js";
import type { ColumnTable } from "../table.js";

import { carriedColumns, removedStatWarning } from "./frame-helpers.js";
import { makeColumnOf } from "./frame-stats-shared.js";
import { statLayerFrame } from "./layer-frame.js";
import { positionColumn } from "./temporal-position.js";
import type { LayerBinding, LayerFrame, PipelineWarning } from "./types.js";

export function buildYDensityFrame(
  binding: LayerBinding,
  table: ColumnTable,
  groups: readonly number[],
  warnings: PipelineWarning[],
): LayerFrame {
  const { layer, index } = binding;
  const carried = carriedColumns(binding, table);
  const columnOf = makeColumnOf(binding);
  const params = (layer.params ?? {}) as ViolinParams;
  const result = statYDensity({
    y: positionColumn(table, binding.yField!, binding.yConversion, binding.yTransform),
    x: table.column(binding.xField!),
    groups,
    carried,
    params: {
      ...(params.bw !== undefined && { bw: params.bw }),
      ...(params.adjust !== undefined && { adjust: params.adjust }),
      ...(params.n !== undefined && { n: params.n }),
      ...(params.trim !== undefined && { trim: params.trim }),
      ...(params.scale !== undefined && { scale: params.scale }),
    },
  });
  removedStatWarning(result.dropped, index, "missing or non-finite y", warnings);
  if (result.droppedGroups > 0) {
    warnings.push({
      code: "ydensity-group-dropped",
      message: `Layer ${index} (ydensity): ${result.droppedGroups} group(s) with fewer than two data points have been dropped.`,
    });
  }
  return statLayerFrame({
    binding,
    table,
    n: result.y.length,
    x: { values: result.x, numeric: null },
    y: { numeric: result.y },
    groups: result.groups,
    inputGroups: groups,
    columns: {
      density: result.density,
      scaled: result.scaled,
      count: result.count,
      violinwidth: result.violinwidth,
    },
    columnOf: columnOf(result, result.x),
    lineage: "none",
    extras: {
      // ymin stashes violinwidth (unitless 0–1 × scale factor) for geometry-violin.
      xmin: null,
      xmax: null,
      ymin: result.violinwidth,
      ymax: result.violinwidth,
    },
  });
}

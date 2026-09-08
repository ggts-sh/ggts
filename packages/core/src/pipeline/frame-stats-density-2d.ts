/**
 * density_2d / density_2d_filled → LayerFrame of isoline vertices (#802).
 *
 * Path series keyed by (group × piece). after_stat level for tooltips / fill.
 */
import type { Density2dParams } from "@ggts-sh/spec";

import { statDensity2d } from "../stats/density-2d.js";
import type { ColumnTable } from "../table.js";

import { carriedColumns, removedStatWarning } from "./frame-helpers.js";
import { makeColumnOf } from "./frame-stats-shared.js";
import { statLayerFrame } from "./layer-frame.js";
import { positionColumn } from "./temporal-position.js";
import type { LayerBinding, LayerFrame, PipelineWarning } from "./types.js";

export function buildDensity2dFrame(
  binding: LayerBinding,
  table: ColumnTable,
  groups: readonly number[],
  warnings: PipelineWarning[],
): LayerFrame {
  const { layer, index } = binding;
  const filled =
    layer.geom === "density_2d_filled" ||
    // stat may be density_2d_filled after normalize (hand LayerSpec union).
    (layer as { stat?: string }).stat === "density_2d_filled";
  const carried = carriedColumns(binding, table);
  const columnOf = makeColumnOf(binding);
  const baseParams = (layer.params ?? {}) as Density2dParams;
  const result = statDensity2d({
    x: positionColumn(table, binding.xField!, binding.xConversion, binding.xTransform),
    y: positionColumn(table, binding.yField!, binding.yConversion, binding.yTransform),
    groups,
    carried,
    params: { ...baseParams, filled },
  });
  removedStatWarning(
    result.dropped,
    index,
    "missing or non-finite x/y before density_2d",
    warnings,
  );
  if (result.droppedGroups > 0) {
    warnings.push({
      code: "density-2d-group-dropped",
      message: `Layer ${index} (${layer.geom}): ${result.droppedGroups} group(s) with fewer than two points or no contours were dropped.`,
    });
  }
  if (filled && result.openRingsDropped > 0) {
    warnings.push({
      code: "density-2d-filled-open-dropped",
      message: `Layer ${index} (density_2d_filled): dropped ${result.openRingsDropped} open isoline ring(s); v1 fills closed rings only.`,
    });
  }

  // One path series per (source group × polyline piece) — levels stay in `level`.
  const pieceKey = new Map<string, number>();
  const outGroups: number[] = [];
  let next = 0;
  for (let i = 0; i < result.groups.length; i++) {
    const key = `${result.groups[i]!}\0${result.piece[i]!}\0${result.level[i]!}`;
    let id = pieceKey.get(key);
    if (id === undefined) {
      id = next++;
      pieceKey.set(key, id);
    }
    outGroups.push(id);
  }

  const computed = { level: result.level, density: result.density };
  return statLayerFrame({
    binding,
    table,
    n: result.x.length,
    x: { numeric: result.x },
    y: { numeric: result.y },
    groups: outGroups,
    inputGroups: groups,
    columns: computed,
    columnOf: columnOf(result, null),
    lineage: "none",
    afterStatColor: true,
  });
}

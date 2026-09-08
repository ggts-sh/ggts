/**
 * contour stat → LayerFrame of isoline vertices (#801).
 *
 * Groups are re-keyed by (inputGroup, piece) so each polyline is one path series.
 * level is carried for after_stat / tooltips (color-by-level deferred — ColorBinding
 * has no statColumn yet).
 */
import type { ContourParams } from "@ggts-sh/spec";

import { statContour } from "../stats/contour.js";
import type { ColumnTable } from "../table.js";

import { carriedColumns, removedStatWarning } from "./frame-helpers.js";
import { makeColumnOf } from "./frame-stats-shared.js";
import { statLayerFrame } from "./layer-frame.js";
import { positionColumn } from "./temporal-position.js";
import type { LayerBinding, LayerFrame, PipelineWarning } from "./types.js";

export function buildContourFrame(
  binding: LayerBinding,
  table: ColumnTable,
  groups: readonly number[],
  warnings: PipelineWarning[],
): LayerFrame {
  const { layer, index } = binding;
  const carried = carriedColumns(binding, table);
  const columnOf = makeColumnOf(binding);
  const zField = binding.zField!;
  const result = statContour({
    x: positionColumn(table, binding.xField!, binding.xConversion, binding.xTransform),
    y: positionColumn(table, binding.yField!, binding.yConversion, binding.yTransform),
    z: table.numeric(zField),
    groups,
    carried,
    params: (layer.params ?? {}) as ContourParams,
  });
  removedStatWarning(result.dropped, index, "missing or non-finite x/y/z before contour", warnings);
  if (result.droppedGroups > 0) {
    warnings.push({
      code: "contour-group-dropped",
      message: `Layer ${index} (contour): ${result.droppedGroups} group(s) lacked a usable 2D grid or levels and were dropped.`,
    });
  }

  // One path series per (source group × polyline piece).
  const pieceKey = new Map<string, number>();
  const outGroups: number[] = [];
  let next = 0;
  for (let i = 0; i < result.groups.length; i++) {
    const key = `${result.groups[i]!}\0${result.piece[i]!}`;
    let id = pieceKey.get(key);
    if (id === undefined) {
      id = next++;
      pieceKey.set(key, id);
    }
    outGroups.push(id);
  }

  return statLayerFrame({
    binding,
    table,
    n: result.x.length,
    x: { numeric: result.x },
    y: { numeric: result.y },
    groups: outGroups,
    inputGroups: groups,
    columns: { level: result.level },
    columnOf: columnOf(result, null),
    lineage: "none",
  });
}

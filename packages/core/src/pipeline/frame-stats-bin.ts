/**
 * Bin (histogram) stat → LayerFrame with shared or free break grids.
 */
import type { BarParams } from "@ggts-sh/spec";

import { statBin } from "../stats/bin.js";
import type { ColumnTable } from "../table.js";

import { carriedColumns, removedStatWarning } from "./frame-helpers.js";
import { packBinLayerFrame } from "./frame-stats-bin-frame.js";
import { makeColumnOf } from "./frame-stats-shared.js";
import { positionColumn } from "./temporal-position.js";
import type { Advisory, LayerBinding, LayerFrame, PipelineWarning } from "./types.js";

export function buildBinFrame(
  binding: LayerBinding,
  table: ColumnTable,
  groups: readonly number[],
  warnings: PipelineWarning[],
  advisories: Advisory[],
  binRange?: [number, number],
): LayerFrame {
  const { layer, index } = binding;
  const carried = carriedColumns(binding, table);
  const columnOf = makeColumnOf(binding);
  const result = statBin({
    x: positionColumn(table, binding.xField!, binding.xConversion, binding.xTransform),
    groups,
    weights: binding.weightField === null ? null : table.numeric(binding.weightField),
    carried,
    params: (layer.params ?? {}) as BarParams,
    // Fixed-x facets share one break grid across panels (ggplot2 derives
    // breaks from the shared scale dimension); free_x omits this.
    ...(binRange !== undefined && { range: binRange }),
  });
  removedStatWarning(result.dropped, index, "missing or non-finite x before binning", warnings);
  if (result.usedDefaultBins && result.x.length > 0) {
    // Hadley lesson 12 — the model advisory: geom_histogram's
    // "`stat_bin()` using `bins = 30`. Pick better value with `binwidth`."
    advisories.push({
      code: "bin-default-bins",
      path: `layers.${index}`,
      chosen: "stat bin using bins = 30",
      howToOverride: `Set params.binwidth (preferred — a width meaningful for the data) or params.bins on layer ${index}.`,
    });
  }
  return packBinLayerFrame(binding, table, result, columnOf, groups);
}

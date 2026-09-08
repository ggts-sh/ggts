/**
 * Resolve NamedData / dataset refs into ColumnTables for the pipeline.
 * Supports plot-level and per-layer DataRef (#589).
 */
import type { DataRef, PortableSpec } from "@ggts-sh/spec";

import type { Columns, Rows } from "../table.js";
import { ColumnTable } from "../table.js";

import type { NamedData, RunOptions } from "./types.js";
import { PipelineError } from "./types.js";

function tableFromNamed(data: NamedData): ColumnTable {
  if (Array.isArray(data)) return ColumnTable.fromRows(data);
  if ("values" in data && Array.isArray((data as { values: unknown }).values)) {
    return ColumnTable.fromRows((data as { values: Rows }).values);
  }
  if ("columns" in data && typeof (data as { columns: unknown }).columns === "object") {
    return ColumnTable.fromColumns((data as { columns: Columns }).columns);
  }
  return ColumnTable.fromColumns(data as Columns);
}

/**
 * Resolve a DataRef against spec.datasets / RunOptions.data.
 * `path` is the diagnostic root (`/data` or `/layers/<n>/data`).
 */
function resolveDataRef(
  ref: DataRef,
  spec: PortableSpec,
  options: RunOptions,
  path: string,
): ColumnTable {
  if ("values" in ref) return ColumnTable.fromRows(ref.values);
  if ("columns" in ref) return ColumnTable.fromColumns(ref.columns);
  const name = ref.name;
  const fromSpec = spec.datasets?.[name];
  const fromRun = options.data?.[name];
  if (fromSpec !== undefined && fromRun !== undefined && options.allowOverride !== true) {
    throw new PipelineError(
      "dataset-collision",
      `${path}/name`,
      `Dataset "${name}" is defined in both spec.datasets and RunOptions.data. ` +
        "Pass allowOverride: true to let the runtime data win, or rename one.",
    );
  }
  if (fromRun !== undefined && (fromSpec === undefined || options.allowOverride === true)) {
    return tableFromNamed(fromRun);
  }
  if (fromSpec !== undefined) return tableFromNamed(fromSpec);
  const available = [...Object.keys(spec.datasets ?? {}), ...Object.keys(options.data ?? {})];
  throw new PipelineError(
    "unknown-dataset",
    `${path}/name`,
    `Unknown dataset "${name}". Available: ${available.length > 0 ? available.join(", ") : "none"}.`,
  );
}

/**
 * Optional plot-level data. Returns null when the plot omits `data` so layers
 * can supply their own tables.
 */
export function bindPlotData(spec: PortableSpec, options: RunOptions): ColumnTable | null {
  if (spec.data === undefined) return null;
  return resolveDataRef(spec.data, spec, options, "/data");
}

/**
 * Resolve one layer's table: explicit layer.data wins; else inherit plot table.
 * Throws layer-scoped no-data when both are absent.
 */
export function bindLayerTable(
  layerData: DataRef | undefined,
  plotTable: ColumnTable | null,
  layerIndex: number,
  spec: PortableSpec,
  options: RunOptions,
): ColumnTable {
  if (layerData !== undefined) {
    return resolveDataRef(layerData, spec, options, `/layers/${layerIndex}/data`);
  }
  if (plotTable !== null) return plotTable;
  throw new PipelineError(
    "no-data",
    `/layers/${layerIndex}`,
    `Layer ${layerIndex} has no data. Provide layer.data ({values}, {columns}, or {name}) or plot-level data.`,
  );
}

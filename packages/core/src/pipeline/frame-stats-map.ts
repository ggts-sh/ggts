/**
 * geom_map frame expansion (#808): join value rows to fortified map vertices.
 *
 * Values table (layer data) carries map_id + styles (fill/color/...).
 * Map table (params.map) carries coordinates (long/lat or x/y) + join key
 * (params.mapId default "region", then "id") and optional multipoly `group`.
 *
 * Fortified map table + byKey index are memoized per LayerBinding for the run
 * so faceted panels do not rebuild the map join (#910).
 *
 * Not yet on statLayerFrame (#1077): join expansion is a different shape.
 */
import type { DataRef, PortableSpec } from "@ggts-sh/spec";

import { encodeKey } from "../scales/state.js";
import { ColumnTable, type CellValue } from "../table.js";

import { emptyFrameExtras } from "./frame-helpers.js";
import type { LayerBinding, LayerFrame, PipelineWarning } from "./types.js";
import { PipelineError } from "./types.js";

type Datasets = PortableSpec["datasets"];

/** Fortified map join index shared across facet panels for one map layer. */
export type MapJoinIndex = {
  readonly mapX: readonly CellValue[];
  readonly mapY: readonly CellValue[];
  readonly mapGroups: readonly CellValue[] | null;
  readonly byKey: ReadonlyMap<string, readonly number[]>;
  /** Emit map-region-missing at most once per layer per run. */
  missingWarned: boolean;
};

/** Run-scoped cache: LayerBinding lives for one pipeline run only. */
const mapJoinByBinding = new WeakMap<LayerBinding, MapJoinIndex>();

function tableFromDataRef(ref: DataRef, datasets: Datasets | undefined, path: string): ColumnTable {
  if ("values" in ref) return ColumnTable.fromRows(ref.values);
  if ("columns" in ref) return ColumnTable.fromColumns(ref.columns);
  const name = ref.name;
  const fromSpec = datasets?.[name];
  if (fromSpec !== undefined) {
    if (Array.isArray(fromSpec)) return ColumnTable.fromRows(fromSpec);
    if ("values" in fromSpec) return ColumnTable.fromRows(fromSpec.values);
    if ("columns" in fromSpec) return ColumnTable.fromColumns(fromSpec.columns);
  }
  throw new PipelineError(
    "unknown-dataset",
    path,
    `Unknown map dataset "${name}". Provide params.map inline or register it in spec.datasets.`,
  );
}

function pickCoordFields(map: ColumnTable): { x: string; y: string } {
  if (map.has("long") && map.has("lat")) return { x: "long", y: "lat" };
  if (map.has("x") && map.has("y")) return { x: "x", y: "y" };
  throw new PipelineError(
    "map-coords-missing",
    "/params/map",
    'Map data must include coordinate columns "long"+"lat" or "x"+"y".',
  );
}

function pickMapIdColumn(map: ColumnTable, preferred: string | undefined): string {
  if (preferred !== undefined && preferred !== "") {
    if (!map.has(preferred)) {
      throw new PipelineError(
        "map-id-column-missing",
        "/params/mapId",
        `Map data has no join column "${preferred}" (params.mapId).`,
      );
    }
    return preferred;
  }
  if (map.has("region")) return "region";
  if (map.has("id")) return "id";
  throw new PipelineError(
    "map-id-column-missing",
    "/params/mapId",
    'Map data must include a join column (params.mapId, or default "region" / "id").',
  );
}

function styleColumn(
  table: ColumnTable,
  field: string | null,
  valueRows: readonly number[],
): readonly CellValue[] | null {
  if (field === null) return null;
  const col = table.column(field);
  return valueRows.map((row) => col[row]!);
}

/**
 * Resolve (or build once) the fortified map table + join index for a layer.
 * Exported for unit tests that assert once-per-binding memoization (#910).
 */
export function resolveMapJoinIndex(
  binding: LayerBinding,
  datasets: Datasets | undefined,
): MapJoinIndex {
  const cached = mapJoinByBinding.get(binding);
  if (cached !== undefined) return cached;

  const { layer, index } = binding;
  const params = (layer.params ?? {}) as {
    map?: DataRef;
    mapId?: string;
  };
  if (params.map === undefined) {
    throw new PipelineError(
      "map-data-required",
      `/layers/${index}/params/map`,
      "geom_map requires params.map (a DataRef: { values }, { columns }, or { name }).",
    );
  }

  const mapTable = tableFromDataRef(params.map, datasets, `/layers/${index}/params/map`);
  const coords = pickCoordFields(mapTable);
  const mapKeyCol = pickMapIdColumn(mapTable, params.mapId);
  const mapHasGroup = mapTable.has("group");
  const mapX = mapTable.column(coords.x);
  const mapY = mapTable.column(coords.y);
  const mapKeys = mapTable.column(mapKeyCol);
  const mapGroups = mapHasGroup ? mapTable.column("group") : null;

  const byKey = new Map<string, number[]>();
  for (let i = 0; i < mapTable.rowCount; i++) {
    const key = encodeKey(mapKeys[i]!);
    let list = byKey.get(key);
    if (list === undefined) {
      list = [];
      byKey.set(key, list);
    }
    list.push(i);
  }

  const joinIndex: MapJoinIndex = {
    mapX,
    mapY,
    mapGroups,
    byKey,
    missingWarned: false,
  };
  mapJoinByBinding.set(binding, joinIndex);
  return joinIndex;
}

export function buildMapFrame(
  binding: LayerBinding,
  table: ColumnTable,
  groups: readonly number[],
  warnings: PipelineWarning[],
  datasets?: Datasets,
): LayerFrame {
  const { index } = binding;
  const mapIdField = binding.mapIdField;
  if (mapIdField === null) {
    throw new PipelineError(
      "missing-channel",
      `/layers/${index}/aes/map_id`,
      'The map geom requires a "map_id" channel joining value rows to the map.',
    );
  }

  const join = resolveMapJoinIndex(binding, datasets);
  const { mapX, mapY, mapGroups, byKey } = join;

  const valueIds = table.column(mapIdField);
  const outX: number[] = [];
  const outY: number[] = [];
  const outGroups: number[] = [];
  const outRowIndex: number[] = [];
  const valueRows: number[] = [];

  let ringId = 0;
  let missing = 0;
  for (let v = 0; v < table.rowCount; v++) {
    const verts = byKey.get(encodeKey(valueIds[v]!));
    if (verts === undefined || verts.length === 0) {
      missing++;
      continue;
    }

    const rings = new Map<string, number[]>();
    for (const vi of verts) {
      const rg = mapGroups === null ? "0" : encodeKey(mapGroups[vi]!);
      let list = rings.get(rg);
      if (list === undefined) {
        list = [];
        rings.set(rg, list);
      }
      list.push(vi);
    }

    for (const ring of rings.values()) {
      if (ring.length < 2) continue;
      const g = ringId++;
      for (const vi of ring) {
        const xv = mapX[vi]!;
        const yv = mapY[vi]!;
        if (
          typeof xv !== "number" ||
          typeof yv !== "number" ||
          !Number.isFinite(xv) ||
          !Number.isFinite(yv)
        ) {
          continue;
        }
        outX.push(xv);
        outY.push(yv);
        outGroups.push(g);
        outRowIndex.push(v);
        valueRows.push(v);
      }
    }
  }

  if (missing > 0 && !join.missingWarned) {
    join.missingWarned = true;
    warnings.push({
      code: "map-region-missing",
      message: `Layer ${index} (map): ${missing} value row(s) had no matching map region and were dropped.`,
    });
  }

  // silence unused groups (map assigns its own ring groups)
  void groups;

  return {
    binding,
    table,
    n: outX.length,
    xValues: null,
    xNumeric: Float64Array.from(outX),
    yValues: null,
    yNumeric: Float64Array.from(outY),
    groups: outGroups,
    inputGroups: groups,
    inputSourceRows: null,
    rowIndex: Uint32Array.from(outRowIndex),
    colorValues: styleColumn(table, binding.color.field, valueRows),
    fillValues: styleColumn(table, binding.fill.field, valueRows),
    sizeValues: styleColumn(table, binding.size.field, valueRows),
    linewidthValues: styleColumn(table, binding.linewidth.field, valueRows),
    alphaValues: styleColumn(table, binding.alpha.field, valueRows),
    shapeValues: styleColumn(table, binding.shape.field, valueRows),
    linetypeValues: styleColumn(table, binding.linetype.field, valueRows),
    labelValues: styleColumn(table, binding.labelField, valueRows),
    ...emptyFrameExtras(),
  };
}

/**
 * Peer x domains for stat_function when params.xlim is omitted.
 * Union continuous x extents from non-function layers on the same panel tables.
 */
import { finiteExtent } from "../scales/train.js";
import type { ColumnTable } from "../table.js";

import { positionColumn } from "./temporal-position.js";
import type { LayerBinding } from "./types.js";

function isFunctionStat(binding: LayerBinding): boolean {
  return binding.layer.stat === "function" || binding.layer.geom === "function";
}

export function computeFunctionPeerDomains(
  bindings: readonly LayerBinding[],
  tables: readonly ColumnTable[],
): Array<[number, number] | undefined> {
  const hasFunctionLayer = bindings.some((binding) => isFunctionStat(binding));
  // Union of all non-function continuous x extents (shared panel domain proxy).
  let unionLo = Number.POSITIVE_INFINITY;
  let unionHi = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < bindings.length; index++) {
    const binding = bindings[index]!;
    if (isFunctionStat(binding)) continue;
    if (binding.xField === null) continue;
    const table = tables[index] ?? tables[0];
    if (table === undefined || !table.has(binding.xField)) continue;
    // Prepare raw numeric views before custom stat frames can run. Functions
    // evaluate in raw x units and forward their grid through xTransform later.
    const values = positionColumn(table, binding.xField, binding.xConversion);
    const extent = hasFunctionLayer ? finiteExtent([values]) : null;
    if (extent === null) continue;
    unionLo = Math.min(unionLo, extent[0]);
    unionHi = Math.max(unionHi, extent[1]);
  }
  const peer: [number, number] | undefined = unionLo <= unionHi ? [unionLo, unionHi] : undefined;

  return bindings.map((binding) => (isFunctionStat(binding) ? peer : undefined));
}

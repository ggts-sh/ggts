/** Collect mapped style values across panel frames and source catalogs. */
import type { StyleAesthetic } from "@ggts-sh/spec";

import { encodeKey } from "../scales/state.js";
import type { CellValue, ColumnTable } from "../table.js";

import { styleFrameValues } from "./geometry-style.js";
import type { LayerBinding, LayerFrame } from "./types.js";

function bindingOf(binding: LayerBinding, aesthetic: StyleAesthetic) {
  return binding[aesthetic];
}

/**
 * Catalog walk for one mapped column. One encodeKey per row (not two —
 * indexableKeys and the catalog dedupe keyed separately); this walk
 * dominates mapped-style profiles.
 */
function walkCatalogColumn(
  column: readonly CellValue[],
  indexableKeys: Set<string>,
  seen: Set<string>,
  catalog: CellValue[],
): void {
  for (let i = 0; i < column.length; i++) {
    const key = encodeKey(column[i]!);
    indexableKeys.add(key);
    if (!seen.has(key)) {
      seen.add(key);
      catalog.push(column[i]!);
    }
  }
}

function frameContributions(
  frames: readonly LayerFrame[],
  aesthetic: StyleAesthetic,
): { contributions: number; soleRun: readonly CellValue[] | null } {
  let contributions = 0;
  let soleRun: readonly CellValue[] | null = null;
  for (const frame of frames) {
    const binding = bindingOf(frame.binding, aesthetic);
    const mapped = styleFrameValues(frame, aesthetic);
    if ((binding.field !== null || binding.statColumn !== null) && mapped !== null) {
      contributions++;
      soleRun = mapped instanceof Float64Array ? null : mapped;
    }
    if (binding.scaledConstant !== null) contributions++;
  }
  return { contributions, soleRun };
}

function shouldWalkCatalog(
  mode: "always" | "auto" | "never",
  bindings: readonly LayerBinding[],
  aesthetic: StyleAesthetic,
  sourceTable: ColumnTable,
  anyDiscrete: boolean,
): boolean {
  if (mode === "never") return false;
  if (mode === "always") return true;
  for (const binding of bindings) {
    const mapped = bindingOf(binding, aesthetic);
    const catalogTable = binding.sourceTable ?? sourceTable;
    if (
      (mapped.field !== null &&
        catalogTable.has(mapped.field) &&
        catalogTable.discreteness(mapped.field) === "discrete") ||
      mapped.scaledConstant !== null
    )
      return true;
  }
  return anyDiscrete;
}

function collectFrameStyleValues(input: {
  aesthetic: StyleAesthetic;
  frames: readonly LayerFrame[];
  table: ColumnTable;
  contributions: number;
  soleRun: readonly CellValue[] | null;
}): {
  values: CellValue[];
  anyField: boolean;
  anyDiscrete: boolean;
  anyIndexable: boolean;
  indexableKeys: Set<string>;
  annotationConstants: CellValue[];
} {
  const { aesthetic, frames, table, contributions, soleRun } = input;
  const values: CellValue[] = [];
  let anyField = false;
  let anyDiscrete = false;
  let anyIndexable = false;
  const indexableKeys = new Set<string>();
  const annotationConstants: CellValue[] = [];
  for (const frame of frames) {
    const binding = bindingOf(frame.binding, aesthetic);
    const mapped = styleFrameValues(frame, aesthetic);
    if ((binding.field !== null || binding.statColumn !== null) && mapped !== null) {
      anyField = true;
      const fieldTable = frame.binding.sourceTable ?? table;
      if (
        binding.field !== null &&
        fieldTable.has(binding.field) &&
        fieldTable.discreteness(binding.field) === "discrete"
      ) {
        anyDiscrete = true;
      }
      if (binding.field !== null) anyIndexable = true;
      if (contributions !== 1 || soleRun === null) {
        for (const v of mapped) values.push(v);
      }
    }
    if (binding.scaledConstant !== null) {
      anyField = true;
      anyDiscrete = true;
      if (frame.n > 0) anyIndexable = true;
      values.push(binding.scaledConstant);
    }
    if (binding.statColumn !== null) anyField = true;
  }
  return { values, anyField, anyDiscrete, anyIndexable, indexableKeys, annotationConstants };
}

function collectCatalogValues(input: {
  aesthetic: StyleAesthetic;
  bindings: readonly LayerBinding[];
  sourceTable: ColumnTable;
  walkCatalog: boolean;
  indexableKeys: Set<string>;
  catalog: CellValue[];
  anyField: boolean;
  anyDiscrete: boolean;
  anyIndexable: boolean;
  annotationConstants: CellValue[];
}): { anyField: boolean; anyDiscrete: boolean; anyIndexable: boolean } {
  const {
    aesthetic,
    bindings,
    sourceTable,
    walkCatalog,
    indexableKeys,
    catalog,
    anyField: initialAnyField,
    anyDiscrete: initialAnyDiscrete,
    anyIndexable: initialAnyIndexable,
    annotationConstants,
  } = input;
  let anyField = initialAnyField;
  let anyDiscrete = initialAnyDiscrete;
  let anyIndexable = initialAnyIndexable;
  const seen = new Set<string>();
  const add = (value: CellValue) => {
    const key = encodeKey(value);
    if (seen.has(key)) return;
    seen.add(key);
    catalog.push(value);
  };
  for (const binding of bindings) {
    const mapped = bindingOf(binding, aesthetic);
    const catalogTable = binding.sourceTable ?? sourceTable;
    if (mapped.field !== null && catalogTable.has(mapped.field)) {
      anyField = true;
      anyIndexable = true;
      if (catalogTable.discreteness(mapped.field) === "discrete") anyDiscrete = true;
      if (walkCatalog)
        walkCatalogColumn(catalogTable.column(mapped.field), indexableKeys, seen, catalog);
    }
    if (mapped.scaledConstant !== null) {
      if (binding.ruleForm === "annotation") annotationConstants.push(mapped.scaledConstant);
      else {
        anyIndexable = true;
        indexableKeys.add(encodeKey(mapped.scaledConstant));
      }
      if (walkCatalog) add(mapped.scaledConstant);
    }
  }
  return { anyField, anyDiscrete, anyIndexable };
}

export function collectStyleValues(input: {
  aesthetic: StyleAesthetic;
  frames: readonly LayerFrame[];
  bindings: readonly LayerBinding[];
  table: ColumnTable;
  sourceTable: ColumnTable;
  /**
   * Whether the source catalog (a full-column dedupe walk per mapped field)
   * is needed at all. Sequential/binned/identity resolutions never read the
   * catalog, so the caller passes "never" when the scale type is explicitly
   * continuous and "auto" to let this walk decide from field discreteness
   * metadata. "always" preserves the historical walk.
   */
  catalogMode: "always" | "auto" | "never";
}): {
  values: readonly CellValue[];
  catalog: CellValue[];
  anyField: boolean;
  anyDiscrete: boolean;
  anyIndexable: boolean;
  nonInteractiveValues: CellValue[];
} {
  const { aesthetic, frames, bindings, table, sourceTable, catalogMode } = input;
  // Sole-contributor fast path: a single mapped frame run (the common case)
  // aliases the frame's values array instead of paying one push per row.
  // Consumers never mutate `values` (missing-count filter, scale training).
  // Float64Array frame columns are not aliasable (readonly CellValue[]
  // return type) and keep the historical copy.
  const { contributions, soleRun } = frameContributions(frames, aesthetic);
  const frameValues = collectFrameStyleValues({
    aesthetic,
    frames,
    table,
    contributions,
    soleRun,
  });
  let { anyField, anyDiscrete, anyIndexable } = frameValues;
  const { values, indexableKeys, annotationConstants } = frameValues;
  const catalog: CellValue[] = [];
  // Metadata pass: flags and the walk decision come from field discreteness,
  // never from row data, so they are computed before (and independently of)
  // the full-column catalog walk.
  const walkCatalog = shouldWalkCatalog(catalogMode, bindings, aesthetic, sourceTable, anyDiscrete);
  ({ anyField, anyDiscrete, anyIndexable } = collectCatalogValues({
    aesthetic,
    bindings,
    sourceTable,
    walkCatalog,
    indexableKeys,
    catalog,
    anyField,
    anyDiscrete,
    anyIndexable,
    annotationConstants,
  }));
  // In a mixed legend (a data-backed mapping makes the whole scale interactive
  // while a rowless annotation constant shares it), the annotation-only value —
  // one that indexes no rendered mark — would still become a hover/clickable
  // legend entry resolving an empty key bucket. Exclude such values from the
  // legend domain; the scale still trains on them (catalog) so the annotation
  // mark renders. In the all-annotation case (anyIndexable false) the legend is
  // already non-interactive, so nothing is excluded and the entry is preserved.
  const nonInteractiveValues = anyIndexable
    ? annotationConstants.filter((value) => !indexableKeys.has(encodeKey(value)))
    : [];
  return {
    values: contributions === 1 && soleRun !== null ? soleRun : values,
    catalog,
    anyField,
    anyDiscrete,
    anyIndexable,
    nonInteractiveValues,
  };
}

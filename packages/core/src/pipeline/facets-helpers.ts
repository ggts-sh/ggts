/**
 * Shared helpers for facet partition (field resolution, value order, row match).
 */
import { didYouMean } from "@ggts-sh/spec";
import type { FacetFieldRef } from "@ggts-sh/spec";

import { encodeKey } from "../scales/state.js";
import { bandKey } from "../scales/train.js";
import type { CellValue } from "../table.js";
import { ColumnTable } from "../table.js";

import type { PipelineWarning } from "./types.js";
import { PipelineError } from "./types.js";

export function facetField(
  ref: FacetFieldRef | undefined,
  key: "wrap" | "rows" | "cols",
  table: ColumnTable,
): string | null {
  if (ref === undefined) return null;
  if (!table.has(ref.field)) {
    const suggestion = didYouMean(ref.field, table.fields);
    throw new PipelineError(
      "unknown-field",
      `/facet/${key}`,
      `Unknown facet field "${ref.field}" (available: ${table.fields.join(", ") || "none"}).` +
        (suggestion === undefined ? "" : ` Did you mean "${suggestion}"?`),
    );
  }
  return ref.field;
}

/**
 * Authoring key for facet label maps: string form of DomainValue
 * (`"null"` for null; `String(value)` otherwise).
 */
function facetLabelKey(value: CellValue): string {
  if (value === null) return "null";
  return String(value);
}

/** Display strip text: authored labels map, else bandKey(value). */
export function facetDisplayLabel(
  value: CellValue,
  labels: Readonly<Record<string, string>> | undefined,
): string {
  if (labels !== undefined) {
    const key = facetLabelKey(value);
    if (Object.prototype.hasOwnProperty.call(labels, key)) return labels[key]!;
  }
  return bandKey(value);
}

export interface FacetValuesOptions {
  /** Closed explicit order; when set, only these panels exist (empty allowed). */
  levels?: readonly (string | number | boolean | null)[];
  /** Spec path for diagnostics (e.g. `/facet/wrap/levels`). */
  path?: string;
  warnings?: PipelineWarning[];
}

/**
 * Distinct values of a facet column in panel order.
 *
 * Default (no levels): ascending — numeric for quantitative/temporal fields,
 * lexicographic for the rest — with null last (ggplot2's NA panel).
 *
 * With closed `levels`: authored order wins; levels absent from data still
 * produce empty panels; data values omitted from levels are dropped and
 * diagnosed (`facet-levels-missing` / `facet-levels-unknown`).
 */
export function facetValues(
  table: ColumnTable,
  field: string,
  options: FacetValuesOptions = {},
): CellValue[] {
  const { levels, path = `/facet`, warnings } = options;
  const observed = new Map<string, CellValue>();
  for (const v of table.column(field)) {
    const key = encodeKey(v);
    if (!observed.has(key)) observed.set(key, v);
  }

  if (levels !== undefined) {
    const ordered: CellValue[] = [];
    const levelKeys = new Set<string>();
    for (const level of levels) {
      const key = encodeKey(level);
      if (levelKeys.has(key)) continue;
      levelKeys.add(key);
      ordered.push(level);
    }
    if (warnings !== undefined) {
      const missing = ordered
        .filter((level) => !observed.has(encodeKey(level)))
        .map((level) => bandKey(level));
      const unknown = [...observed.entries()]
        .filter(([key]) => !levelKeys.has(key))
        .map(([, value]) => bandKey(value));
      if (missing.length > 0) {
        warnings.push({
          code: "facet-levels-missing",
          message:
            `Facet field "${field}" lists levels absent from the data (${missing.join(", ")}); ` +
            `empty panels are kept at path ${path}.`,
        });
      }
      if (unknown.length > 0) {
        warnings.push({
          code: "facet-levels-unknown",
          message:
            `Facet field "${field}" observed values omitted from closed levels (${unknown.join(", ")}); ` +
            `those rows are excluded from every panel at path ${path}.`,
        });
      }
    }
    return ordered;
  }

  const values = [...observed.values()];
  const numeric = table.fieldType(field) !== "nominal";
  const numericByKey = new Map<string, number>();
  if (numeric) {
    const semantic = table.numeric(field);
    const column = table.column(field);
    for (let index = 0; index < column.length; index++) {
      const key = encodeKey(column[index]!);
      if (!numericByKey.has(key)) numericByKey.set(key, semantic[index]!);
    }
  }
  // Decorate-sort-undecorate: precompute all three comparator keys once so
  // the O(k log k) sort never re-encodes or re-bandKeys a level (#1312).
  type Decorated = {
    value: CellValue;
    enc: string;
    band: string;
    num: number;
  };
  const decorated: Decorated[] = values.map((value) => {
    const enc = encodeKey(value);
    return {
      value,
      enc,
      // bandKey only on the nominal tier (matches pre-hoist short-circuit).
      // Numeric/temporal never read `band`; calling bandKey on Invalid Date
      // would throw via toISOString (Devin #1386).
      band: numeric || value === null ? "" : bandKey(value),
      num: numeric ? (numericByKey.get(enc) ?? NaN) : 0,
    };
  });
  decorated.sort((a, b) => {
    if (a.value === null) return b.value === null ? 0 : 1;
    if (b.value === null) return -1;
    if (numeric) return a.num - b.num;
    if (a.band === b.band) return a.enc.localeCompare(b.enc, "en");
    return a.band < b.band ? -1 : a.band > b.band ? 1 : 0;
  });
  return decorated.map((d) => d.value);
}

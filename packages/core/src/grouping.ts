/**
 * Group derivation with ggplot2 parity — graduated from the M0a-5 spike
 * (decision 0005; the R-generated fixtures in tests/fixtures/grouping are the
 * executable spec).
 *
 * Runs after data binding and scale-type inference, per facet panel (one
 * panel in M0c), before stats and positions. Rules (see decision 0005):
 *
 * 1. Explicit `aes.group` wins outright: a field-mapped group groups by that
 *    column's values regardless of discreteness; a constant group yields a
 *    single group.
 * 2. Otherwise the effective group is the interaction of every *discrete*
 *    mapped aesthetic, excluding the non-grouping channels `group` and
 *    `label`. String/boolean constants join the interaction (one level —
 *    they can never split rows).
 * 3. Continuous channels never participate.
 * 4. No discrete aesthetic -> a single implicit group (ggplot2's NO_GROUP,
 *    canonicalized to "all rows in group 0", source: "none").
 * 5. Nulls form their own group level.
 * 6. Group ids are canonicalized by first occurrence in row order (0-based).
 *
 * M0c additions over the spike: channel mappings are the spec's canonical
 * ChannelValue forms — `{ stat }` channels and `null` channels never
 * participate in grouping (grouping is pre-stat by construction; normalize
 * resolves null-unset before the pipeline runs).
 */
import type { ChannelValue } from "@ggts-sh/spec";

import type { CellValue, Columns, Discreteness } from "./table.js";

/** Channel-name -> canonical channel form (a resolved layer aes). */
export type AesMapping = Readonly<Record<string, ChannelValue | undefined>>;

/** Per-field discreteness declarations (field name -> declared type). */
export type DeclaredDiscreteness = Readonly<Record<string, Discreteness>>;
export type ChannelGroupingOverrides = Readonly<
  Record<string, Readonly<{ discreteness: Discreteness; column?: readonly CellValue[] }>>
>;

export interface GroupDerivation {
  /** Canonical group id per row, renumbered by first occurrence (0-based). */
  readonly groups: readonly number[];
  readonly groupCount: number;
  /**
   * How the groups came about:
   * - "explicit": aes.group was mapped and won
   * - "derived":  interaction of discrete aesthetics
   * - "none":     no discrete aesthetic (ggplot2 NO_GROUP; single group 0)
   */
  readonly source: "explicit" | "derived" | "none";
  /** Fields whose interaction produced the groups ([] for constant group / none). */
  readonly groupedBy: readonly string[];
}

/** Channels that never participate in the discrete interaction. */
const NON_GROUPING_CHANNELS: ReadonlySet<string> = new Set([
  "group",
  "label",
  "weight",
  "sample",
  "width",
  "height",
  "xmin",
  "xmax",
  "ymin",
  "ymax",
  // Segment endpoints — plot-level aes may inherit them onto non-segment layers
  // that never consume them; they must not join the discrete interaction.
  "xend",
  "yend",
  // Spoke direction/length — same inheritance risk as xend/yend (#810).
  "angle",
  "radius",
]);

/** Distinct sentinel for null cells so null forms its own interaction level. */
const NULL_KEY = "\u0000null";
/** Unit separator between interaction components (never occurs in data keys). */
const SEP = "\u001F";

function cellKey(v: CellValue): string {
  if (v === null) return NULL_KEY;
  if (v instanceof Date) return `d${v.getTime()}`;
  return `${typeof v}${SEP}${String(v)}`;
}

function rowCount(columns: Columns): number {
  const cols = Object.values(columns);
  if (cols.length === 0) return 0;
  const n = cols[0]!.length;
  for (const c of cols) {
    if (c.length !== n) throw new Error("deriveGroups: columns have unequal lengths");
  }
  return n;
}

/** Infer a column's discreteness from its values (declaration handled by caller). */
export function inferDiscreteness(column: readonly CellValue[]): Discreteness {
  for (const v of column) {
    if (typeof v === "string" || typeof v === "boolean") return "discrete";
  }
  return "continuous";
}

function fieldDiscreteness(
  field: string,
  columns: Columns,
  declared: DeclaredDiscreteness,
): Discreteness {
  const d = declared[field];
  if (d !== undefined) return d;
  const column = columns[field];
  if (column === undefined) throw new Error(`deriveGroups: unknown field "${field}"`);
  return inferDiscreteness(column);
}

/**
 * Single-column interning without per-row key strings. A raw-value Map
 * (SameValueZero) groups strings/numbers/booleans/bigint/null exactly as
 * cellKey does — including NaN and ±0 — so the `typeof${SEP}String(v)` key
 * is only needed to tell TYPES apart within one column and to group Dates
 * by epoch ms. Homogeneous primitive columns (the common case: one string
 * group column) therefore intern directly; the first Date (or mixed
 * primitive types, which cellKey would separate) falls back to the
 * canonical key path.
 */
/**
 * Raw-value interning for one column: per-row intern ids (first-seen
 * order) plus the distinct count, or null when the column needs cellKey
 * semantics (Date epoch-ms grouping, or mixed primitive types that the
 * typeof-tagged key would separate).
 */
function internPrimitiveColumn(
  n: number,
  column: readonly CellValue[],
): { ids: Uint32Array; count: number } | null {
  const ids = new Uint32Array(n);
  const interner = new Map<CellValue, number>();
  let kind: "string" | "number" | "boolean" | "bigint" | "null" | null = null;
  for (let i = 0; i < n; i++) {
    const v = column[i]!;
    const t = typeof v;
    const vKind =
      v === null
        ? ("null" as const)
        : t === "string" || t === "number" || t === "boolean" || t === "bigint"
          ? t
          : null;
    if (vKind === null) return null; // Date (or any object): epoch-ms grouping
    if (kind === null) kind = vKind;
    else if (kind !== vKind) return null; // mixed types: cellKey separates them
    let id = interner.get(v);
    if (id === undefined) {
      id = interner.size;
      interner.set(v, id);
    }
    ids[i] = id;
  }
  return { ids, count: interner.size };
}

/** Uint32Array → number[] without Array.from(typed) (~20× slower at 30k). */
function uint32ToNumberArray(ids: Uint32Array): number[] {
  const groups: number[] = [];
  for (let i = 0; i < ids.length; i++) groups.push(ids[i]!);
  return groups;
}

function canonicalGroupsSingleColumn(
  n: number,
  column: readonly CellValue[],
): { groups: number[]; groupCount: number } | null {
  const interned = internPrimitiveColumn(n, column);
  if (interned === null) return null;
  return { groups: uint32ToNumberArray(interned.ids), groupCount: interned.count };
}

/**
 * Multi-column interaction without per-row key strings: intern each column
 * raw, then fold the per-row intern ids into one numeric key (strides =
 * per-column distinct counts). The fold preserves tuple identity exactly,
 * so first-seen group numbering matches the canonical join path; any
 * non-primitive column or an implausibly wide product falls back to the
 * canonical key path.
 */
function canonicalGroupsMultiColumn(
  n: number,
  columns: readonly (readonly CellValue[])[],
): { groups: number[]; groupCount: number } | null {
  const interned: { ids: Uint32Array; count: number }[] = [];
  let product = 1;
  for (const column of columns) {
    const one = internPrimitiveColumn(n, column);
    if (one === null) return null;
    product *= Math.max(1, one.count);
    if (product > Number.MAX_SAFE_INTEGER / Math.max(1, n)) return null;
    interned.push(one);
  }
  const groups = Array.from<number>({ length: n });
  const ids = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    let key = 0;
    for (const { ids: columnIds, count } of interned) {
      key = key * Math.max(1, count) + columnIds[i]!;
    }
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
    }
    groups[i] = id;
  }
  return { groups, groupCount: ids.size };
}

/**
 * Canonicalize row keys to group ids numbered by first occurrence.
 * `groupCount` is the Map size (O(1) after the O(R) pass) — never re-derived
 * via `Math.max(...groups)`, which re-scans R rows and can RangeError when
 * spreading large arrays into call arguments.
 */
function canonicalGroups(
  n: number,
  keyOf: (row: number) => string,
): { groups: number[]; groupCount: number } {
  const ids = new Map<string, number>();
  const groups = Array.from<number>({ length: n });
  for (let i = 0; i < n; i++) {
    const key = keyOf(i);
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
    }
    groups[i] = id;
  }
  return { groups, groupCount: ids.size };
}

export function deriveGroups(
  columns: Columns,
  aes: AesMapping,
  declaredDiscreteness: DeclaredDiscreteness = {},
  channelOverrides: ChannelGroupingOverrides = {},
): GroupDerivation {
  const n = rowCount(columns);

  // 1. Explicit aes.group override wins.
  const explicit = explicitGroupDerivation(n, columns, aes);
  if (explicit !== null) return explicit;

  // 2. Interaction of discrete mapped aesthetics.
  const { discreteColumns, constantParts } = collectDiscreteGroupingColumns(
    columns,
    aes,
    declaredDiscreteness,
    channelOverrides,
  );

  if (discreteColumns.length === 0 && constantParts.length === 0) {
    // 3. No discrete aesthetic -> ggplot2 NO_GROUP (-1): single implicit group.
    return {
      groups: Array.from({ length: n }, () => 0),
      groupCount: n === 0 ? 0 : 1,
      source: "none",
      groupedBy: [],
    };
  }

  const constantKey = constantParts.join(SEP);
  const fast =
    constantKey === ""
      ? discreteColumns.length === 1
        ? canonicalGroupsSingleColumn(n, discreteColumns[0]!.column)
        : canonicalGroupsMultiColumn(
            n,
            discreteColumns.map(({ column }) => column),
          )
      : null;
  const { groups, groupCount } =
    fast ??
    canonicalGroups(n, (i) => {
      const parts = discreteColumns.map(({ column }) => cellKey(column[i]!));
      if (constantKey !== "") parts.push(constantKey);
      return parts.join(SEP);
    });
  return {
    groups,
    groupCount,
    source: "derived",
    groupedBy: discreteColumns.map((c) => c.field),
  };
}

function explicitGroupDerivation(
  n: number,
  columns: Columns,
  aes: AesMapping,
): GroupDerivation | null {
  const groupChannel = aes["group"];
  if (groupChannel === undefined || groupChannel === null || "stat" in groupChannel) {
    return null;
  }
  if ("value" in groupChannel) {
    // Constant group (e.g. ggplot2's aes(group = 1)): a single group.
    return {
      groups: Array.from({ length: n }, () => 0),
      groupCount: n === 0 ? 0 : 1,
      source: "explicit",
      groupedBy: [],
    };
  }
  const column = columns[groupChannel.field];
  if (column === undefined) {
    throw new Error(`deriveGroups: unknown field "${groupChannel.field}" in aes.group`);
  }
  // Group by value regardless of discreteness (matches ggplot2's id()).
  const { groups, groupCount } =
    canonicalGroupsSingleColumn(n, column) ?? canonicalGroups(n, (i) => cellKey(column[i]!));
  return {
    groups,
    groupCount,
    source: "explicit",
    groupedBy: [groupChannel.field],
  };
}

function collectDiscreteGroupingColumns(
  columns: Columns,
  aes: AesMapping,
  declaredDiscreteness: DeclaredDiscreteness,
  channelOverrides: ChannelGroupingOverrides,
): {
  discreteColumns: { field: string; column: readonly CellValue[] }[];
  constantParts: string[];
} {
  const discreteColumns: { field: string; column: readonly CellValue[] }[] = [];
  const constantParts: string[] = [];
  for (const [channel, mapping] of Object.entries(aes)) {
    if (mapping === undefined || mapping === null) continue;
    if (NON_GROUPING_CHANNELS.has(channel)) continue;
    if ("stat" in mapping) continue; // after-stat channels are pre-stat invisible
    if ("value" in mapping) {
      // A literal string/boolean constant is a discrete column of one value in
      // ggplot2; it joins the interaction but can never split rows apart.
      if (typeof mapping.value === "string" || typeof mapping.value === "boolean") {
        constantParts.push(cellKey(mapping.value));
      }
      continue;
    }
    const override = channelOverrides[channel];
    const discreteness =
      override?.discreteness ?? fieldDiscreteness(mapping.field, columns, declaredDiscreteness);
    if (discreteness === "discrete") {
      discreteColumns.push({
        field: mapping.field,
        column: override?.column ?? columns[mapping.field]!,
      });
    }
  }
  return { discreteColumns, constantParts };
}

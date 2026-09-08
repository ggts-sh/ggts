/**
 * Resolve durable row identity for interaction (selection, legend focus, pin
 * rebind, linked controllers).
 *
 * Plot authors should not need a custom identity for ordinary charts:
 * 1. Interaction-surface identity (Inspect / Select / controller) when set.
 * 2. Deprecated GGPlot `key` dual-read (until removal).
 * 3. Else if plot data exposes a PropertyKey-valued `id` column → use `"id"`.
 * 4. Else use the row index (order-stable only — not reorder-safe).
 *
 * Index identity is enough for single-plot legend focus / inspect / local
 * selection. Custom durable identity across reorders or non-`id` natural keys
 * belongs on Inspect / Select / createPlotInteraction — not plot grammar.
 */
import type { CellValue } from "@ggts-sh/core";

export type DatumKey =
  | PropertyKey
  | ((row: Record<string, CellValue>, index: number) => PropertyKey);

/**
 * Explicit identity sources. Prefer interaction surfaces over the deprecated
 * plot-level `key` prop. First defined wins in this order.
 */
export type ExplicitDatumKeySources = {
  /** `<Inspect identity=…>` or `inspect={{ identity: … }}`. */
  readonly inspect?: DatumKey;
  /** `select={{ type, identity: … }}`. */
  readonly select?: DatumKey;
  /** `createPlotInteraction({ identity })` when bound via `interaction=`. */
  readonly controller?: DatumKey;
  /** Deprecated GGPlot `key` dual-read (prefer interaction-surface identity). */
  readonly legacy?: DatumKey;
};

export type ResolveDatumKeyInput = {
  /**
   * Already-picked explicit identity (from {@link pickExplicitDatumKey} or a
   * single override). Wins over auto `id` / row-index defaults.
   */
  readonly explicit?: DatumKey;
  /** Plot data input (row array, DataRef, or bare columns map). */
  readonly data?: unknown;
};

/**
 * Pick the first defined identity from interaction surfaces, then legacy
 * GGPlot `key`. Returns `undefined` when no surface supplies an override.
 */
export function pickExplicitDatumKey(sources: ExplicitDatumKeySources): DatumKey | undefined {
  if (sources.inspect !== undefined) return sources.inspect;
  if (sources.select !== undefined) return sources.select;
  if (sources.controller !== undefined) return sources.controller;
  if (sources.legacy !== undefined) return sources.legacy;
  return undefined;
}

/** Read `identity` from object-form `select` (string shorthand has none). */
export function identityFromSelectInput(
  input: false | string | { readonly identity?: DatumKey } | undefined,
): DatumKey | undefined {
  if (input === undefined || input === false || typeof input === "string") return undefined;
  return input.identity;
}

/** Row-index identity — default when no `id` column and no explicit key. */
function rowIndexDatumKey(_row: Record<string, CellValue>, index: number): PropertyKey {
  return index;
}

/** True when `value` is a legal PropertyKey for semantic row identity. */
function isPropertyKeyIdentity(value: unknown): value is PropertyKey {
  return typeof value === "string" || typeof value === "number" || typeof value === "symbol";
}

/**
 * Detect a usable `id` column on plot data (first cell must be PropertyKey).
 * Does not scan every row for uniqueness — invalid/duplicate keys still emit
 * INTERACTION_* key diagnostics at resolve time.
 */
function dataHasIdIdentityColumn(data: unknown): boolean {
  if (data === null || data === undefined) return false;

  if (Array.isArray(data)) {
    if (data.length === 0) return false;
    const row: unknown = data[0];
    if (row === null || typeof row !== "object" || Array.isArray(row)) return false;
    return isPropertyKeyIdentity((row as Record<string, unknown>)["id"]);
  }

  if (typeof data !== "object") return false;
  const record = data as Record<string, unknown>;

  // DataRef { values: Row[] }
  if (Array.isArray(record["values"])) return dataHasIdIdentityColumn(record["values"]);

  // DataRef { columns: { id: [...] } } or bare column map with id array
  const columns =
    record["columns"] !== null &&
    typeof record["columns"] === "object" &&
    !Array.isArray(record["columns"])
      ? (record["columns"] as Record<string, unknown>)
      : record;
  const idColumn = columns["id"];
  if (!Array.isArray(idColumn) || idColumn.length === 0) return false;
  return isPropertyKeyIdentity(idColumn[0]);
}

/**
 * Resolve the datum-key used by the plot engine.
 * Always returns a key strategy — never `undefined`.
 */
export function resolveDatumKey(input: ResolveDatumKeyInput): DatumKey {
  if (input.explicit !== undefined) return input.explicit;
  if (dataHasIdIdentityColumn(input.data)) return "id";
  return rowIndexDatumKey;
}

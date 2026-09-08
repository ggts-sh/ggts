import type { CellValue } from "@ggts-sh/core";

export type DatumKey =
  | PropertyKey
  | ((row: Record<string, CellValue>, index: number) => PropertyKey);

export type ExplicitDatumKeySources = {
  readonly inspect?: DatumKey;
  readonly select?: DatumKey;
  readonly controller?: DatumKey;
  readonly plot?: DatumKey;
  readonly legacy?: DatumKey;
};

export function pickExplicitDatumKey(sources: ExplicitDatumKeySources): DatumKey | undefined {
  if (sources.inspect !== undefined) return sources.inspect;
  if (sources.select !== undefined) return sources.select;
  if (sources.controller !== undefined) return sources.controller;
  if (sources.plot !== undefined) return sources.plot;
  if (sources.legacy !== undefined) return sources.legacy;
  return undefined;
}

export function identityFromSelectInput(
  input: false | string | { readonly identity?: DatumKey } | undefined,
): DatumKey | undefined {
  if (input === undefined || input === false || typeof input === "string") return undefined;
  return input.identity;
}

export function identityFromInspectInput(
  input: boolean | { readonly identity?: DatumKey } | undefined,
): DatumKey | undefined {
  if (input === undefined || input === false || input === true) return undefined;
  return input.identity;
}

function isPropertyKeyIdentity(value: unknown): value is PropertyKey {
  return typeof value === "string" || typeof value === "number" || typeof value === "symbol";
}

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
  if (Array.isArray(record["values"])) return dataHasIdIdentityColumn(record["values"]);
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

export function resolveDatumKey(input: {
  readonly explicit?: DatumKey;
  readonly data?: unknown;
}): DatumKey {
  if (input.explicit !== undefined) return input.explicit;
  if (dataHasIdIdentityColumn(input.data)) return "id";
  return (_row, index) => index;
}

export function applyDatumKey(
  key: DatumKey,
  row: Record<string, CellValue> | null,
  index: number,
): PropertyKey {
  if (typeof key === "function") {
    if (row === null) return index;
    return key(row, index);
  }
  if (row !== null) {
    const value = row[String(key)];
    if (isPropertyKeyIdentity(value)) return value;
  }
  return index;
}

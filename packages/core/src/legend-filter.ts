import { encodeKey, type CellValue } from "./index.js";

/** Build encodeKey membership once per clause for O(1) visibility checks. */
export function legendFilterValueKeys(values: readonly CellValue[]): ReadonlySet<string> {
  return new Set(values.map((value) => encodeKey(value)));
}

/** O(1) membership against a prebuilt clause key set. */
export function isLegendValueKeyVisible(
  valueKeys: ReadonlySet<string>,
  value: CellValue,
  mode: "exclude" | "include",
): boolean {
  const present = valueKeys.has(encodeKey(value));
  return mode === "include" ? present : !present;
}

/** Single-shot visibility (builds a Set). Prefer `isLegendValueKeyVisible` in loops. */
export function isLegendValueVisible(
  values: readonly CellValue[],
  value: CellValue,
  mode: "exclude" | "include",
): boolean {
  return isLegendValueKeyVisible(legendFilterValueKeys(values), value, mode);
}

export function reconcileLegendFilterValues(
  values: readonly CellValue[],
  catalog: readonly CellValue[],
): readonly CellValue[] {
  const catalogKeys = legendFilterValueKeys(catalog);
  return Object.freeze(values.filter((value) => catalogKeys.has(encodeKey(value))));
}

/** Return the next clause value set for one accessible "Show category" toggle. */
export function nextLegendFilterValues(
  current: readonly CellValue[],
  value: CellValue,
  catalog: readonly CellValue[],
  mode: "exclude" | "include",
  multiple: boolean,
): readonly CellValue[] {
  const key = encodeKey(value);
  if (!multiple) {
    return Object.freeze(
      mode === "include" ? [value] : catalog.filter((candidate) => encodeKey(candidate) !== key),
    );
  }

  const baseline = current;
  const found = baseline.some((candidate) => encodeKey(candidate) === key);
  return Object.freeze(
    found ? baseline.filter((candidate) => encodeKey(candidate) !== key) : [...baseline, value],
  );
}

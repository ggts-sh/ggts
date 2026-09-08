/**
 * Pure key / scope / domain / interval canonicalization and equality helpers
 * for createPlotInteraction. No Svelte runes — safe to share and unit-test
 * independently of the controller factory.
 */
import type {
  PlotInteractionScope,
  ReadonlyIntervalDomains,
  ScopedInteractionDomain,
  ScopedInteractionInterval,
  ScopedInteractionKeys,
} from "./interaction-types.js";

/** Mutation scope: bare keys string or full PlotInteractionScope. */
export type KeyScope = string | PlotInteractionScope;

export function assertScope(value: string, channel: string): void {
  if (value.length === 0)
    throw new TypeError(`Interaction ${channel} scope must be a non-empty string.`);
}

export function normalizedScope(scope: KeyScope): PlotInteractionScope {
  const value = typeof scope === "string" ? { keys: scope } : scope;
  assertScope(value.keys, "keys");
  if (value.x !== undefined) assertScope(value.x, "x");
  if (value.y !== undefined) assertScope(value.y, "y");
  if (value.intervals !== undefined) assertScope(value.intervals, "intervals");
  return Object.freeze({
    keys: value.keys,
    ...(value.x !== undefined && { x: value.x }),
    ...(value.y !== undefined && { y: value.y }),
    ...(value.intervals !== undefined && { intervals: value.intervals }),
  });
}

export function keyScope(scope: KeyScope): string {
  return normalizedScope(scope).keys;
}

export function assertKey(value: unknown): asserts value is PropertyKey {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "symbol")
    throw new TypeError("Interaction keys must be strings, numbers, or symbols.");
}

function keyRank(value: PropertyKey): number {
  return typeof value === "number" ? 0 : typeof value === "string" ? 1 : 2;
}

function compareKeys(a: PropertyKey, b: PropertyKey): number {
  const rankDelta = keyRank(a) - keyRank(b);
  if (rankDelta !== 0) return rankDelta;
  if (typeof a === "number" && typeof b === "number") {
    if (Object.is(a, b)) return 0;
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return a - b;
  }
  const left = typeof a === "symbol" ? (Symbol.keyFor(a) ?? a.description ?? "") : String(a);
  const right = typeof b === "symbol" ? (Symbol.keyFor(b) ?? b.description ?? "") : String(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalKeys<Key extends PropertyKey>(
  keys: ReadonlyArray<Key>,
): ReadonlyArray<Key> {
  for (const key of keys) assertKey(key);
  return Object.freeze([...new Set(keys)].toSorted(compareKeys));
}

export function equalKeys<Key extends PropertyKey>(
  left: ReadonlyArray<Key>,
  right: ReadonlyArray<Key>,
): boolean {
  if (left.length !== right.length) return false;
  const values = new Set(right);
  return left.every((key) => values.has(key));
}

export function canonicalDomain(domain: readonly [number, number]): readonly [number, number] {
  const [first, second] = domain;
  if (!Number.isFinite(first) || !Number.isFinite(second))
    throw new TypeError("Interaction zoom domains must contain two finite numbers.");
  return Object.freeze(first <= second ? [first, second] : [second, first]);
}

function canonicalIntervalAxis(axis: ReadonlyIntervalDomains["x"]): ReadonlyIntervalDomains["x"] {
  if (axis === undefined) return undefined;
  if (axis.kind === "band") {
    if (!Array.isArray(axis.values) || axis.values.length === 0)
      throw new TypeError("Interaction band intervals must contain at least one encoded value.");
    for (const value of axis.values) {
      if (typeof value !== "string")
        throw new TypeError("Interaction band interval values must be encoded strings.");
    }
    return Object.freeze({ kind: "band", values: Object.freeze([...new Set(axis.values)]) });
  }
  // Runtime guard for untyped JS callers: a stale transient `kind:"log"` (the
  // pre-PR-3 family) is rejected here like any other unsupported kind — no
  // compat branch reinterprets it as transform:"log10".
  const kind: unknown = axis.kind;
  if (kind !== "linear" && kind !== "time") {
    throw new TypeError(
      `Interaction interval axis kind "${String(kind)}" is not supported. Use "linear" or "time" (with an optional transform), or "band".`,
    );
  }
  const domain = canonicalDomain(axis.domain);
  const transform = axis.transform ?? "identity";
  if (transform === "log10" && domain[0] <= 0)
    throw new TypeError("Interaction log10 interval domains must contain positive values.");
  if (transform === "sqrt" && domain[0] < 0)
    throw new TypeError("Interaction sqrt interval domains must contain non-negative values.");
  return Object.freeze({ kind: axis.kind, transform, domain });
}

export function canonicalIntervalDomains(
  domains: ReadonlyIntervalDomains,
): ReadonlyIntervalDomains {
  const x = canonicalIntervalAxis(domains.x);
  const y = canonicalIntervalAxis(domains.y);
  if (x === undefined && y === undefined)
    throw new TypeError("Interaction intervals must contain an x or y domain.");
  return Object.freeze({ ...(x !== undefined && { x }), ...(y !== undefined && { y }) });
}

function equalIntervalAxis(
  left: ReadonlyIntervalDomains["x"],
  right: ReadonlyIntervalDomains["x"],
): boolean {
  if (left === right) return true;
  if (left === undefined || right === undefined || left.kind !== right.kind) return false;
  if (left.kind === "band" && right.kind === "band") {
    return (
      left.values.length === right.values.length &&
      left.values.every((value, index) => value === right.values[index])
    );
  }
  if (left.kind === "band" || right.kind === "band") return false;
  if ((left.transform ?? "identity") !== (right.transform ?? "identity")) return false;
  return equalDomain(left.domain, right.domain);
}

export function equalInterval<Key extends PropertyKey>(
  left: ScopedInteractionInterval<Key> | undefined,
  right: ScopedInteractionInterval<Key>,
): boolean {
  return (
    left !== undefined &&
    left.panelId === right.panelId &&
    left.preset === right.preset &&
    equalIntervalAxis(left.domains.x, right.domains.x) &&
    equalIntervalAxis(left.domains.y, right.domains.y) &&
    equalKeys(left.keys, right.keys)
  );
}

export function equalDomain(
  left: readonly [number, number] | undefined,
  right: readonly [number, number] | undefined,
): boolean {
  return (
    left === right ||
    (left !== undefined &&
      right !== undefined &&
      Object.is(left[0], right[0]) &&
      Object.is(left[1], right[1]))
  );
}

export function sortedScopes<T>(values: Map<string, T>): Array<[string, T]> {
  return [...values].toSorted(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
}

export function scopedKeys<Key extends PropertyKey>(
  values: Map<string, ReadonlyArray<Key>>,
): ReadonlyArray<ScopedInteractionKeys<Key>> {
  return Object.freeze(sortedScopes(values).map(([scope, keys]) => Object.freeze({ scope, keys })));
}

export function scopedDomains(
  values: Map<string, readonly [number, number]>,
): ReadonlyArray<ScopedInteractionDomain> {
  return Object.freeze(
    sortedScopes(values).map(([scope, domain]) => Object.freeze({ scope, domain })),
  );
}

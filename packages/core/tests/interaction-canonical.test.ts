/**
 * Pure unit tests for controller-canonical (scope/domain/interval helpers).
 */
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "bun:test";

import {
  assertKey,
  assertScope,
  canonicalDomain,
  canonicalIntervalDomains,
  canonicalKeys,
  equalDomain,
  equalInterval,
  equalKeys,
  keyScope,
  normalizedScope,
  scopedDomains,
  scopedKeys,
  sortedScopes,
} from "../src/interaction-canonical.js";

describe("assertScope / normalizedScope / keyScope", () => {
  it("rejects empty channel scope strings", () => {
    expect(() => {
      assertScope("", "keys");
    }).toThrow(/keys scope must be a non-empty string/);
    expect(() => {
      void normalizedScope({ keys: "ok", x: "" });
    }).toThrow(/x scope must be a non-empty/);
    expect(() => {
      void keyScope("");
    }).toThrow(/keys scope must be a non-empty/);
  });

  it("freezes a full scope object", () => {
    const scope = normalizedScope({
      keys: "id",
      x: "flipper",
      y: "mass",
      intervals: "facets",
    });
    expect(Object.isFrozen(scope)).toBe(true);
    expect(scope).toEqual({
      keys: "id",
      x: "flipper",
      y: "mass",
      intervals: "facets",
    });
    expect(keyScope("penguin-id")).toBe("penguin-id");
  });
});

describe("assertKey / canonicalKeys / equalKeys", () => {
  it("rejects non-PropertyKey values", () => {
    expect(() => {
      assertKey(true);
    }).toThrow(/must be strings, numbers, or symbols/);
    expect(() => {
      void canonicalKeys(fromAny([1, null]));
    }).toThrow(/must be strings/);
  });

  it("dedups and sorts mixed key ranks (number < string < symbol)", () => {
    const sym = Symbol.for("c");
    expect(canonicalKeys([sym, "b", 2, "a", 2, "b"])).toEqual([2, "a", "b", sym]);
    // NaN ranks after other numbers; -0 and 0 compare equal via Object.is path.
    expect(canonicalKeys([Number.NaN, 1, Number.NaN, 0])).toEqual([0, 1, Number.NaN]);
  });

  it("compares key arrays by membership", () => {
    expect(equalKeys(["a", "b"], ["b", "a"])).toBe(true);
    expect(equalKeys(["a"], ["a", "b"])).toBe(false);
  });
});

describe("canonicalDomain / canonicalIntervalDomains", () => {
  it("rejects non-finite domains and empty or non-string band values", () => {
    expect(() => {
      void canonicalDomain([1, Number.POSITIVE_INFINITY]);
    }).toThrow(/two finite numbers/);
    expect(() => {
      void canonicalIntervalDomains({ x: { kind: "band", values: [] } });
    }).toThrow(/at least one encoded value/);
    expect(() => {
      void canonicalIntervalDomains({
        x: { kind: "band", values: fromAny(["s:ok", 12]) },
      });
    }).toThrow(/must be encoded strings/);
  });

  it("rejects unsupported kinds and invalid log10/sqrt domains", () => {
    expect(() => {
      void canonicalIntervalDomains({
        x: fromAny({ kind: "log", domain: [1, 10] }),
      });
    }).toThrow(/not supported/);
    expect(() => {
      void canonicalIntervalDomains({
        x: { kind: "linear", transform: "log10", domain: [0, 10] },
      });
    }).toThrow(/log10 interval domains must contain positive/);
    expect(() => {
      void canonicalIntervalDomains({
        y: { kind: "linear", transform: "sqrt", domain: [-1, 4] },
      });
    }).toThrow(/sqrt interval domains must contain non-negative/);
    expect(() => {
      void canonicalIntervalDomains({});
    }).toThrow(/must contain an x or y domain/);
  });

  it("dedups band values and normalizes linear/time domains", () => {
    expect(
      canonicalIntervalDomains({
        x: { kind: "band", values: ["s:a", "s:b", "s:a"] },
        y: { kind: "linear", domain: [10, 1] },
      }),
    ).toEqual({
      x: { kind: "band", values: ["s:a", "s:b"] },
      y: { kind: "linear", transform: "identity", domain: [1, 10] },
    });
    expect(canonicalDomain([5, 2])).toEqual([2, 5]);
  });
});

describe("equalInterval / equalDomain", () => {
  it("compares band axes by ordered encoded values", () => {
    const base = {
      panelId: "p0",
      preset: "independent" as const,
      domains: {
        x: { kind: "band" as const, values: ["s:a", "s:b"] },
      },
      keys: ["k1"] as const,
    };
    expect(
      equalInterval(base, {
        ...base,
        domains: { x: { kind: "band", values: ["s:a", "s:b"] } },
      }),
    ).toBe(true);
    expect(
      equalInterval(base, {
        ...base,
        domains: { x: { kind: "band", values: ["s:b", "s:a"] } },
      }),
    ).toBe(false);
    expect(
      equalInterval(base, {
        ...base,
        domains: { x: { kind: "band", values: ["s:a"] } },
      }),
    ).toBe(false);
    expect(equalInterval(undefined, base)).toBe(false);
  });

  it("compares linear axes by transform and domain", () => {
    const left = {
      panelId: "p0",
      preset: "union" as const,
      domains: {
        x: { kind: "linear" as const, transform: "identity" as const, domain: [0, 1] as const },
      },
      keys: [] as const,
    };
    expect(
      equalInterval(left, {
        ...left,
        domains: {
          x: { kind: "linear", transform: "identity", domain: [0, 1] },
        },
      }),
    ).toBe(true);
    expect(
      equalInterval(left, {
        ...left,
        domains: {
          x: { kind: "linear", transform: "log10", domain: [0, 1] },
        },
      }),
    ).toBe(false);
    // Band vs linear is never equal.
    expect(
      equalInterval(left, {
        ...left,
        domains: { x: { kind: "band", values: ["s:a"] } },
      }),
    ).toBe(false);
    expect(equalDomain([1, 2], [1, 2])).toBe(true);
    expect(equalDomain([1, 2], [2, 1])).toBe(false);
    expect(equalDomain(undefined, [1, 2])).toBe(false);
  });
});

describe("sortedScopes / scopedKeys / scopedDomains", () => {
  it("emits frozen scoped entries in scope-key order", () => {
    const keys = scopedKeys(
      new Map([
        ["z", ["b", "a"] as const],
        ["a", ["1"] as const],
      ]),
    );
    expect(keys.map((entry) => entry.scope)).toEqual(["a", "z"]);
    expect(Object.isFrozen(keys)).toBe(true);
    expect(Object.isFrozen(keys[0])).toBe(true);

    const domains = scopedDomains(
      new Map([
        ["y", [0, 1] as const],
        ["x", [2, 3] as const],
      ]),
    );
    expect(domains.map((entry) => entry.scope)).toEqual(["x", "y"]);
    expect(
      sortedScopes(
        new Map([
          ["b", 1],
          ["a", 2],
        ]),
      ).map(([scope]) => scope),
    ).toEqual(["a", "b"]);
  });
});

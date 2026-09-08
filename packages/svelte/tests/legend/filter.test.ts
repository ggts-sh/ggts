import { encodeKey } from "@ggts-sh/core";
import { describe, expect, test } from "vitest";

import {
  isLegendValueKeyVisible,
  isLegendValueVisible,
  legendFilterValueKeys,
  nextLegendFilterValues,
  reconcileLegendFilterValues,
} from "../../src/lib/legend/filter.ts";

const catalog = ["west", "east", "north"] as const;

describe("legend filter state", () => {
  test("exclude mode toggles visibility without confusing typed values", () => {
    let values = nextLegendFilterValues([], "west", catalog, "exclude", true);
    expect(values).toEqual(["west"]);
    expect(isLegendValueVisible(values, "west", "exclude")).toBe(false);
    expect(isLegendValueVisible(values, "east", "exclude")).toBe(true);

    values = nextLegendFilterValues(values, "west", catalog, "exclude", true);
    expect(values).toEqual([]);

    expect(nextLegendFilterValues(["1"], 1, ["1", 1], "exclude", true)).toEqual(["1", 1]);
  });

  test("include mode starts from the full catalog and toggles shown values", () => {
    const values = nextLegendFilterValues(catalog, "east", catalog, "include", true);
    expect(values).toEqual(["west", "north"]);
    expect(isLegendValueVisible(values, "east", "include")).toBe(false);
    expect(isLegendValueVisible(values, "west", "include")).toBe(true);
  });

  test("single mode makes one category the sole visible category", () => {
    expect(nextLegendFilterValues([], "east", catalog, "exclude", false)).toEqual([
      "west",
      "north",
    ]);
    expect(nextLegendFilterValues([], "east", catalog, "include", false)).toEqual(["east"]);
  });

  test("reconciliation drops values no longer present in the stable catalog", () => {
    expect(reconcileLegendFilterValues(["west", "gone"], catalog)).toEqual(["west"]);
  });

  // clause→Set once, then O(1) membership per entry (O(E+V) not O(E×V)).
  // Structural: high-cardinality visibility must match encodeKey identity for
  // every entry against a prebuilt key set; array and Set paths agree.
  test("Set membership visibility matches encodeKey identity across many values", () => {
    const entries = Array.from({ length: 200 }, (_, i) => `cat-${i}`);
    const clauseValues = ["cat-0", "cat-50", "cat-199", "cat-missing"];
    const valueKeys = legendFilterValueKeys(clauseValues);

    expect(valueKeys).toEqual(new Set(clauseValues.map((value) => encodeKey(value))));

    for (const entry of entries) {
      const inClause = entry === "cat-0" || entry === "cat-50" || entry === "cat-199";
      expect(isLegendValueKeyVisible(valueKeys, entry, "exclude")).toBe(!inClause);
      expect(isLegendValueKeyVisible(valueKeys, entry, "include")).toBe(inClause);
      expect(isLegendValueVisible(clauseValues, entry, "exclude")).toBe(!inClause);
      expect(isLegendValueVisible(clauseValues, entry, "include")).toBe(inClause);
    }
  });

  test("typed distinct values stay distinct under Set membership", () => {
    // "1" (string) and 1 (number) are different encodeKey identities.
    const valueKeys = legendFilterValueKeys(["1"]);
    expect(isLegendValueKeyVisible(valueKeys, "1", "exclude")).toBe(false);
    expect(isLegendValueKeyVisible(valueKeys, 1, "exclude")).toBe(true);
    expect(isLegendValueKeyVisible(valueKeys, "1", "include")).toBe(true);
    expect(isLegendValueKeyVisible(valueKeys, 1, "include")).toBe(false);
  });

  test("multi toggle over a large baseline preserves every other value", () => {
    const large = Array.from({ length: 150 }, (_, i) => `v${i}`);
    const withoutMid = nextLegendFilterValues(large, "v75", large, "exclude", true);
    expect(withoutMid).toHaveLength(149);
    expect(withoutMid).not.toContain("v75");
    expect(withoutMid[0]).toBe("v0");
    expect(withoutMid.at(-1)).toBe("v149");

    const restored = nextLegendFilterValues(withoutMid, "v75", large, "exclude", true);
    expect(restored).toEqual([...withoutMid, "v75"]);
  });
});

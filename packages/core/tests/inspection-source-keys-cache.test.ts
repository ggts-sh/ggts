import { describe, expect, it } from "bun:test";

import { createSourceKeysCache } from "../src/inspection-resolver.js";

const longRows = Array.from({ length: 20 }, (_, index) => index);

describe("createSourceKeysCache", () => {
  it("walks a long list of rows once and keeps unique non-null keys in first-seen order", () => {
    let reads = 0;
    const keysOf = createSourceKeysCache((row) => {
      reads++;
      return row === 2 ? null : row === 3 ? "k0" : `k${row}`;
    });
    const keys = keysOf(longRows);
    expect(keys.slice(0, 3)).toEqual(["k0", "k1", "k4"]);
    expect(keys).toHaveLength(18);
    expect(Object.isFrozen(keys)).toBe(true);
    expect(keysOf(longRows)).toBe(keys);
    expect(reads).toBe(longRows.length);
  });

  it("does not keep a single-row list, because a scatter has one per point", () => {
    let reads = 0;
    const keysOf = createSourceKeysCache((row) => {
      reads++;
      return `k${row}`;
    });
    const rows = [7];
    expect(keysOf(rows)).toEqual(["k7"]);
    expect(Object.isFrozen(keysOf(rows))).toBe(true);
    expect(reads).toBe(2);
  });

  it("keeps a list of two rows, because many marks can share a short lineage", () => {
    let reads = 0;
    const keysOf = createSourceKeysCache((row) => {
      reads++;
      return `k${row}`;
    });
    const rows = [7, 8];
    expect(keysOf(rows)).toBe(keysOf(rows));
    expect(reads).toBe(2);
  });

  it("returns a frozen empty list for no rows and for rows with no keys", () => {
    const keysOf = createSourceKeysCache(() => null);
    for (const rows of [[], longRows]) {
      expect(keysOf(rows)).toEqual([]);
      expect(Object.isFrozen(keysOf(rows))).toBe(true);
    }
  });

  it("keeps separate keys for separate lists of rows", () => {
    const keysOf = createSourceKeysCache((row) => `k${row}`);
    expect(keysOf(longRows)).toContain("k19");
    expect(keysOf([100])).toEqual(["k100"]);
  });
});

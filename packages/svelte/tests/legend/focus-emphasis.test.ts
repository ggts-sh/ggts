import { describe, expect, it } from "vitest";

import {
  reconcileLegendPreview,
  resolveLegendEmphasisKeys,
  resolveLegendPreviewKeysDecision,
} from "../../src/lib/legend/focus-emphasis.js";
import {
  buildInteractiveLegendEntries,
  findLegendPressedIdentity,
  legendIdentityKey,
  type InteractiveLegendEntry,
} from "../../src/lib/legend/focus.js";
import { discreteColor, discreteFill } from "./focus-fixtures.js";

/** Spy `globalThis.Set` constructions for allocation-path tests. */
function withCountingSet(run: (constructions: () => number) => void): void {
  const RealSet = globalThis.Set;
  let constructions = 0;
  globalThis.Set = class CountingSet<T> extends RealSet<T> {
    constructor(iterable?: Iterable<T>) {
      super(iterable);
      constructions += 1;
    }
  } as SetConstructor;
  try {
    run(() => constructions);
  } finally {
    globalThis.Set = RealSet;
  }
}

describe("findLegendPressedIdentity", () => {
  const entries = buildInteractiveLegendEntries([discreteFill, discreteColor]);
  const keyIndex = new Map<string, readonly PropertyKey[]>([
    ["fill:0", Object.freeze(["a", "c"])],
    ["fill:1", Object.freeze(["b"])],
    ["color:0", Object.freeze(["a", "c"])], // identical key set to fill:0
  ]);

  it("returns null for empty emphasis", () => {
    expect(
      findLegendPressedIdentity({
        keys: [],
        entries,
        keyIndex,
        committed: null,
      }),
    ).toBeNull();
  });

  // Ramp-only / no discrete legends: nothing to match, so skip Set allocation
  // even when emphasis keys are large (issue #209).
  it("does not allocate a Set when entries are empty and committed is null", () => {
    const largeKeys = Array.from({ length: 5_000 }, (_, i) => `k${i}`);
    withCountingSet((constructions) => {
      expect(
        findLegendPressedIdentity({
          keys: largeKeys,
          entries: [],
          keyIndex: new Map(),
          committed: null,
        }),
      ).toBeNull();
      expect(constructions()).toBe(0);
    });
  });

  it("prefers committed identity when its keys still match", () => {
    expect(
      findLegendPressedIdentity({
        keys: ["c", "a"],
        entries,
        keyIndex,
        committed: {
          identity: { scale: "fill", entryIndex: 0 },
          keys: ["a", "c"],
        },
      }),
    ).toEqual({ scale: "fill", entryIndex: 0 });
  });

  it("returns null when multiple entries match without a committed identity", () => {
    expect(
      findLegendPressedIdentity({
        keys: ["a", "c"],
        entries,
        keyIndex,
        committed: null,
      }),
    ).toBeNull();
  });

  it("returns the unique matching entry for external emphasis", () => {
    expect(
      findLegendPressedIdentity({
        keys: ["b"],
        entries,
        keyIndex,
        committed: null,
      }),
    ).toEqual({ scale: "fill", entryIndex: 1 });
  });

  it("ignores committed identity when its keys no longer match", () => {
    expect(
      findLegendPressedIdentity({
        keys: ["b"],
        entries,
        keyIndex,
        committed: {
          identity: { scale: "fill", entryIndex: 0 },
          keys: ["a", "c"],
        },
      }),
    ).toEqual({ scale: "fill", entryIndex: 1 });
  });

  it("matches unique large key sets and rejects size mismatches", () => {
    // Deterministic large-input coverage (issue #198). Structural O(K+E)
    // comes from a single input Set + size short-circuits; wall-clock ratio
    // guards flake under CI contention (see selection #182 follow-up).
    const K = 2_000;
    const E = 40;
    const matchingKeys = Array.from({ length: K }, (_, i) => `k${i}`);
    const largeEntries: InteractiveLegendEntry[] = Array.from({ length: E }, (_, entryIndex) => ({
      legend: discreteFill,
      entry: {
        value: `v${entryIndex}`,
        label: `L${entryIndex}`,
        color: "#000",
        y: entryIndex * 12,
      },
      identity: { scale: "fill", entryIndex },
    }));
    const largeIndex = new Map<string, readonly PropertyKey[]>();
    for (let entryIndex = 0; entryIndex < E - 1; entryIndex++) {
      // Wrong cardinality → must not match the emphasis set.
      largeIndex.set(
        legendIdentityKey({ scale: "fill", entryIndex }),
        Object.freeze([`solo-${entryIndex}`]),
      );
    }
    largeIndex.set(
      legendIdentityKey({ scale: "fill", entryIndex: E - 1 }),
      Object.freeze(matchingKeys),
    );

    expect(
      findLegendPressedIdentity({
        keys: matchingKeys,
        entries: largeEntries,
        keyIndex: largeIndex,
        committed: null,
      }),
    ).toEqual({ scale: "fill", entryIndex: E - 1 });

    expect(
      findLegendPressedIdentity({
        keys: matchingKeys.slice(0, K - 1),
        entries: largeEntries,
        keyIndex: largeIndex,
        committed: null,
      }),
    ).toBeNull();
  });

  // Pressed-identity resolution builds one Set for the emphasis keys and
  // compares with size short-circuits + membership — not a fresh pair of
  // Sets per legend entry (issue #198, O(E·K) → O(K+E)).
  it("allocates a constant number of Sets relative to entry count", () => {
    const K = 500;
    const E = 30;
    const matchingKeys = Array.from({ length: K }, (_, i) => i);
    const largeEntries: InteractiveLegendEntry[] = Array.from({ length: E }, (_, entryIndex) => ({
      legend: discreteFill,
      entry: {
        value: entryIndex,
        label: String(entryIndex),
        color: "#000",
        y: entryIndex * 12,
      },
      identity: { scale: "fill", entryIndex },
    }));
    const largeIndex = new Map<string, readonly PropertyKey[]>();
    for (let entryIndex = 0; entryIndex < E - 1; entryIndex++) {
      largeIndex.set(legendIdentityKey({ scale: "fill", entryIndex }), Object.freeze([entryIndex]));
    }
    largeIndex.set(
      legendIdentityKey({ scale: "fill", entryIndex: E - 1 }),
      Object.freeze(matchingKeys),
    );

    withCountingSet((constructions) => {
      const result = findLegendPressedIdentity({
        keys: matchingKeys,
        entries: largeEntries,
        keyIndex: largeIndex,
        committed: null,
      });
      expect(result).toEqual({ scale: "fill", entryIndex: E - 1 });
      // One Set for input.keys (plus at most a small constant). Not 2×E.
      expect(constructions()).toBeLessThanOrEqual(2);
      expect(constructions()).toBeLessThan(E);
    });
  });
});

describe("resolveLegendPreviewKeysDecision", () => {
  it("clears when the entry has no keys", () => {
    expect(resolveLegendPreviewKeysDecision({ keys: [], entrySource: "pointer" })).toEqual({
      type: "clear",
    });
  });

  it("sets keys and maps entrySource to InteractionSource", () => {
    expect(resolveLegendPreviewKeysDecision({ keys: ["a"], entrySource: "pointer" })).toEqual({
      type: "set",
      keys: ["a"],
      source: "pointer",
    });
    expect(resolveLegendPreviewKeysDecision({ keys: ["a", "b"], entrySource: "focus" })).toEqual({
      type: "set",
      keys: ["a", "b"],
      source: "keyboard",
    });
  });
});

describe("resolveLegendEmphasisKeys", () => {
  it("drops local/preview emphasis when legend focus is disabled", () => {
    expect(
      resolveLegendEmphasisKeys({
        legendFocusEnabled: false,
        previewKeys: ["p"],
        controllerKeys: null,
        localKeys: ["l"],
      }),
    ).toEqual([]);
    expect(
      resolveLegendEmphasisKeys({
        legendFocusEnabled: false,
        previewKeys: ["p"],
        controllerKeys: ["c"],
        localKeys: ["l"],
      }),
    ).toEqual(["c"]);
  });

  it("prefers preview then controller then local when enabled", () => {
    expect(
      resolveLegendEmphasisKeys({
        legendFocusEnabled: true,
        previewKeys: ["p"],
        controllerKeys: ["c"],
        localKeys: ["l"],
      }),
    ).toEqual(["p"]);
    expect(
      resolveLegendEmphasisKeys({
        legendFocusEnabled: true,
        previewKeys: null,
        controllerKeys: null,
        localKeys: ["l"],
      }),
    ).toEqual(["l"]);
  });
});

describe("reconcileLegendPreview", () => {
  const entries = buildInteractiveLegendEntries([discreteFill]);
  const keyIndex = new Map<string, readonly PropertyKey[]>([
    ["fill:0", Object.freeze(["a", "c"])],
    ["fill:1", Object.freeze(["b"])],
  ]);

  it("clears when the entry disappears or has empty keys", () => {
    expect(
      reconcileLegendPreview({
        preview: { identity: { scale: "fill", entryIndex: 9 }, keys: ["x"] },
        entries,
        keyIndex,
      }),
    ).toBeNull();
    const emptyIndex = new Map<string, readonly PropertyKey[]>([["fill:0", Object.freeze([])]]);
    expect(
      reconcileLegendPreview({
        preview: { identity: { scale: "fill", entryIndex: 0 }, keys: ["a"] },
        entries,
        keyIndex: emptyIndex,
      }),
    ).toBeNull();
  });

  it("refreshes keys when membership changes for the same identity", () => {
    const next = reconcileLegendPreview({
      preview: { identity: { scale: "fill", entryIndex: 0 }, keys: ["stale"] },
      entries,
      keyIndex,
    });
    expect(next).toEqual({ identity: { scale: "fill", entryIndex: 0 }, keys: ["a", "c"] });
  });

  it("keeps the same object when keys still match", () => {
    const preview = { identity: { scale: "fill", entryIndex: 0 }, keys: ["a", "c"] as const };
    expect(
      reconcileLegendPreview({
        preview,
        entries,
        keyIndex,
      }),
    ).toBe(preview);
  });
});

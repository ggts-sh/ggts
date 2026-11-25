import { describe, expect, it } from "bun:test";

import {
  buildInteractionMasks,
  buildPrimitiveInteractionMasks,
  type SemanticCandidateKeys,
} from "../src/interaction-mask.ts";
import type { GeometryBatch } from "../src/scene.ts";

function pointBatch(count: number): GeometryBatch {
  return {
    kind: "points",
    layerIndex: 0,
    panelIndex: 0,
    positions: new Float32Array(count * 2),
    rowIndex: Uint32Array.from({ length: count }, (_, index) => index),
    size: 3,
    alpha: 1,
    shape: "circle",
    fill: null,
  };
}

function rectBatch(count: number): GeometryBatch {
  return {
    kind: "rects",
    layerIndex: 0,
    panelIndex: 0,
    rects: new Float32Array(count * 4),
    rowIndex: Uint32Array.from({ length: count }, (_, index) => index),
    alpha: 1,
    fill: null,
  };
}

/** Presentation-only open-path batch (`candidates: false`) with `subpaths` strokes. */
function outlineBatch(subpaths: number, layerIndex: number): GeometryBatch {
  const vertices = subpaths * 2;
  return {
    kind: "paths",
    layerIndex,
    panelIndex: 0,
    positions: new Float32Array(vertices * 2),
    rowIndex: new Uint32Array(vertices),
    pathOffsets: Uint32Array.from({ length: subpaths + 1 }, (_, index) => index * 2),
    strokes: Array.from({ length: subpaths }, () => null),
    linewidth: 1,
    alpha: 1,
    curve: "linear",
    candidates: false,
  };
}

describe("buildInteractionMasks", () => {
  it("adds direct focus without changing the semantic mask mirrored to outlines", () => {
    const batches = [rectBatch(3), outlineBatch(3, 0), rectBatch(1)];
    const candidates = [
      { batchIndex: 0, primitiveIndex: 0, keys: ["selected"] },
      { batchIndex: 0, primitiveIndex: 1, keys: ["other"] },
    ];
    const masks = buildInteractionMasks(batches, ["selected"], candidates, [
      { batchIndex: 0, primitiveIndex: 0 },
      { batchIndex: 0, primitiveIndex: 1 },
      { batchIndex: 0, primitiveIndex: 1 },
      { batchIndex: 2, primitiveIndex: 0 },
      { batchIndex: 2, primitiveIndex: 9 },
    ]);

    expect(masks.map((mask) => mask?.focusedCount)).toEqual([2, 1, 1]);
    expect(masks[0]?.isFocused(1)).toBe(true);
    expect(masks[1]?.isFocused(0)).toBe(true);
    expect(masks[1]?.isFocused(1)).toBe(false);
    expect(masks[2]?.isFocused(0)).toBe(true);
  });

  it("projects semantic emphasis onto immutable per-batch primitive masks", () => {
    const candidates: SemanticCandidateKeys<string>[] = [
      { batchIndex: 0, primitiveIndex: 0, keys: ["alpha"] },
      { batchIndex: 0, primitiveIndex: 1, keys: ["beta", "shared"] },
      { batchIndex: 0, primitiveIndex: 2, keys: ["gamma"] },
    ];

    const masks = buildInteractionMasks([pointBatch(3)], ["shared"], candidates);

    expect(Object.isFrozen(masks)).toBe(true);
    expect(masks).toHaveLength(1);
    expect(masks[0]?.primitiveCount).toBe(3);
    expect(masks[0]?.focusedCount).toBe(1);
    expect(masks[0]?.isFocused(0)).toBe(false);
    expect(masks[0]?.isFocused(1)).toBe(true);
    expect(masks[0]?.isFocused(2)).toBe(false);
    expect(Object.isFrozen(masks[0])).toBe(true);
  });

  it("collapses path vertex candidates to their containing subpath", () => {
    const paths: GeometryBatch = {
      kind: "paths",
      layerIndex: 0,
      panelIndex: 0,
      positions: new Float32Array(12),
      rowIndex: new Uint32Array([0, 1, 2, 3, 4, 5]),
      pathOffsets: new Uint32Array([0, 2, 6]),
      strokes: [null, null],
      linewidth: 1,
      alpha: 1,
      curve: "linear",
    };
    const candidates: SemanticCandidateKeys<number>[] = [
      { batchIndex: 0, primitiveIndex: 0, keys: [10] },
      { batchIndex: 0, primitiveIndex: 1, keys: [11] },
      { batchIndex: 0, primitiveIndex: 4, keys: [20] },
    ];

    const [mask] = buildInteractionMasks([paths], [11], candidates);

    expect(mask?.primitiveCount).toBe(2);
    expect(mask?.focusedCount).toBe(1);
    expect(mask?.isFocused(0)).toBe(true);
    expect(mask?.isFocused(1)).toBe(false);
  });

  it("leaves annotation-only batches unaffected and disables masks without emphasis", () => {
    const batches = [pointBatch(2), pointBatch(1)];
    const candidates: SemanticCandidateKeys<string>[] = [
      { batchIndex: 0, primitiveIndex: 0, keys: ["alpha"] },
      { batchIndex: 0, primitiveIndex: 1, keys: [] },
    ];

    expect(buildInteractionMasks(batches, [], candidates)).toEqual([null, null]);
    expect(buildInteractionMasks(batches, ["missing"], candidates)[0]?.focusedCount).toBe(0);
    expect(buildInteractionMasks(batches, ["missing"], candidates)[1]).toBeNull();
  });

  it("ignores malformed candidate locations rather than corrupting another mask", () => {
    const candidates: SemanticCandidateKeys<string>[] = [
      { batchIndex: -1, primitiveIndex: 0, keys: ["focus"] },
      { batchIndex: 4, primitiveIndex: 0, keys: ["focus"] },
      { batchIndex: 0, primitiveIndex: 9, keys: ["focus"] },
    ];

    expect(buildInteractionMasks([pointBatch(1)], ["focus"], candidates)).toEqual([null]);
  });

  it("mirrors fill focus onto presentation-only path batches on the same layer", () => {
    // Ribbon fill (candidates) + outline (candidates: false). Outline must get a
    // non-null mask so canvas mutes unselected outlines with the fill.
    const fill: GeometryBatch = {
      kind: "paths",
      layerIndex: 0,
      panelIndex: 0,
      positions: new Float32Array(16),
      rowIndex: new Uint32Array([0, 1, 2, 3]),
      pathOffsets: new Uint32Array([0, 4, 8]),
      strokes: [null, null],
      fills: ["#f00", "#0f0"],
      closed: true,
      linewidth: 0,
      alpha: 1,
      curve: "linear",
    };
    const outline: GeometryBatch = {
      kind: "paths",
      layerIndex: 0,
      panelIndex: 0,
      positions: new Float32Array(32),
      rowIndex: new Uint32Array(16),
      pathOffsets: new Uint32Array([0, 4, 8, 12, 16]),
      strokes: [null, null, null, null],
      linewidth: 1,
      alpha: 1,
      curve: "linear",
      candidates: false,
    };
    const candidates: SemanticCandidateKeys<string>[] = [
      { batchIndex: 0, primitiveIndex: 0, keys: ["a"] },
      { batchIndex: 0, primitiveIndex: 3, keys: ["b"] },
    ];

    const masks = buildInteractionMasks([fill, outline], ["a"], candidates);
    expect(masks[0]?.isFocused(0)).toBe(true);
    expect(masks[0]?.isFocused(1)).toBe(false);
    // outline "both" → 2 subpaths per fill path; path 0 focused → edges 0,1 focused
    expect(masks[1]).not.toBeNull();
    expect(masks[1]?.primitiveCount).toBe(4);
    expect(masks[1]?.isFocused(0)).toBe(true);
    expect(masks[1]?.isFocused(1)).toBe(true);
    expect(masks[1]?.isFocused(2)).toBe(false);
    expect(masks[1]?.isFocused(3)).toBe(false);
  });

  it("leaves an outline null when no same-layer batch has a mask", () => {
    const candidates: SemanticCandidateKeys<string>[] = [
      { batchIndex: 0, primitiveIndex: 0, keys: ["a"] },
    ];
    const masks = buildInteractionMasks([pointBatch(1), outlineBatch(1, 7)], ["a"], candidates);
    expect(masks[0]?.focusedCount).toBe(1);
    expect(masks[1]).toBeNull();
  });

  it("lets a later outline source an earlier outline's mirrored mask by batch order", () => {
    // Pins the cascade: the mask source for an outline is the lowest-indexed
    // same-layer batch that HAS a mask at that point in the loop — including a
    // mask mirrored earlier onto another outline. Here outline0 (2 subpaths,
    // index 0) mirrors from the fill (1 path, index 1) via the ×2 branch, and
    // outline2 (4 subpaths) then sources outline0 (count 2, 4 = 2×2 → ×2
    // branch → all focused). Sourcing the fill instead would hit the length-
    // mismatch branch (4 vs 1) and zero everything.
    const fill: GeometryBatch = {
      kind: "paths",
      layerIndex: 0,
      panelIndex: 0,
      positions: new Float32Array(8),
      rowIndex: new Uint32Array([0, 1, 2, 3]),
      pathOffsets: new Uint32Array([0, 4]),
      strokes: [null],
      fills: ["#f00"],
      closed: true,
      linewidth: 0,
      alpha: 1,
      curve: "linear",
    };
    const candidates: SemanticCandidateKeys<string>[] = [
      { batchIndex: 1, primitiveIndex: 0, keys: ["a"] },
    ];

    const masks = buildInteractionMasks(
      [outlineBatch(2, 0), fill, outlineBatch(4, 0)],
      ["a"],
      candidates,
    );
    expect(masks[0]?.primitiveCount).toBe(2);
    expect(masks[0]?.focusedCount).toBe(2);
    expect(masks[2]?.primitiveCount).toBe(4);
    expect(masks[2]?.focusedCount).toBe(4);
  });

  it("resolves outline mask sources without rescanning all batches per outline", () => {
    // 1 focused point batch on layer 0 plus 200 outlines on layers 1..200 —
    // none finds a peer. Peer resolution must not scan the whole batch list
    // once per outline (O(B²) batch reads); a per-layer lookup keeps total
    // batch-element reads linear in B.
    const outlines = Array.from({ length: 200 }, (_, index) => outlineBatch(1, index + 1));
    const batches: GeometryBatch[] = [pointBatch(1), ...outlines];
    const total = batches.length;
    let reads = 0;
    const counted = new Proxy(batches, {
      get(target, prop) {
        if (typeof prop === "string" && /^\d+$/.test(prop)) reads += 1;
        return Reflect.get(target, prop) as unknown;
      },
    });
    const candidates: SemanticCandidateKeys<string>[] = [
      { batchIndex: 0, primitiveIndex: 0, keys: ["a"] },
    ];

    const masks = buildInteractionMasks(counted, ["a"], candidates);
    expect(masks[0]?.focusedCount).toBe(1);
    expect(masks[1]).toBeNull();
    // Fixed passes (candidate lookup, mirror loop, one peer-index build, final
    // freeze) each read ≤ B elements; 8×B fails on even a partial per-outline
    // rescan (the old code read ~B² ≈ 40k).
    expect(reads).toBeGreaterThan(0);
    expect(reads).toBeLessThan(8 * total);
  });
});

describe("buildPrimitiveInteractionMasks", () => {
  it("marks explicit rect primitives without semantic keys", () => {
    const masks = buildPrimitiveInteractionMasks(
      [rectBatch(3)],
      [{ batchIndex: 0, primitiveIndex: 1 }],
    );
    expect(masks[0]?.focusedCount).toBe(1);
    expect(masks[0]?.isFocused(0)).toBe(false);
    expect(masks[0]?.isFocused(1)).toBe(true);
    expect(masks[0]?.isFocused(2)).toBe(false);
  });

  it("returns null masks when no primitives are supplied", () => {
    expect(buildPrimitiveInteractionMasks([rectBatch(2)], [])).toEqual([null]);
  });

  it("treats path primitive indexes as renderer subpaths, not vertices", () => {
    // pathOffsets [0, 3, 6] → two subpaths; index 1 is the second path.
    // Must not remap through pathForVertex (which would map 1 → subpath 0).
    const paths: GeometryBatch = {
      kind: "paths",
      layerIndex: 0,
      panelIndex: 0,
      positions: new Float32Array(12),
      rowIndex: new Uint32Array([0, 1, 2, 3, 4, 5]),
      pathOffsets: new Uint32Array([0, 3, 6]),
      strokes: [null, null],
      linewidth: 1,
      alpha: 1,
      curve: "linear",
    };
    const masks = buildPrimitiveInteractionMasks([paths], [{ batchIndex: 0, primitiveIndex: 1 }]);
    expect(masks[0]?.focusedCount).toBe(1);
    expect(masks[0]?.isFocused(0)).toBe(false);
    expect(masks[0]?.isFocused(1)).toBe(true);
  });
});

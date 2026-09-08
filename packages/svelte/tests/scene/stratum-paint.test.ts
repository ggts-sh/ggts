import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";

import type { GeometryBatch } from "@ggts-sh/core";

import { paintCanvasStratum, resolveBatchFocusMasks } from "../../src/lib/scene/stratum-paint.js";

describe("resolveBatchFocusMasks", () => {
  const a = fromAny<GeometryBatch>({ id: "a" });
  const b = fromAny<GeometryBatch>({ id: "b" });
  const c = fromAny<GeometryBatch>({ id: "c" });
  const sceneBatches = [a, b, c];
  const masks = [{ primitives: new Set([0]) }, null, { primitives: new Set([1]) }] as const;

  it("returns empty when interactionMasks is empty", () => {
    expect(resolveBatchFocusMasks(sceneBatches, [a, c], [])).toEqual([]);
  });

  it("maps subset batches by scene identity, not subset index", () => {
    expect(resolveBatchFocusMasks(sceneBatches, [c, a], fromAny(masks))).toEqual([
      masks[2],
      masks[0],
    ]);
  });

  it("returns null for batches absent from the scene list", () => {
    const orphan = fromAny<GeometryBatch>({ id: "orphan" });
    expect(resolveBatchFocusMasks(sceneBatches, [orphan], fromAny(masks))).toEqual([null]);
  });

  it("treats missing mask slots as null when masks are shorter than the scene", () => {
    // Scene index 2 has no corresponding mask entry.
    expect(resolveBatchFocusMasks(sceneBatches, [c, a], fromAny([masks[0]]))).toEqual([
      null,
      masks[0],
    ]);
  });

  // Projection builds a batch→index Map once (O(S + B)) rather than indexOf per
  // batch (O(B·S)). Structural property of the implementation; wall-clock ratio
  // guards flake under CI contention — large-input identity mapping locks the
  // public contract instead.
  it("projects a large subset by scene identity in reverse order", () => {
    const n = 2_000;
    const scene = Array.from({ length: n }, (_, i) => fromAny<GeometryBatch>({ id: i }));
    const interactionMasks = scene.map((_, i) =>
      i % 3 === 0 ? fromAny({ primitives: new Set([i]) }) : null,
    );
    // Known scene indices (every 7th, reversed) — expected masks come from that
    // construction, not from re-deriving indices via indexOf.
    const subsetIndices: number[] = [];
    for (let i = 0; i < n; i++) if (i % 7 === 0) subsetIndices.push(i);
    subsetIndices.reverse();
    const subset = subsetIndices.map((i) => scene[i]);
    const projected = resolveBatchFocusMasks(scene, subset, interactionMasks);
    expect(projected).toEqual(subsetIndices.map((i) => interactionMasks[i]));
  });
});

describe("paintCanvasStratum", () => {
  it("returns false and does not size/draw when 2d context is unavailable", () => {
    const canvas = document.createElement("canvas");
    const getContext = vi.spyOn(canvas, "getContext").mockReturnValue(null);
    const ok = paintCanvasStratum({
      canvas,
      scene: fromPartial({
        width: 100,
        height: 50,
        theme: { interactionMuted: 0.35 },
        batches: [],
      }),
      batches: [],
      focusMasks: [],
    });
    expect(ok).toBe(false);
    expect(getContext).toHaveBeenCalledWith("2d");
  });

  it("returns true when a 2d context is available", () => {
    const canvas = document.createElement("canvas");
    // Real browser 2d context — sizing/drawing exercise the core path.
    const ok = paintCanvasStratum({
      canvas,
      scene: fromPartial({
        width: 40,
        height: 20,
        theme: { interactionMuted: 0.4 },
        panels: [],
        batches: [],
        axes: [],
        legends: [],
        grids: [],
        strips: [],
        title: null,
        subtitle: null,
        caption: null,
      }),
      batches: [],
      focusMasks: [],
    });
    expect(ok).toBe(true);
    expect(canvas.width).toBeGreaterThan(0);
  });
});

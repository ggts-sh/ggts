/**
 * coord flip — geometry
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { RectsBatch } from "../../src/scene.ts";
import { size, wrapRows } from "./fixtures.ts";

describe("coord flip — geometry", () => {
  const barRows = [
    { cat: "one", v: 4 },
    { cat: "two", v: 8 },
    { cat: "three", v: 2 },
  ];

  it("horizontal bars: anchored at x = 0, first band at the bottom", () => {
    const model = runPipeline(
      gg(barRows, aes({ x: "cat", y: "v" }))
        .geomCol()
        .coordFlip()
        .spec(),
      size,
    );
    const panel = model.scene.panels[0]!;
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.kind).toBe("rects");
    const bars = Array.from({ length: batch.rects.length / 4 }, (_, j) => ({
      x: batch.rects[j * 4]!,
      y: batch.rects[j * 4 + 1]!,
      w: batch.rects[j * 4 + 2]!,
      h: batch.rects[j * 4 + 3]!,
    }));
    // All bars share the same baseline left edge (semantic 0, offset by the 5%
    // measure-axis expansion — no longer pixel 0).
    const baseX = bars[0]!.x;
    for (const bar of bars) expect(bar.x).toBeCloseTo(baseX, 3);
    // Bar lengths ordered like the data values 4, 8, 2.
    expect(bars[1]!.w).toBeGreaterThan(bars[0]!.w);
    expect(bars[2]!.w).toBeLessThan(bars[0]!.w);
    // First category ("one") sits at the BOTTOM (largest y).
    expect(bars[0]!.y).toBeGreaterThan(bars[1]!.y);
    expect(bars[1]!.y).toBeGreaterThan(bars[2]!.y);
    // Bands slice the panel VERTICALLY now.
    for (const bar of bars) expect(bar.h).toBeCloseTo((panel.height / 3) * 0.9, 0);
  });

  it("flip swaps stacking onto the horizontal axis (position stack)", () => {
    const rows = [
      { cat: "a", kind: "u", v: 3 },
      { cat: "a", kind: "w", v: 5 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "cat", y: "v", fill: "kind" }))
        .geomCol()
        // flush measure axis so the stack starts exactly at pixel 0
        .scales({ y: { expand: { mult: 0, add: 0 } } })
        .coordFlip()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as RectsBatch;
    const segs = Array.from({ length: 2 }, (_, j) => ({
      x: batch.rects[j * 4]!,
      w: batch.rects[j * 4 + 2]!,
    })).toSorted((a, b) => a.x - b.x);
    // Two segments tile the horizontal extent contiguously from 0:
    // [0, t(3)] then [t(3), t(8)] (first-seen group stacks on top).
    expect(segs[0]!.x).toBeCloseTo(0, 2);
    expect(segs[1]!.x).toBeCloseTo(segs[0]!.x + segs[0]!.w, 2);
    expect(segs[1]!.w).toBeGreaterThan(0);
  });

  it("flip swaps the axes: left = categories, bottom = measure; titles follow", () => {
    const model = runPipeline(
      gg(barRows, aes({ x: "cat", y: "v" }))
        .geomCol()
        .coordFlip()
        .spec(),
      size,
    );
    expect(model.scene.axes.x.title).toBe("v"); // bottom shows the measure
    expect(model.scene.axes.y.title).toBe("cat");
    const left = model.scene.panels[0]!.axisY ?? [];
    expect(new Set(left.map((t) => t.label))).toEqual(new Set(["one", "two", "three"]));
  });

  it("flip composes with facets", () => {
    const rows = wrapRows.map((r) => ({ ...r, cat: r.x === 1 ? "l" : "r" }));
    const model = runPipeline(
      gg(rows, aes({ x: "cat", y: "y" }))
        .geomCol()
        .facet({ wrap: "g" })
        // flush measure axis so bars anchor exactly at pixel 0 across panels
        .scales({ y: { expand: { mult: 0, add: 0 } } })
        .coordFlip()
        .spec(),
      size,
    );
    expect(model.scene.panels).toHaveLength(3);
    const rects = model.scene.batches.filter((b): b is RectsBatch => b.kind === "rects");
    for (const batch of rects) {
      for (let j = 0; j < batch.rects.length / 4; j++) {
        expect(batch.rects[j * 4]!).toBeCloseTo(0, 3); // horizontal bars everywhere
      }
    }
  });

  it("annotation rules flip too: a yintercept renders as a vertical line", () => {
    const model = runPipeline(
      gg(barRows, aes({ x: "cat", y: "v" }))
        .geomCol()
        .geomRule({ yintercept: 5 })
        .coordFlip()
        .spec(),
      size,
    );
    const segs = model.scene.batches.find((b) => b.kind === "segments")!;
    if (segs.kind !== "segments") throw new Error("unreachable");
    // The y-channel intercept renders on the bottom (horizontal) axis, so
    // the rule line is VERTICAL: x1 === x2, spanning the panel height.
    expect(segs.segments[0]!).toBeCloseTo(segs.segments[2]!, 3);
    expect(Math.abs(segs.segments[3]! - segs.segments[1]!)).toBeCloseTo(
      model.scene.panels[0]!.height,
      3,
    );
  });
});

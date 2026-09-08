/**
 * The stacked-area auto-align rescue first asks whether any group skips a
 * shared-grid x inside its own range. It answered by walking the sorted grid
 * per group, and the "before this group starts" arm was a `continue` rather
 * than a seek, so every group paid for the whole prefix below its own minimum.
 *
 * Groups and distinct x both grow with the data, so that scan was
 * groups × grid-x. The shape it costs most on is the ordinary one: many series
 * that each cover a dense window of a wider shared grid and have no holes at
 * all — exactly the case where the answer is "no rescue needed".
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { size } from "./fixtures.ts";

function areaModel(data: Record<string, unknown[]>) {
  return runPipeline(
    gg(data as never, aes({ x: "x", y: "y", fill: "g" }))
      .geomArea()
      .spec(),
    size,
  );
}

function aligned(model: ReturnType<typeof runPipeline>): boolean {
  return model.advisories.some((a) => a.code === "stack-align-applied");
}

/**
 * `count` series, each covering `width` consecutive grid x, starting `stride`
 * apart. No series has an interior hole, so no rescue is needed — but every
 * series sits above a prefix of grid values it does not carry.
 */
function staggered(count: number, width: number, stride: number) {
  const x: number[] = [];
  const y: number[] = [];
  const g: string[] = [];
  for (let s = 0; s < count; s++) {
    for (let i = 0; i < width; i++) {
      x.push(s * stride + i);
      y.push(1 + (i % 3));
      g.push(`s${s}`);
    }
  }
  return { x, y, g };
}

/** Numeric-index reads of every sorted array built during `run`. */
function gridReads(run: () => void): number {
  const original = Array.prototype.toSorted;
  let reads = 0;
  // oxlint-disable-next-line no-extend-native -- only seam that sees the grid walk
  Array.prototype.toSorted = function toSortedCounting(this: unknown[], ...args: never[]) {
    const sorted: unknown[] = original.apply(this, args);
    return new Proxy(sorted, {
      get(target, property, receiver) {
        if (typeof property === "string" && /^\d+$/.test(property)) reads += 1;
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
  } as typeof Array.prototype.toSorted;
  try {
    run();
  } finally {
    // oxlint-disable-next-line no-extend-native -- restores the patch above
    Array.prototype.toSorted = original;
  }
  return reads;
}

describe("stacked area auto-align grid scan", () => {
  it("does not rescan the grid per group when no group has a hole", () => {
    const data = staggered(100, 100, 100);
    const rows = data.x.length;
    let model: ReturnType<typeof runPipeline> | null = null;
    const reads = gridReads(() => {
      model = areaModel(data);
    });
    // The fixture makes row count and grid size equal, so the bound reads as
    // "a handful of passes over the grid". The per-group walk took 51.5 of
    // them; ranking the grid once takes a fixed number whatever the group
    // count. The total also carries unrelated sorts elsewhere in the pipeline
    // (stack positioning, discrete training), which is why the bound is loose
    // rather than exact.
    expect(rows).toBe(10_000);
    expect(reads).toBeLessThan(rows * 5);
    expect(aligned(model!)).toBe(false);
    model!.dispose();
  });

  it("still rescues a group with an interior hole", () => {
    // b skips x=2 while a covers 1..3, so b chords across a varying stack.
    const model = areaModel({
      x: [1, 2, 3, 1, 3],
      y: [2, 2, 2, 3, 3],
      g: ["a", "a", "a", "b", "b"],
    });
    expect(aligned(model)).toBe(true);
    model.dispose();
  });

  it("leaves staggered windows alone when each is dense", () => {
    // a covers 0..2, b covers 3..5. Neither skips anything inside its own
    // range, so there is nothing to interpolate even though neither covers
    // the shared grid.
    const model = areaModel({
      x: [0, 1, 2, 3, 4, 5],
      y: [1, 2, 3, 3, 2, 1],
      g: ["a", "a", "a", "b", "b", "b"],
    });
    expect(aligned(model)).toBe(false);
    model.dispose();
  });

  it("leaves a single-sample group alone", () => {
    // b holds one x, so its range is a point and cannot have an interior hole.
    const model = areaModel({
      x: [0, 1, 2, 1],
      y: [1, 2, 3, 4],
      g: ["a", "a", "a", "b"],
    });
    expect(aligned(model)).toBe(false);
    model.dispose();
  });

  it("leaves groups that both cover the whole grid alone", () => {
    const model = areaModel({
      x: [0, 1, 2, 0, 1, 2],
      y: [1, 2, 3, 3, 2, 1],
      g: ["a", "a", "a", "b", "b", "b"],
    });
    expect(aligned(model)).toBe(false);
    model.dispose();
  });

  it("ignores rows with no y when deciding", () => {
    // The null-y row is skipped, which leaves b holding 1 and 3 while the
    // shared grid carries 2 — still an interior hole.
    const model = areaModel({
      x: [1, 2, 3, 1, 2, 3],
      y: [2, 2, 2, 3, null, 3],
      g: ["a", "a", "a", "b", "b", "b"],
    });
    expect(aligned(model)).toBe(true);
    model.dispose();
  });

  it("measures a group's window in grid slots, not in x distance", () => {
    // The grid is 0, 10, 20 — not evenly spaced by 1. Group b holds 10 and 20,
    // which are adjacent slots, so it is dense and needs no rescue. Sizing the
    // window by `max - min` instead of by rank would call it a nine-value hole.
    const model = areaModel({
      x: [0, 10, 20, 10, 20],
      y: [1, 2, 3, 2, 3],
      g: ["a", "a", "a", "b", "b"],
    });
    expect(aligned(model)).toBe(false);
    model.dispose();
  });

  it("finds a hole when a group's rows arrive out of order", () => {
    // b's rows are 3 then 1, so a min/max pass that trusted arrival order would
    // read the window backwards and miss the missing 2.
    const model = areaModel({
      x: [1, 2, 3, 3, 1],
      y: [2, 2, 2, 3, 3],
      g: ["a", "a", "a", "b", "b"],
    });
    expect(aligned(model)).toBe(true);
    model.dispose();
  });

  it("does not rescue a group whose missing x are all outside its range", () => {
    // c holds only 3 and 4 out of a 0..4 grid. Everything it lacks is below
    // its own minimum, so the window is dense and no interpolation is due.
    const model = areaModel({
      x: [0, 1, 2, 3, 4, 3, 4],
      y: [1, 1, 1, 1, 1, 2, 2],
      g: ["a", "a", "a", "a", "a", "c", "c"],
    });
    expect(aligned(model)).toBe(false);
    model.dispose();
  });
});

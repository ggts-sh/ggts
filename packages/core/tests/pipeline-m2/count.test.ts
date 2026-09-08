/**
 * M2 pipeline — geom_count / stat_sum.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { PointsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("geom_count / stat_sum", () => {
  it("emits one point per unique (x,y) with size from n", () => {
    const model = runPipeline(
      gg(
        {
          x: [1, 1, 1, 2, 2, 3],
          y: [1, 1, 2, 2, 2, 3],
        },
        aes({ x: "x", y: "y" }),
      )
        .geomCount()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.kind).toBe("points");
    expect(batch.positions.length / 2).toBe(4);
    // after_stat n trains a continuous size scale → px; relative order preserved
    expect(batch.sizes).toBeDefined();
    const sizes = [...batch.sizes!];
    expect(sizes.length).toBe(4);
    // first-seen n: 2, 1, 2, 1 → two large (n=2) and two small (n=1)
    const sorted = sizes.toSorted((a, b) => a - b);
    expect(sorted[0]).toBe(sorted[1]);
    expect(sorted[2]).toBe(sorted[3]);
    expect(sorted[2]!).toBeGreaterThan(sorted[0]!);
  });

  it("props within colour groups", () => {
    const model = runPipeline(
      gg(
        {
          x: [1, 1, 1, 2, 2, 3],
          y: [1, 1, 2, 2, 2, 3],
          g: ["a", "a", "a", "b", "b", "b"],
        },
        aes({ x: "x", y: "y", color: "g" }),
      )
        .geomCount()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.positions.length / 2).toBe(4);
    expect(new Set(batch.colorPalette ?? batch.colors ?? []).size).toBe(2);
  });

  it("point + stat sum is equivalent mark count", () => {
    const data = { x: [0, 0, 1], y: [0, 0, 1] };
    const viaCount = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomCount()
        .spec(),
      size,
    );
    const viaPoint = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomPoint({ stat: "sum" })
        .spec(),
      size,
    );
    expect((viaCount.scene.batches[0] as PointsBatch).positions.length).toBe(
      (viaPoint.scene.batches[0] as PointsBatch).positions.length,
    );
  });

  it("keeps rows when the axes are text categories", () => {
    const rows = [
      { cat: "a", grade: "hi" },
      { cat: "a", grade: "hi" },
      { cat: "a", grade: "lo" },
      { cat: "b", grade: "hi" },
      { cat: "b", grade: "lo" },
      { cat: "b", grade: "lo" },
    ];
    // Discrete axes have no finite numeric form, so keying them on the numeric
    // column drops every row and the layer renders nothing (#795).
    const model = runPipeline(
      gg(rows, aes({ x: "cat", y: "grade" }))
        .geomCount()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch).toBeDefined();
    // 4 distinct (cat, grade) pairs: a/hi, a/lo, b/hi, b/lo.
    expect(batch.positions.length / 2).toBe(4);
    expect(model.warnings.some((w) => w.code === "removed-missing")).toBe(false);
  });
});

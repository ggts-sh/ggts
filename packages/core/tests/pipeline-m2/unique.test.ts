/**
 * M2 pipeline — stat unique (#813): first-wins aesthetic dedupe before draw.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { size } from "./fixtures.ts";

describe("stat unique (#813)", () => {
  it("dedupes points so duplicate (x,y,color) draw once", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 0, 1, 0],
          y: [0, 0, 1, 0],
          c: ["a", "a", "b", "a"],
        },
        aes({ x: "x", y: "y", color: "c" }),
      )
        .geomPoint({ stat: "unique" })
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "points");
    expect(batch).toBeDefined();
    if (batch?.kind !== "points") throw new Error("expected points batch");
    // Keys: (0,0,a), (1,1,b) — two unique combinations.
    expect(batch.positions.length / 2).toBe(2);
    expect(model.candidates.size).toBe(2);
  });

  it("first occurrence wins for candidate source lineage", () => {
    const model = runPipeline(
      gg(
        {
          x: [1, 1, 2],
          y: [10, 10, 20],
          label: ["first", "dup", "other"],
        },
        aes({ x: "x", y: "y" }),
      )
        .geomPoint({ stat: "unique" })
        .spec(),
      size,
    );
    // Two unique (x,y): (1,10) first at row 0; (2,20) at row 2.
    expect(model.candidates.size).toBe(2);
    const first = model.candidates.candidate(0)!;
    expect(first.xValue).toBe(1);
    expect(first.yValue).toBe(10);
    // Source order should be the first occurrence (row 0), not the duplicate.
    expect(first.sourceOrder).toBe(0);
  });

  it("identity still draws every row when stat is omitted", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 0, 0],
          y: [0, 0, 0],
        },
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "points");
    if (batch?.kind !== "points") throw new Error("expected points batch");
    expect(batch.positions.length / 2).toBe(3);
  });
});

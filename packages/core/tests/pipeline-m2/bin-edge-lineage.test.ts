/**
 * Bin-edge lineage parity (#905).
 *
 * The binning stats cut rows on ggplot2's **fuzzy** break grid, so a value
 * inside the fuzz band (1e-8 × median gap) around an interior break is
 * summarized into one bin while the exact-edge predicates that lineage used
 * claimed the neighbouring one. Represented rows must match the rows the stat
 * actually consumed, for both closed sides and for `bin` as well as
 * `summary_bin`.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { RenderModel } from "../../src/pipeline/types-render-model.ts";
import { size } from "./fixtures.ts";

/** Represented source rows per mark, keyed by the mark's semantic x. */
function lineageByX(model: RenderModel): Map<number, number[]> {
  const byX = new Map<number, number[]>();
  for (let id = 0; id < model.candidates.size; id++) {
    const candidate = model.candidates.candidate(id);
    if (candidate === null || typeof candidate.xValue !== "number") continue;
    byX.set(
      candidate.xValue,
      [...model.lineage.keys(candidate.lineage)].toSorted((a, b) => a - b),
    );
  }
  return byX;
}

describe("summary_bin bin-edge lineage (#905)", () => {
  // binwidth 1 + boundary 0 puts breaks on integers; fuzz = 1e-8 × 1.
  // x=1+1e-9 sits inside the fuzz band ABOVE break 1, so right-closed
  // cutting keeps it in (0,1] — the bin centered at 0.5.
  const rightData = { x: [0.5, 1 + 1e-9, 1.5], y: [10, 20, 30] };

  it("attributes a fuzz-band row to the bin whose summary consumed it", () => {
    const model = runPipeline(
      gg(rightData, aes({ x: "x", y: "y" }))
        .geomPoint({ stat: "summary_bin", binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    const byX = lineageByX(model);
    // Bin (0,1] summarized rows 0 and 1 → mean(10,20) = 15.
    const lowMark = model.candidates.candidate(0);
    expect(lowMark?.yValue).toBe(15);
    expect(byX.get(0.5)).toEqual([0, 1]);
    // Bin (1,2] summarized row 2 only → 30.
    expect(byX.get(1.5)).toEqual([2]);
  });

  it("mirrors for closed:left (fuzz band below an interior break)", () => {
    // Left-closed fuzzes interior breaks DOWN, so a value just below break 1
    // stays in [1,2) rather than falling back into [0,1).
    const leftData = { x: [0.5, 1 - 1e-9, 1.5], y: [10, 20, 30] };
    const model = runPipeline(
      gg(leftData, aes({ x: "x", y: "y" }))
        .geomPoint({ stat: "summary_bin", binwidth: 1, boundary: 0, closed: "left" })
        .spec(),
      size,
    );
    const byX = lineageByX(model);
    // [1,2) consumed rows 1 and 2 → mean(20,30) = 25; [0,1) only row 0.
    expect(byX.get(0.5)).toEqual([0]);
    expect(byX.get(1.5)).toEqual([1, 2]);
  });

  it("keeps a row exactly on an interior break in exactly one bin", () => {
    const onBreak = { x: [0.5, 1, 1.5], y: [10, 20, 30] };
    for (const closed of ["right", "left"] as const) {
      const model = runPipeline(
        gg(onBreak, aes({ x: "x", y: "y" }))
          .geomPoint({ stat: "summary_bin", binwidth: 1, boundary: 0, closed })
          .spec(),
        size,
      );
      const claims = [...lineageByX(model).values()].flat().filter((row) => row === 1);
      expect(claims).toEqual([1]);
    }
  });

  it("keeps finite-x rows with non-finite y in lineage (#901 contract)", () => {
    // Row 1 has finite x but null y: the stat drops it from the summary, but it
    // is still a represented row of the bin it falls in.
    const withNull = { x: [0.5, 0.7, 1.5], y: [10, null, 30] };
    const model = runPipeline(
      gg(withNull, aes({ x: "x", y: "y" }))
        .geomPoint({ stat: "summary_bin", binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    expect(lineageByX(model).get(0.5)).toEqual([0, 1]);
  });
});

describe("stat_bin bin-edge lineage (#905)", () => {
  it("attributes a fuzz-band row to the bin that counted it", () => {
    const model = runPipeline(
      gg({ x: [0.5, 1 + 1e-9, 1.5] }, aes({ x: "x" }))
        .geomHistogram({ binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    const byX = lineageByX(model);
    // The fuzz-band row is counted in (0,1], so lineage must agree.
    expect(byX.get(0.5)).toEqual([0, 1]);
    expect(byX.get(1.5)).toEqual([2]);
  });
});

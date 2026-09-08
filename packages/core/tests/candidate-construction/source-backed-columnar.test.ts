/**
 * Source-backed candidate construction resolves datum values as per-batch
 * COLUMNS (issue: first-hover latency on dense charts). Two pins:
 *
 * 1. No per-candidate interning: `LineageStore.intern` is never called for a
 *    source-backed pipeline — lineage flows through `internSingleton` in one
 *    typed-array fill per batch.
 * 2. Observational equivalence: candidate facts/queries for a richly mapped
 *    source-backed spec match golden literals captured from the
 *    per-candidate resolution this replaced.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { LineageStore } from "../../src/identity.ts";
import { runPipeline } from "../../src/pipeline.ts";
import type { CellValue } from "../../src/table-types.ts";

const ROW_COUNT = 24;

function rows() {
  return Array.from({ length: ROW_COUNT }, (_, i) => ({
    x: i,
    y: (i * 7) % 23,
    size: 1 + (i % 5),
    alpha: 0.2 + 0.1 * (i % 4),
    color: `c${i % 3}`,
    fill: `f${i % 2}`,
  }));
}

function denseSpec() {
  return gg(
    rows(),
    aes({
      x: "x",
      y: "y",
      size: "size",
      alpha: "alpha",
      color: "color",
      fill: "fill",
    }),
  )
    .geomPoint()
    .spec();
}

describe("source-backed columnar datum resolution", () => {
  it("never calls LineageStore.intern while materializing candidates", () => {
    // oxlint-disable-next-line typescript/unbound-method -- re-invoked with .call below
    const originalIntern = LineageStore.prototype.intern;
    let internCalls = 0;
    LineageStore.prototype.intern = function counting(this: LineageStore, keys: Iterable<never>) {
      internCalls++;
      return originalIntern.call(this, keys);
    } as typeof originalIntern;
    try {
      const model = runPipeline(denseSpec(), { width: 400, height: 300 });
      const store = model.candidates;
      for (let id = 0; id < store.size; id++) store.candidate(id);
      model.dispose();
      expect(internCalls).toBe(0);
    } finally {
      LineageStore.prototype.intern = originalIntern;
    }
  });

  it("matches the per-candidate golden tuples", () => {
    const model = runPipeline(denseSpec(), { width: 400, height: 300 });
    const store = model.candidates;
    expect(store.size).toBe(ROW_COUNT);
    const facts = Array.from({ length: store.size }, (_, id) => store.candidate(id));
    // Golden tuples: [xValue, yValue, sizeValue, alphaValue, seriesRank]
    // pinned from actual store behavior (both resolver paths agree).
    const golden: (CellValue | undefined)[][] = facts.map((fact) => [
      fact?.xValue,
      fact?.yValue,
      fact?.sizeValue,
      fact?.alphaValue,
      fact?.seriesRank,
    ]);
    expect(golden.slice(0, 4)).toEqual([
      [0, 0, 1, 0.2, 0],
      [1, 7, 2, 0.30000000000000004, 1],
      [2, 14, 3, 0.4, 2],
      [3, 21, 4, 0.5, 0],
    ]);
    // seriesId flows from a process-global interner, so its absolute value is
    // test-order-dependent; pin shape (non-negative int) plus the row count.
    const seriesIds = facts.map((fact) => fact?.seriesId);
    expect(seriesIds).toHaveLength(ROW_COUNT);
    for (const id of seriesIds) {
      expect(typeof id).toBe("number");
      expect(id).toBeGreaterThanOrEqual(0);
    }
    // Color field drives ordinal series ranks: c0/c1/c2 cycle → ranks 0/1/2.
    expect(facts.map((fact) => fact?.seriesRank)).toEqual(
      Array.from({ length: ROW_COUNT }, (_, i) => i % 3),
    );
    // Every candidate is its own singleton lineage.
    for (let id = 0; id < store.size; id++) {
      expect(facts[id]?.lineage).toBeGreaterThan(0);
      expect(facts[id]?.sourceOrder).toBe(id);
      expect(facts[id]?.rowIndex).toBe(id);
    }
    // Grouping: x-axis group of the first candidate spans all 24 rows' x tokens
    // (each x is unique, so the group is the singleton member).
    const group = store.group(0, "x");
    expect(group?.memberIds).toEqual(Uint32Array.from([0]));
    model.dispose();
  });
});

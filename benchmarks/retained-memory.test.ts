import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import {
  assertWithinBudget,
  findMemoryBudget,
  findRetainedWorkload,
  createGroupedInspectionRetentionFixture,
  median,
} from "./retained-memory";

describe("retained-memory release gate", () => {
  it("rejects an empty median input", () => {
    expect(() => median([])).toThrow("median requires at least one sample");
  });

  it("computes odd and rounded-even medians without mutating the samples", () => {
    const odd = [9, 1, 5];
    const even = [8, 1, 2, 3];
    expect(median(odd)).toBe(5);
    expect(median(even)).toBe(3);
    expect(odd).toEqual([9, 1, 5]);
    expect(even).toEqual([8, 1, 2, 3]);
  });

  it("fails loudly when the retained-memory workload is missing", () => {
    expect(() => findRetainedWorkload([{ id: "another workload", fn: () => null }])).toThrow(
      "retained-memory workload is missing",
    );
  });

  it("fails loudly when the retained-memory baseline is missing", () => {
    expect(() => findMemoryBudget({ version: 1, baselines: {} }, "missing result")).toThrow(
      "missing memory baseline for missing result",
    );
  });

  it("rejects an over-budget result and accepts the exact boundary", () => {
    expect(() => {
      assertWithinBudget({ name: "scatter", value: 101 }, { maxRetainedBytes: 100 });
    }).toThrow("scatter retained 101 bytes; budget is 100");
    expect(() => {
      assertWithinBudget({ name: "scatter", value: 100 }, { maxRetainedBytes: 100 });
    }).not.toThrow();
  });

  it("enforces a checked-in 20% regression threshold below the absolute ceiling", () => {
    const budget = {
      maxRetainedBytes: 16 * 1024 * 1024,
      baselineRetainedBytes: 1_000,
      maxRegressionRatio: 1.2,
    };
    expect(() => {
      assertWithinBudget({ name: "grouped", value: 1_201 }, budget);
    }).toThrow("grouped retained 1201 bytes; budget is 1200");
    expect(() => {
      assertWithinBudget({ name: "grouped", value: 1_200 }, budget);
    }).not.toThrow();
  });

  it("retains one bounded transient plus one complete 1k grouped snapshot", () => {
    const fixture = createGroupedInspectionRetentionFixture();
    expect(fixture.model.candidates.size).toBe(1_000);
    expect(fixture.model.candidates.x.byteLength).toBe(1_000 * Float32Array.BYTES_PER_ELEMENT);
    expect(fixture.model.candidates.y.byteLength).toBe(1_000 * Float32Array.BYTES_PER_ELEMENT);
    expect(fixture.model.lineage.size).toBe(1_001);
    expect(fixture.model.candidates.group(0, "x")?.memberIds).toHaveLength(1_000);
    expect(fixture.transient.snapshot.members).toHaveLength(8);
    expect(fixture.pinned.snapshot.members).toHaveLength(1_000);
    expect(fixture.coordinator.memoSize).toBe(2);
    fixture.model.dispose();
  });

  it("budgets the grouped two-slot retained case", () => {
    const budget = findMemoryBudget(
      JSON.parse(
        readFileSync(new URL("./memory-baselines.json", import.meta.url), "utf8"),
      ) as never,
      "grouped inspection 1k two-slot retained",
    );
    expect(budget.maxRetainedBytes).toBe(16 * 1024 * 1024);
    expect(budget.baselinePlatform).toBe("linux-x64-bun-1.4.2");
    expect(budget.baselineRetainedBytes).toBeGreaterThanOrEqual(2_392_452);
    expect(budget.maxRegressionRatio).toBe(1.2);
  });
});

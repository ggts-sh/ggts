/**
 * Hoist source-backed candidate row locate once per mark (issue #1308).
 *
 * Seams:
 * - SourceRegistry.locate call volume while materializing candidates
 * - Candidate datum fields (x/y, style channels, seriesId/seriesRank)
 *
 * Source-backed resolvers used to re-locate the same global row for groupFor
 * and every mapped field read (up to ~10 times per mark). One locate per mark
 * is enough; colour/fill ranks keep null-checked lazy reads over the hoisted
 * located row.
 */
import { describe, expect, it, spyOn } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import { SourceRegistry } from "../../src/pipeline/source-registry.ts";
import { size } from "./fixtures.ts";

const ROW_COUNT = 12;

function multiMappedPointValues() {
  return Array.from({ length: ROW_COUNT }, (_, i) => ({
    x: i,
    y: i * 2,
    size: 1 + (i % 5),
    alpha: 0.2 + 0.1 * (i % 4),
    color: `c${i % 3}`,
    fill: `f${i % 2}`,
  }));
}

function countLocateCalls(fn: () => void): number {
  const desc = Object.getOwnPropertyDescriptor(SourceRegistry.prototype, "locate");
  if (desc?.value === undefined) {
    throw new Error("SourceRegistry.prototype.locate is not a data property");
  }
  const impl = desc.value as (
    this: SourceRegistry,
    globalIndex: number,
  ) => { table: unknown; localRow: number } | null;
  let calls = 0;
  const spy = spyOn(SourceRegistry.prototype, "locate").mockImplementation(function (
    this: SourceRegistry,
    globalIndex: number,
  ) {
    calls += 1;
    return impl.call(this, globalIndex);
  });
  try {
    fn();
    return calls;
  } finally {
    spy.mockRestore();
  }
}

describe("source-backed candidate locate once (#1308)", () => {
  it("keeps mapped datum fields identical after a single locate per mark", () => {
    const values = multiMappedPointValues();
    const model = runPipeline(
      gg(
        values,
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
        .spec(),
      size,
    );

    expect(model.candidates.size).toBe(ROW_COUNT);
    for (let i = 0; i < ROW_COUNT; i++) {
      const candidate = model.candidates.candidate(i);
      expect(candidate).not.toBeNull();
      const row = values[i]!;
      expect(candidate!.xValue).toBe(row.x);
      expect(candidate!.yValue).toBe(row.y);
      expect(candidate!.sizeValue).toBe(row.size);
      expect(candidate!.alphaValue).toBe(row.alpha);
      expect(candidate!.sourceOrder).toBe(i);
      // Discrete colour/fill ranks are non-negative ordinal assignment ranks.
      expect(candidate!.seriesRank).toBeGreaterThanOrEqual(0);
      expect(candidate!.seriesId).toBeGreaterThanOrEqual(0);
    }

    // Colour categories c0,c1,c2 first-seen → ranks 0,1,2 for the first three
    // rows (same colour field drives seriesRank when ordinal colour applies).
    expect(model.candidates.candidate(0)!.seriesRank).toBe(0);
    expect(model.candidates.candidate(1)!.seriesRank).toBe(1);
    expect(model.candidates.candidate(2)!.seriesRank).toBe(2);
    expect(model.candidates.candidate(3)!.seriesRank).toBe(0);
  });

  it("locates each source row at most once while materializing candidates", () => {
    const values = multiMappedPointValues();
    const model = runPipeline(
      gg(
        values,
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
        .spec(),
      size,
    );

    const locateCalls = countLocateCalls(() => {
      // Deferred store: first query builds indexes and resolves every datum.
      for (let i = 0; i < model.candidates.size; i++) {
        model.candidates.candidate(i);
      }
    });

    // At most one locate per mark — not one per field + groupFor (was ~7×
    // here). The columnar resolver does far better on contiguous batches: a
    // first/last probe (2 calls) proves the whole run's table ownership, so
    // NO per-row locate happens at all.
    expect(locateCalls).toBeLessThanOrEqual(model.candidates.size);
    expect(locateCalls).toBeLessThanOrEqual(2);
  });
});

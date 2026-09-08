/**
 * Hoist aggregate lineage x key views once per frame (issue #1307).
 *
 * Seams:
 * - resolveAggregateLineageXView + aggregateLineageXKey (byte-identical keys)
 * - buildCandidateIdentityIndex (column/parsed derivations O(frames), not O(rows))
 */
import { describe, expect, it, spyOn } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { ColumnTable } from "../../src/table.ts";
import { size, countColumnReads } from "./fixtures.ts";

const ROW_COUNT = 40;

describe("aggregate lineage x-key hoist (#1307)", () => {
  it("keeps raw count group×x keys byte-identical after hoist", async () => {
    const { preparePanels } = await import("../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../src/pipeline/candidate-construction/identity-index.ts");
    const { aggregateLineageXKey, resolveAggregateLineageXView } =
      await import("../../src/pipeline/candidate-construction/identity-buckets.ts");
    const { bandKey } = await import("../../src/scales/train.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const values = Array.from({ length: ROW_COUNT }, (_, i) => ({
      x: (i % 5) + 1,
    }));
    const prepared = preparePanels(
      normalize(
        gg(values, aes({ x: "x" }))
          .geomBar()
          .spec(),
      ),
      size,
      [],
      [],
    );
    const frame = prepared.panelFrames[0]![0]!;
    const field = frame.binding.xField!;
    const view = resolveAggregateLineageXView(frame.table, field, frame.binding);

    for (let localRow = 0; localRow < frame.inputGroups.length; localRow++) {
      expect(aggregateLineageXKey(frame.table, field, localRow, frame.binding, view)).toBe(
        aggregateLineageXKey(frame.table, field, localRow, frame.binding),
      );
    }

    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    for (let level = 1; level <= 5; level++) {
      const key = `0:0:0:${bandKey(level)}`;
      const expected = values.map((row, i) => (row.x === level ? i : -1)).filter((i) => i >= 0);
      expect(index.sourceRowsByGroupX.get(key)).toEqual(expected);
    }
  });

  it("keeps temporal summary group×x keys byte-identical after hoist", async () => {
    const { preparePanels } = await import("../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../src/pipeline/candidate-construction/identity-index.ts");
    const { aggregateLineageXKey, resolveAggregateLineageXView } =
      await import("../../src/pipeline/candidate-construction/identity-buckets.ts");
    const { bandKey } = await import("../../src/scales/train.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const values = [
      { when: "1/2/2025", value: 1 },
      { when: "01/02/2025", value: 3 },
      { when: "02/02/2025", value: 5 },
      { when: "03/02/2025", value: 7 },
    ];
    const prepared = preparePanels(
      normalize(
        gg(values, aes({ x: "when", y: "value" }))
          .geomErrorbar({ stat: "summary" })
          .scaleXDate({ parse: "dmy", nice: false })
          .spec(),
      ),
      size,
      [],
      [],
    );
    const frame = prepared.panelFrames[0]![0]!;
    const field = frame.binding.xField!;
    const view = resolveAggregateLineageXView(frame.table, field, frame.binding);

    for (let localRow = 0; localRow < frame.inputGroups.length; localRow++) {
      expect(aggregateLineageXKey(frame.table, field, localRow, frame.binding, view)).toBe(
        aggregateLineageXKey(frame.table, field, localRow, frame.binding),
      );
    }

    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    const day1 = bandKey(Date.UTC(2025, 1, 1));
    const day2 = bandKey(Date.UTC(2025, 1, 2));
    const day3 = bandKey(Date.UTC(2025, 1, 3));
    expect(index.sourceRowsByGroupX.get(`0:0:0:${day1}`)).toEqual([0, 1]);
    expect(index.sourceRowsByGroupX.get(`0:0:0:${day2}`)).toEqual([2]);
    expect(index.sourceRowsByGroupX.get(`0:0:0:${day3}`)).toEqual([3]);
  });

  it("keeps binned count group×x keys byte-identical after hoist", async () => {
    const { preparePanels } = await import("../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../src/pipeline/candidate-construction/identity-index.ts");
    const { aggregateLineageXKey, resolveAggregateLineageXView } =
      await import("../../src/pipeline/candidate-construction/identity-buckets.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const values = Array.from({ length: 12 }, (_, i) => ({ x: i }));
    const prepared = preparePanels(
      normalize({
        data: { values },
        layers: [{ geom: "bar", aes: { x: { field: "x" } }, stat: "count" }],
        scales: { x: { type: "binned", breaks: [0, 4, 8, 12] } },
      }),
      size,
      [],
      [],
    );
    const frame = prepared.panelFrames[0]![0]!;
    expect(frame.binding.xBinning).toBeDefined();
    const field = frame.binding.xField!;
    const view = resolveAggregateLineageXView(frame.table, field, frame.binding);

    for (let localRow = 0; localRow < frame.inputGroups.length; localRow++) {
      expect(aggregateLineageXKey(frame.table, field, localRow, frame.binding, view)).toBe(
        aggregateLineageXKey(frame.table, field, localRow, frame.binding),
      );
    }

    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    expect(index.sourceRowsByGroupX.size).toBeGreaterThan(0);
    // Every input row lands in some group×x bucket (no silent key drift).
    const covered = new Set<number>();
    for (const rows of index.sourceRowsByGroupX.values()) {
      for (const row of rows) covered.add(row);
    }
    expect([...covered].toSorted((a, b) => a - b)).toEqual(
      Array.from({ length: values.length }, (_, i) => i),
    );
  });

  it("reads the raw x column once per frame while building the identity index", async () => {
    const { preparePanels } = await import("../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../src/pipeline/candidate-construction/identity-index.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const values = Array.from({ length: ROW_COUNT }, (_, i) => ({ x: (i % 5) + 1 }));
    const prepared = preparePanels(
      normalize(
        gg(values, aes({ x: "x" }))
          .geomBar()
          .spec(),
      ),
      size,
      [],
      [],
    );

    const reads = countColumnReads("x", () => {
      buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    });
    // Hoisted view: one column() for the frame, not one per input row.
    expect(reads).toBeLessThanOrEqual(1);
    expect(reads).toBeGreaterThan(0);
  });

  it("parses the temporal x column once per frame while building the identity index", async () => {
    const { preparePanels } = await import("../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../src/pipeline/candidate-construction/identity-index.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const values = Array.from({ length: ROW_COUNT }, (_, i) => ({
      when: `${String((i % 28) + 1).padStart(2, "0")}/02/2025`,
      value: i,
    }));
    const prepared = preparePanels(
      normalize(
        gg(values, aes({ x: "when", y: "value" }))
          .geomErrorbar({ stat: "summary" })
          .scaleXDate({ parse: "dmy", nice: false })
          .spec(),
      ),
      size,
      [],
      [],
    );

    const desc = Object.getOwnPropertyDescriptor(ColumnTable.prototype, "parsed");
    if (desc?.value === undefined) {
      throw new Error("ColumnTable.prototype.parsed is not a data property");
    }
    const impl = desc.value as (
      this: ColumnTable,
      name: string,
      parser?: unknown,
      options?: unknown,
    ) => unknown;
    let parsedCalls = 0;
    const spy = spyOn(ColumnTable.prototype, "parsed").mockImplementation(function (
      this: ColumnTable,
      name: string,
      parser?: unknown,
      options?: unknown,
    ) {
      if (name === "when") parsedCalls += 1;
      return impl.call(this, name, parser, options);
    });
    try {
      buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    } finally {
      spy.mockRestore();
    }
    // Semantic temporal arm: one parsed() for the frame, not one per row.
    expect(parsedCalls).toBeLessThanOrEqual(1);
    expect(parsedCalls).toBeGreaterThan(0);
  });
});

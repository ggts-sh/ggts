/**
 * Finite-y lineage cache — summary / boxplot group×x (issue #216 / #503).
 */
import { describe, expect, it } from "bun:test";

import { runPipeline } from "../../../src/pipeline.ts";
import { size } from "./fixtures.ts";

describe("finite-y cache: summary and boxplot", () => {
  it("summary finite-y cache matches pure filter after group×x resolve", async () => {
    const { preparePanels } = await import("../../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../../src/pipeline/candidate-construction/identity-index.ts");
    const { resolveRepresentedSourceRows } =
      await import("../../../src/pipeline/candidate-construction/datum.ts");
    const { filterRepresentedSourceRows } =
      await import("../../../src/pipeline/candidate-construction/represented-rows.ts");
    const { LineageStore } = await import("../../../src/identity.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const prepared = preparePanels(
      normalize({
        data: {
          values: [
            { g: "a", y: 1 },
            { g: "a", y: Number.NaN },
            { g: "a", y: 3 },
            { g: "b", y: 4 },
          ],
        },
        layers: [
          {
            geom: "pointrange",
            stat: "summary",
            aes: { x: { field: "g" }, y: { field: "y" } },
          },
        ],
      }),
      size,
      [],
      [],
    );
    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    expect(index.sourceRowsByGroupY.get("0:0:0")).toEqual([0, 2]);
    expect(index.sourceRowsByGroupY.get("0:0:1")).toEqual([3]);

    const frame = prepared.panelFrames[0]![0]!;
    const lineage = new LineageStore<number>();
    for (let frameRow = 0; frameRow < frame.n; frameRow++) {
      const group = frame.groups[frameRow] ?? 0;
      const viaIndex = resolveRepresentedSourceRows({
        outlierSourceRow: null,
        sourceRow: null,
        group,
        panelIndex: 0,
        layerIndex: 0,
        sourceRowsByGroup: index.sourceRowsByGroup,
        sourceRowsByGroupX: index.sourceRowsByGroupX,
        sourceRowsByGroupBin: index.sourceRowsByGroupBin,
        sourceRowsByGroupY: index.sourceRowsByGroupY,
        frame,
        table: prepared.table,
        frameRow,
        lineage,
        primitiveIndex: frameRow,
      });
      const baseRows = index.sourceRowsByGroup.get(`0:0:${group}`) ?? [];
      const viaFilter = filterRepresentedSourceRows({
        frame,
        table: prepared.table,
        frameRow,
        baseRows,
      });
      expect(viaIndex.representedRows).toEqual(viaFilter);
    }
  });

  it("summary/boxplot group×x buckets prefilter finite y for O(1) resolve", async () => {
    const { preparePanels } = await import("../../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../../src/pipeline/candidate-construction/identity-index.ts");
    const { filterRepresentedSourceRows, filterAggregateXRows, filterAggregateYRows } =
      await import("../../../src/pipeline/candidate-construction/represented-rows.ts");
    const { resolveRepresentedSourceRows } =
      await import("../../../src/pipeline/candidate-construction/datum.ts");
    const { bandKey } = await import("../../../src/scales/train.ts");
    const { LineageStore } = await import("../../../src/identity.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const prepared = preparePanels(
      normalize({
        data: {
          values: [
            { g: "a", y: 1 },
            { g: "a", y: Number.NaN },
            { g: "a", y: 3 },
            { g: "b", y: Number.NaN },
            { g: "b", y: null },
            { g: "c", y: 9 },
          ],
        },
        layers: [
          {
            geom: "pointrange",
            stat: "summary",
            aes: { x: { field: "g" }, y: { field: "y" } },
          },
        ],
      }),
      size,
      [],
      [],
    );
    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    const groupA = "0:0:0";
    const groupB = "0:0:1";
    const groupC = "0:0:2";

    // Finite-y prefilter at build (NaN/null y excluded); empty bucket still present for b.
    expect(index.sourceRowsByGroupX.get(`${groupA}:${bandKey("a")}`)).toEqual([0, 2]);
    expect(index.sourceRowsByGroupX.get(`${groupB}:${bandKey("b")}`)).toEqual([]);
    expect(index.sourceRowsByGroupX.get(`${groupC}:${bandKey("c")}`)).toEqual([5]);

    // Parity with pure x then y filter (no index).
    const baseA = index.sourceRowsByGroup.get(groupA) ?? [];
    const pureA = filterAggregateYRows({
      table: prepared.table,
      field: "y",
      baseRows: filterAggregateXRows({
        table: prepared.table,
        field: "g",
        outputX: "a",
        baseRows: baseA,
      }),
    });
    expect(index.sourceRowsByGroupX.get(`${groupA}:${bandKey("a")}`)).toEqual(pureA);

    const frame = prepared.panelFrames[0]![0]!;
    const lineage = new LineageStore<number>();
    const lineageByX = new Map<string, number>();
    for (let frameRow = 0; frameRow < frame.n; frameRow++) {
      const group = frame.groups[frameRow] ?? 0;
      const outputX = frame.xValues?.[frameRow] ?? frame.xNumeric?.[frameRow] ?? null;
      const expected = index.sourceRowsByGroupX.get(`0:0:${group}:${bandKey(outputX)}`);
      expect(expected).toBeDefined();

      const viaIndex = filterRepresentedSourceRows({
        frame,
        table: prepared.table,
        frameRow,
        baseRows: index.sourceRowsByGroup.get(`0:0:${group}`) ?? [],
        group,
        panelIndex: 0,
        layerIndex: 0,
        sourceRowsByGroupX: index.sourceRowsByGroupX,
      });
      // Shared frozen bucket — no per-mark y re-filter allocation.
      expect(viaIndex).toBe(expected);

      const viaFilter = filterRepresentedSourceRows({
        frame,
        table: prepared.table,
        frameRow,
        baseRows: index.sourceRowsByGroup.get(`0:0:${group}`) ?? [],
      });
      expect(viaIndex).toEqual(viaFilter);

      const resolved = resolveRepresentedSourceRows({
        outlierSourceRow: null,
        sourceRow: null,
        group,
        panelIndex: 0,
        layerIndex: 0,
        sourceRowsByGroup: index.sourceRowsByGroup,
        sourceRowsByGroupX: index.sourceRowsByGroupX,
        sourceRowsByGroupBin: index.sourceRowsByGroupBin,
        sourceRowsByGroupY: index.sourceRowsByGroupY,
        frame,
        table: prepared.table,
        frameRow,
        lineage,
        primitiveIndex: frameRow,
      });
      expect(resolved.representedRows).toBe(expected);
      const xKey = bandKey(outputX);
      const prior = lineageByX.get(xKey);
      if (prior === undefined) lineageByX.set(xKey, resolved.lineageKey);
      else expect(resolved.lineageKey).toBe(prior);
    }

    // Empty all-non-finite bucket interns as empty lineage, not a miss/fallback.
    expect(lineage.count(lineageByX.get(bandKey("b"))!)).toBe(0);
  });

  it("boxplot group×x drops non-finite y and reuses frozen bucket on resolve", async () => {
    const { preparePanels } = await import("../../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../../src/pipeline/candidate-construction/identity-index.ts");
    const { filterRepresentedSourceRows } =
      await import("../../../src/pipeline/candidate-construction/represented-rows.ts");
    const { bandKey } = await import("../../../src/scales/train.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const prepared = preparePanels(
      normalize({
        data: {
          values: [
            { group: "a", y: 1 },
            { group: "a", y: 2 },
            { group: "a", y: 3 },
            { group: "a", y: null },
            { group: "a", y: 100 },
          ],
        },
        layers: [
          {
            geom: "boxplot",
            stat: "boxplot",
            aes: { x: { field: "group" }, y: { field: "y" } },
          },
        ],
      }),
      size,
      [],
      [],
    );
    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    const bucket = index.sourceRowsByGroupX.get(`0:0:0:${bandKey("a")}`);
    // null y (row 3) excluded at build; finite y retained in first-seen order.
    expect(bucket).toEqual([0, 1, 2, 4]);
    const frame = prepared.panelFrames[0]![0]!;
    for (let frameRow = 0; frameRow < frame.n; frameRow++) {
      const viaIndex = filterRepresentedSourceRows({
        frame,
        table: prepared.table,
        frameRow,
        baseRows: index.sourceRowsByGroup.get("0:0:0") ?? [],
        group: 0,
        panelIndex: 0,
        layerIndex: 0,
        sourceRowsByGroupX: index.sourceRowsByGroupX,
      });
      expect(viaIndex).toBe(bucket);
    }

    // Pipeline: non-outlier box candidates share one lineage membership.
    const model = runPipeline(
      {
        data: {
          values: [
            { group: "a", y: 1 },
            { group: "a", y: 2 },
            { group: "a", y: 3 },
            { group: "a", y: null },
            { group: "a", y: 100 },
          ],
        },
        layers: [
          {
            geom: "boxplot",
            stat: "boxplot",
            aes: { x: { field: "group" }, y: { field: "y" } },
          },
        ],
      },
      size,
    );
    const candidates = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    ).flatMap((candidate) => (candidate === null ? [] : [candidate]));
    const boxes = candidates.filter((candidate) => candidate.kind !== "points");
    expect(boxes.length).toBeGreaterThan(0);
    const refs = new Set(boxes.map((candidate) => candidate.lineage));
    expect(refs.size).toBe(1);
    expect([...model.lineage.keys(boxes[0]!.lineage)].toSorted((a, b) => a - b)).toEqual([
      0, 1, 2, 4,
    ]);
  });
});

/**
 * Finite-y lineage cache — smooth evaluation-grid path (issue #216 / #503).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../../../src/pipeline.ts";
import { size } from "./fixtures.ts";

describe("finite-y cache: smooth path", () => {
  it("precomputes finite-y source rows once per group for smooth layers", async () => {
    const { preparePanels } = await import("../../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../../src/pipeline/candidate-construction/identity-index.ts");
    const { filterAggregateYRows } =
      await import("../../../src/pipeline/candidate-construction/represented-rows.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const prepared = preparePanels(
      normalize({
        data: {
          values: [
            { x: 1, y: 10 },
            { x: 2, y: 20 },
            { x: 3, y: Number.NaN },
            { x: 4, y: 40 },
          ],
        },
        layers: [
          {
            geom: "smooth",
            stat: "smooth",
            aes: { x: { field: "x" }, y: { field: "y" } },
            params: { method: "lm", n: 5 },
          },
        ],
      }),
      size,
      [],
      [],
    );
    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    const groupKey = "0:0:0";
    const baseRows = index.sourceRowsByGroup.get(groupKey) ?? [];
    expect(baseRows.toSorted((a, b) => a - b)).toEqual([0, 1, 2, 3]);

    const viaFilter = filterAggregateYRows({
      table: prepared.table,
      field: "y",
      baseRows,
    });
    // Non-finite y (row 2) must be excluded; cache must match pure filter.
    expect(viaFilter).toEqual([0, 1, 3]);
    expect(index.sourceRowsByGroupY.get(groupKey)).toEqual(viaFilter);
  });

  it("filterRepresentedSourceRows reuses finite-y cache for every smooth mark", async () => {
    const { preparePanels } = await import("../../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../../src/pipeline/candidate-construction/identity-index.ts");
    const { filterRepresentedSourceRows } =
      await import("../../../src/pipeline/candidate-construction/represented-rows.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const prepared = preparePanels(
      normalize({
        data: {
          values: [
            { x: 1, y: 10 },
            { x: 2, y: 20 },
            { x: 3, y: Number.NaN },
            { x: 4, y: 40 },
          ],
        },
        layers: [
          {
            geom: "smooth",
            stat: "smooth",
            aes: { x: { field: "x" }, y: { field: "y" } },
            params: { method: "lm", n: 5 },
          },
        ],
      }),
      size,
      [],
      [],
    );
    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    const frame = prepared.panelFrames[0]![0]!;
    const baseRows = index.sourceRowsByGroup.get("0:0:0") ?? [];
    const expected = index.sourceRowsByGroupY.get("0:0:0");
    expect(expected).toEqual([0, 1, 3]);

    // Every evaluation-grid mark must resolve to the same finite-y list.
    expect(frame.n).toBeGreaterThan(1);
    for (let frameRow = 0; frameRow < frame.n; frameRow++) {
      const viaIndex = filterRepresentedSourceRows({
        frame,
        table: prepared.table,
        frameRow,
        baseRows,
        group: 0,
        panelIndex: 0,
        layerIndex: 0,
        sourceRowsByGroupY: index.sourceRowsByGroupY,
      });
      const viaFilter = filterRepresentedSourceRows({
        frame,
        table: prepared.table,
        frameRow,
        baseRows,
      });
      expect(viaIndex).toEqual(viaFilter);
      expect(viaIndex).toEqual(expected);
      // Shared frozen array — no per-mark re-filter allocation.
      expect(viaIndex).toBe(expected);
    }
  });

  it("resolveRepresentedSourceRows matches pure filter and reuses lineage for smooth marks", async () => {
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
            { x: 1, y: 10 },
            { x: 2, y: 20 },
            { x: 3, y: Number.NaN },
            { x: 4, y: 40 },
          ],
        },
        layers: [
          {
            geom: "smooth",
            stat: "smooth",
            aes: { x: { field: "x" }, y: { field: "y" } },
            params: { method: "lm", n: 8 },
          },
        ],
      }),
      size,
      [],
      [],
    );
    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    const frame = prepared.panelFrames[0]![0]!;
    const lineage = new LineageStore<number>();
    const baseRows = index.sourceRowsByGroup.get("0:0:0") ?? [];

    const lineageKeys: number[] = [];
    for (let frameRow = 0; frameRow < frame.n; frameRow++) {
      const viaIndex = resolveRepresentedSourceRows({
        outlierSourceRow: null,
        sourceRow: null,
        group: 0,
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
      const viaFilter = filterRepresentedSourceRows({
        frame,
        table: prepared.table,
        frameRow,
        baseRows,
      });
      expect(viaIndex.representedRows).toEqual(viaFilter);
      expect(viaIndex.representedRows).toEqual([0, 1, 3]);
      lineageKeys.push(viaIndex.lineageKey);
    }
    expect(frame.n).toBeGreaterThan(1);
    // All evaluation-grid marks share one interned lineage membership.
    expect(new Set(lineageKeys).size).toBe(1);
    expect([...lineage.keys(lineageKeys[0]!)].toSorted((a, b) => a - b)).toEqual([0, 1, 3]);
  });

  it("pipeline smooth candidates share one lineage membership per group", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 10 },
          { x: 2, y: 20 },
          { x: 3, y: null },
          { x: 4, y: 40 },
          { x: 5, y: 50 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomSmooth({ method: "lm", n: 10 })
        .spec(),
      size,
    );
    const candidates = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    ).flatMap((candidate) => (candidate === null ? [] : [candidate]));
    expect(candidates.length).toBeGreaterThan(1);
    const first = candidates[0];
    if (first === undefined) throw new Error("expected at least one smooth candidate");
    const lineageRefs = new Set(candidates.map((candidate) => candidate.lineage));
    expect(lineageRefs.size).toBe(1);
    const keys = [...model.lineage.keys(first.lineage)].toSorted((a, b) => a - b);
    // Row 2 has null y and is not represented by the smooth fit lineage.
    expect(keys).toEqual([0, 1, 3, 4]);
  });
});

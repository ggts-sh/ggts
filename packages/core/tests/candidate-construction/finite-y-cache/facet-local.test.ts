/**
 * Finite-y lineage cache — faceted panel-local indexing (issue #216 / #503).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { size } from "./fixtures.ts";

describe("finite-y cache: facet local rows", () => {
  it("finite-y cache uses panel-local y values under facet wrap", async () => {
    const { preparePanels } = await import("../../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../../src/pipeline/candidate-construction/identity-index.ts");
    const { filterRepresentedSourceRows } =
      await import("../../../src/pipeline/candidate-construction/represented-rows.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const prepared = preparePanels(
      normalize(
        gg(
          [
            { f: "A", x: 1, y: 10 },
            { f: "A", x: 2, y: null },
            { f: "A", x: 3, y: 30 },
            { f: "B", x: 1, y: 100 },
            { f: "B", x: 2, y: 200 },
          ],
          aes({ x: "x", y: "y" }),
        )
          .geomSmooth({ method: "lm", n: 4 })
          .facet({ wrap: "f" })
          .spec(),
      ),
      size,
      [],
      [],
    );
    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);

    // Panel B maps source rows 3,4 → panel-local 0,1. Cache must not index frame.table
    // with source-table indexes (that empties or corrupts the finite-y list).
    expect(index.sourceRowsByGroupY.get("0:0:0")).toEqual([0, 2]);
    expect(index.sourceRowsByGroupY.get("1:0:0")).toEqual([3, 4]);

    for (let panelIndex = 0; panelIndex < prepared.panelFrames.length; panelIndex++) {
      const frame = prepared.panelFrames[panelIndex]![0]!;
      const groupKey = `${panelIndex}:0:0`;
      const baseRows = index.sourceRowsByGroup.get(groupKey) ?? [];
      const viaFilter = filterRepresentedSourceRows({
        frame,
        table: prepared.table,
        frameRow: 0,
        baseRows,
      });
      expect(index.sourceRowsByGroupY.get(groupKey)).toEqual(viaFilter);
      const viaIndex = filterRepresentedSourceRows({
        frame,
        table: prepared.table,
        frameRow: 0,
        baseRows,
        group: 0,
        panelIndex,
        layerIndex: 0,
        sourceRowsByGroupY: index.sourceRowsByGroupY,
      });
      expect(viaIndex).toEqual(viaFilter);
      expect(viaIndex).toBe(index.sourceRowsByGroupY.get(groupKey));
    }
  });
});

/**
 * Finite-y lineage cache — count / non-finiteY layers (issue #216 / #503).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { size } from "./fixtures.ts";

describe("finite-y cache: count buckets", () => {
  it("does not build finite-y buckets for identity or count layers", async () => {
    const { preparePanels } = await import("../../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../../src/pipeline/candidate-construction/identity-index.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const prepared = preparePanels(
      normalize({
        data: {
          values: [
            { g: "a", y: 1 },
            { g: "b", y: 2 },
          ],
        },
        layers: [
          { geom: "point", aes: { x: { field: "g" }, y: { field: "y" } } },
          { geom: "bar", aes: { x: { field: "g" } }, stat: "count" },
        ],
      }),
      size,
      [],
      [],
    );
    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    expect(index.sourceRowsByGroupY.size).toBe(0);
  });

  it("count group×x reuses frozen bucket without clone (no y prefilter)", async () => {
    const { preparePanels } = await import("../../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../../src/pipeline/candidate-construction/identity-index.ts");
    const { filterRepresentedSourceRows } =
      await import("../../../src/pipeline/candidate-construction/represented-rows.ts");
    const { bandKey } = await import("../../../src/scales/train.ts");
    const { normalize } = await import("@ggts-sh/spec");

    // Count never sets finiteY — every source row stays in the group×x bucket.
    const prepared = preparePanels(
      normalize(
        gg([{ g: "a" }, { g: "a" }, { g: "a" }], aes({ x: "g" }))
          .geomBar()
          .spec(),
      ),
      size,
      [],
      [],
    );
    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    const bucket = index.sourceRowsByGroupX.get(`0:0:0:${bandKey("a")}`);
    expect(bucket).toEqual([0, 1, 2]);
    const frame = prepared.panelFrames[0]![0]!;
    const viaIndex = filterRepresentedSourceRows({
      frame,
      table: prepared.table,
      frameRow: 0,
      baseRows: index.sourceRowsByGroup.get("0:0:0") ?? [],
      group: 0,
      panelIndex: 0,
      layerIndex: 0,
      sourceRowsByGroupX: index.sourceRowsByGroupX,
    });
    expect(viaIndex).toBe(bucket);
  });
});

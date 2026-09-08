/**
 * Pre-stat inputGroups cache (issue #217).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";
import { size } from "./fixtures.ts";

describe("pre-stat inputGroups cache (issue #217)", () => {
  it("identity index buckets source rows from frame.inputGroups (not re-derived)", async () => {
    const { preparePanels } = await import("../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../src/pipeline/candidate-construction/identity-index.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const prepared = preparePanels(
      normalize(
        gg(
          [
            { g: "a", c: "x" },
            { g: "a", c: "y" },
            { g: "b", c: "x" },
          ],
          aes({ x: "g", fill: "c" }),
        )
          .geomBar()
          .spec(),
      ),
      size,
      [],
      [],
    );
    const frame = prepared.panelFrames[0]![0]!;
    // Replace cached pre-stat groups with a distinctive assignment; the index
    // must follow the cache (proves no second deriveLayerGroups pass).
    const forced = [7, 7, 8] as const;
    (frame as { inputGroups: readonly number[] }).inputGroups = forced;

    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    expect(index.sourceRowsByGroup.get("0:0:7")?.toSorted((a, b) => a - b)).toEqual([0, 1]);
    expect(index.sourceRowsByGroup.get("0:0:8")).toEqual([2]);
    // Natural group ids from derive must not appear if cache is honored.
    expect(index.sourceRowsByGroup.has("0:0:0")).toBe(false);
  });

  it("bin lineage assign uses frame.inputGroups for source-row membership", async () => {
    const { preparePanels } = await import("../../src/pipeline/prepare-panels.ts");
    const { buildCandidateIdentityIndex } =
      await import("../../src/pipeline/candidate-construction/identity-index.ts");
    const { normalize } = await import("@ggts-sh/spec");

    const prepared = preparePanels(
      normalize({
        data: { values: [{ x: 0 }, { x: 1 }, { x: 2 }] },
        layers: [
          {
            geom: "histogram",
            aes: { x: { field: "x" } },
            params: { binwidth: 1, boundary: 0, closed: "right" },
          },
        ],
      }),
      size,
      [],
      [],
    );
    const frame = prepared.panelFrames[0]![0]!;
    expect(frame.inputGroups).toHaveLength(3);
    // Single group for continuous x with no discrete aesthetics.
    expect([...new Set(frame.inputGroups)]).toEqual([0]);

    const index = buildCandidateIdentityIndex(prepared.panelFrames, prepared.facetPanels);
    const allBinRows = [...index.sourceRowsByGroupBin.values()].flat();
    expect(allBinRows.toSorted((a, b) => a - b)).toEqual([0, 1, 2]);
  });
});

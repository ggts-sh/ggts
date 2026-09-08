/**
 * End-to-end candidate construction via runPipeline (outer seam).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import { size } from "./fixtures.ts";

describe("buildPipelineCandidates via runPipeline", () => {
  it("source-backed point layers expose one candidate per mark with lineage", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 10 },
          { x: 2, y: 20 },
          { x: 3, y: 30 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      size,
    );
    expect(model.candidates.size).toBe(3);
    const c0 = model.candidates.candidate(0);
    expect(c0).not.toBeNull();
    expect(c0!.xValue).toBe(1);
    expect(c0!.yValue).toBe(10);
    expect(model.lineage.count(c0!.lineage)).toBe(1);
  });

  it("ordinal color seriesRank matches encodeKey assignment order (1 vs '1')", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 1, c: 1 },
          { x: 1, y: 2, c: "1" },
          { x: 2, y: 3, c: "b" },
        ],
        aes({ x: "x", y: "y", color: "c" }),
      )
        .geomPoint()
        .spec(),
      size,
    );
    const ranks = Array.from({ length: model.candidates.size }, (_, id) => {
      const c = model.candidates.candidate(id)!;
      return { c: c.xValue, rank: c.seriesRank };
    }).toSorted((a, b) => Number(a.c) - Number(b.c));
    // First-seen color values: 1 → rank 0, "1" → rank 1, "b" → rank 2
    expect(ranks.map((r) => r.rank)).toEqual([0, 1, 2]);
    expect(model.scales.color?.kind).toBe("ordinal");
    if (model.scales.color?.kind === "ordinal") {
      expect(model.scales.color.scale.indexOf(1)).toBe(0);
      expect(model.scales.color.scale.indexOf("1")).toBe(1);
      expect(model.scales.color.scale.indexOf("b")).toBe(2);
    }
  });

  it("count bars reconstruct aggregate lineages for represented source rows", () => {
    const model = runPipeline(
      gg([{ g: "a" }, { g: "a" }, { g: "b" }], aes({ x: "g" }))
        .geomBar()
        .spec(),
      size,
    );
    expect(model.candidates.size).toBeGreaterThanOrEqual(2);
    const sizes = Array.from({ length: model.candidates.size }, (_, id) => {
      const c = model.candidates.candidate(id)!;
      return model.lineage.count(c.lineage);
    }).toSorted((a, b) => a - b);
    // one bar for "a" (2 rows) and one for "b" (1 row)
    expect(sizes).toContain(2);
    expect(sizes).toContain(1);
  });

  it("temporal summary lineages use semantic epoch keys matching frame xValues", () => {
    const model = runPipeline(
      gg(
        [
          { when: "1/2/2025", value: 1 },
          { when: "01/02/2025", value: 3 },
          { when: "02/02/2025", value: 5 },
        ],
        aes({ x: "when", y: "value" }),
      )
        .geomErrorbar({ stat: "summary" })
        .scaleXDate({ parse: "dmy", nice: false })
        .spec(),
      size,
    );
    const memberships = Array.from({ length: model.candidates.size }, (_, id) => {
      const c = model.candidates.candidate(id)!;
      return [...model.lineage.keys(c.lineage)].toSorted((a, b) => a - b);
    });
    // Two summary groups: dmy-equivalent first two rows, then third row alone.
    expect(memberships.some((rows) => rows.length === 2 && rows[0] === 0 && rows[1] === 1)).toBe(
      true,
    );
    expect(memberships.some((rows) => rows.length === 1 && rows[0] === 2)).toBe(true);
    expect(memberships.every((rows) => rows.length > 0)).toBe(true);
  });

  /**
   * Combined facet + temporal summary path (#437): unequal panel membership
   * with local-row parsing must still intern source-table lineage keys.
   */
  it("faceted temporal summary marks carry exact source-row lineage memberships", () => {
    const model = runPipeline(
      gg(
        [
          { region: "north", when: "1/2/2025", value: 1 },
          { region: "north", when: "01/02/2025", value: 3 },
          { region: "north", when: "02/02/2025", value: 5 },
          { region: "south", when: "1/2/2025", value: 10 },
          { region: "south", when: "03/02/2025", value: 7 },
        ],
        aes({ x: "when", y: "value" }),
      )
        .geomErrorbar({ stat: "summary" })
        .facet({ wrap: "region" })
        .scaleXDate({ parse: "dmy", nice: false })
        .spec(),
      size,
    );

    const byPanel = new Map<string, Set<string>>();
    for (let id = 0; id < model.candidates.size; id++) {
      const c = model.candidates.candidate(id)!;
      const rows = [...model.lineage.keys(c.lineage)].toSorted((a, b) => a - b);
      const key = rows.join(",");
      const panel = c.panelId;
      const set = byPanel.get(panel) ?? new Set<string>();
      set.add(key);
      byPanel.set(panel, set);
    }

    const north = [...byPanel.entries()].find(([id]) => id.includes("north"));
    const south = [...byPanel.entries()].find(([id]) => id.includes("south"));
    expect(north).toBeDefined();
    expect(south).toBeDefined();
    // North: merged spelling pair [0,1] + singleton day-2 [2].
    expect(north![1]).toEqual(new Set(["0,1", "2"]));
    // South: source rows 3 and 4 only (local 0,1 in that panel).
    expect(south![1]).toEqual(new Set(["3", "4"]));
  });

  it("bin layers intern source rows using closed bin edges", () => {
    const model = runPipeline(
      {
        data: { values: [{ x: 0 }, { x: 1 }, { x: 2 }] },
        layers: [
          {
            geom: "histogram",
            aes: { x: { field: "x" } },
            params: { binwidth: 1, boundary: 0, closed: "right" },
          },
        ],
      },
      size,
    );
    expect(model.candidates.size).toBeGreaterThanOrEqual(2);
    const memberships = Array.from({ length: model.candidates.size }, (_, id) => {
      const c = model.candidates.candidate(id)!;
      return model.lineage.count(c.lineage);
    });
    // three source rows assigned across bins without empty lineages
    expect(memberships.every((n) => n >= 1)).toBe(true);
    expect(memberships.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("annotation rules produce candidates with intercept values", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .geomRule({ yintercept: 2.5, xintercept: 1.5 })
        .spec(),
      size,
    );
    expect(model.candidates.size).toBeGreaterThan(2);
    const modes = Array.from(
      { length: model.candidates.size },
      (_, id) => model.candidates.candidate(id)?.autoMode,
    );
    expect(modes.some((m) => m === "x" || m === "y")).toBe(true);
  });

  it("identity-indexed multi-series lines map path vertices via precomputed group rows", () => {
    // Annotation layer forces the identity-indexed candidate path (not
    // source-backed). Path vertices must resolve to x-sorted frame rows per
    // series without rebuilding the group index on every call.
    const model = runPipeline(
      gg(
        [
          { x: 2, y: 10, s: "a" },
          { x: 1, y: 20, s: "b" },
          { x: 1, y: 30, s: "a" },
          { x: 2, y: 40, s: "b" },
        ],
        aes({ x: "x", y: "y", color: "s" }),
      )
        .geomLine()
        .geomRule({ yintercept: 25 })
        .spec(),
      size,
    );
    const linePoints = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id)!,
    ).filter((c) => c.kind === "paths");
    expect(linePoints).toHaveLength(4);
    expect(linePoints.map((c) => c.yValue).toSorted((a, b) => Number(a) - Number(b))).toEqual([
      10, 20, 30, 40,
    ]);
    expect(new Set(linePoints.map((c) => c.seriesId)).size).toBe(2);
    // Within each series, vertices are ordered by x (sorted group rows).
    const bySeries = new Map<number, typeof linePoints>();
    for (const c of linePoints) {
      const series = bySeries.get(c.seriesId);
      if (series === undefined) bySeries.set(c.seriesId, [c]);
      else series.push(c);
    }
    for (const seriesPoints of bySeries.values()) {
      const xs = seriesPoints.map((c) => Number(c.xValue));
      expect(xs).toEqual([...xs].toSorted((a, b) => a - b));
    }
  });
});

describe("allocatePipelineRunId", () => {
  it("returns increasing positive integers", async () => {
    const { allocatePipelineRunId } = await import("../../src/pipeline/run-id.ts");
    const a = allocatePipelineRunId();
    const b = allocatePipelineRunId();
    expect(a).toBeGreaterThan(0);
    expect(b).toBe(a + 1);
  });
});

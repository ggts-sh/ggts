/**
 * M2 pipeline — ribbon geom.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("ribbon geom", () => {
  it("emits a closed path band between ymin and ymax (not zero baseline)", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 3], lo: [2, 3, 1], hi: [5, 6, 4] }, aes({ x: "x", ymin: "lo", ymax: "hi" }))
        .geomRibbon()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.closed).toBe(true);
    expect(batch.fills).toBeDefined();
    // 3 upper + 3 lower vertices
    expect(batch.positions.length / 2).toBe(6);
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(1);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(6);
    }
    // Lower edge is not forced to the zero baseline: ymin=1,2,3 all above 0.
    // y panel height maps higher data to lower pixel y — just assert domain trains bounds.
  });

  it("errors when lower bound exceeds upper on a finite row", () => {
    expect(() =>
      runPipeline(
        gg({ x: [1, 2], lo: [5, 1], hi: [3, 4] }, aes({ x: "x", ymin: "lo", ymax: "hi" }))
          .geomRibbon()
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
    try {
      runPipeline(
        gg({ x: [1], lo: [5], hi: [3] }, aes({ x: "x", ymin: "lo", ymax: "hi" }))
          .geomRibbon()
          .spec(),
        size,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("ribbon-inverted-bounds");
    }
  });

  it("requires ymin/ymax at bind time", () => {
    expect(() =>
      runPipeline(
        gg({ x: [1], y: [2] }, aes({ x: "x", y: "y" }))
          .geomRibbon()
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("draws y-oriented ribbons from y+xmin+xmax", () => {
    const model = runPipeline(
      gg({ y: [1, 2, 3], lo: [0, 1, 0], hi: [2, 3, 2] }, aes({ y: "y", xmin: "lo", xmax: "hi" }))
        .geomRibbon()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.closed).toBe(true);
    expect(batch.positions.length / 2).toBe(6);
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[0]).toBeLessThanOrEqual(0);
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(3);
    }
  });

  it("emits outline open paths only when color is explicit", () => {
    const plain = runPipeline(
      gg({ x: [1, 2], lo: [0, 0], hi: [1, 2] }, aes({ x: "x", ymin: "lo", ymax: "hi" }))
        .geomRibbon({ outline: "both" })
        .spec(),
      size,
    );
    expect(plain.scene.batches.length).toBe(1);

    const outlined = runPipeline(
      gg(
        { x: [1, 2], lo: [0, 0], hi: [1, 2] },
        aes({ x: "x", ymin: "lo", ymax: "hi", color: { value: "#111111" } }),
      )
        .geomRibbon({ outline: "both" })
        .spec(),
      size,
    );
    expect(outlined.scene.batches.length).toBe(2);
    const outline = outlined.scene.batches.find(
      (b): b is PathsBatch => b.kind === "paths" && b.fills === undefined,
    );
    expect(outline).toBeDefined();
    expect(outline?.candidates).toBe(false);
  });

  it("splits groups on non-finite bounds (gaps)", () => {
    // null cells become non-finite after position read (JSON cannot carry NaN).
    const model = runPipeline(
      gg(
        { x: [1, 2, 3, 4, 5], lo: [0, 0, null, 0, 0], hi: [1, 1, null, 1, 1] },
        aes({ x: "x", ymin: "lo", ymax: "hi" }),
      )
        .geomRibbon()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    // Two finite runs of 2 rows each → 2 closed subpaths
    expect(batch.pathOffsets.length - 1).toBe(2);
  });

  it("keeps a gap when the running x is missing mid-group (#1371)", () => {
    // x-sort must not relocate the missing running coord to the tail, or the
    // two finite sides would merge into one continuous band.
    const model = runPipeline(
      gg(
        { x: [5, null, 1, 2], lo: [0, 0, 0, 0], hi: [1, 1, 1, 1] },
        aes({ x: "x", ymin: "lo", ymax: "hi" }),
      )
        .geomRibbon()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    // Finite sides [5] alone + [1,2] → only the 2-row side emits a closed path.
    // If NaN were moved to the end, [5,1,2] would wrongly form one run.
    expect(batch.pathOffsets.length - 1).toBe(1);
  });

  it("keeps a gap when the running y is missing mid-group (#1371)", () => {
    const model = runPipeline(
      gg(
        { y: [5, null, 1, 2], lo: [0, 0, 0, 0], hi: [1, 1, 1, 1] },
        aes({ y: "y", xmin: "lo", xmax: "hi" }),
      )
        .geomRibbon()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.pathOffsets.length - 1).toBe(1);
  });

  it("survives coord flip", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 3], lo: [1, 2, 1], hi: [3, 4, 3] }, aes({ x: "x", ymin: "lo", ymax: "hi" }))
        .geomRibbon()
        .coordFlip()
        .spec(),
      size,
    );
    expect(model.scene.batches[0]!.kind).toBe("paths");
  });

  it("does not change area identity output shape for a baseline area", () => {
    const area = runPipeline(
      gg({ x: [1, 2, 3], y: [1, 2, 1] }, aes({ x: "x", y: "y" }))
        .geomArea({ position: "identity" })
        .spec(),
      size,
    );
    const batch = area.scene.batches[0] as PathsBatch;
    expect(batch.closed).toBe(true);
    expect(batch.linewidth).toBe(0);
    // 3 upper + 3 baseline
    expect(batch.positions.length / 2).toBe(6);
  });

  it("drops rows when the measure axis is band (unprojectable bounds)", () => {
    // scales.y.type: "band" makes projectMeasure return NaN; ribbons must not emit
    // NaN path vertices — finiteRibbonRuns drops every row and yields no batch paths.
    const model = runPipeline(
      gg({ x: [1, 2, 3], lo: [0, 0, 0], hi: [1, 2, 1] }, aes({ x: "x", ymin: "lo", ymax: "hi" }))
        .geomRibbon()
        .scales({ y: { type: "band" } })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch | undefined;
    // No finite runs → either no path batch or empty subpaths
    if (batch !== undefined && batch.kind === "paths") {
      expect(batch.pathOffsets.length - 1).toBe(0);
    } else {
      expect(model.scene.batches.length).toBe(0);
    }
  });

  it("does not fail temporal x preflight for unused xmin on a point layer", () => {
    // Point maps xmin but does not consume it; scales.x.type:"time" must not parse xmin.
    expect(() =>
      runPipeline(
        gg(
          {
            x: ["2024-01-01", "2024-01-02"],
            y: [1, 2],
            junk: ["not-a-date", "also-bad"],
          },
          aes({ x: "x", y: "y", xmin: "junk", xmax: "junk" }),
        )
          .geomPoint()
          .scales({ x: { type: "time", parse: "iso" } })
          .spec(),
        size,
      ),
    ).not.toThrow();
  });
});

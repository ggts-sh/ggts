/**
 * M2 pipeline — geom curve (#794).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("curve geom (#794)", () => {
  it("emits one path subpath per row with only endpoints as semantic anchors", () => {
    const model = runPipeline(
      gg(
        { x: [0, 1], y: [0, 0], xend: [1, 2], yend: [1, 1] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomCurve({ curvature: 0.5, ncp: 2 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.pathOffsets.length).toBe(3); // 2 subpaths + terminal
    // Candidate primitive count should match rows, not tessellated vertices.
    expect(model.candidates.size).toBe(2);
    expect(batch.semanticAnchors).toBeDefined();
    const anchors = batch.semanticAnchors!;
    expect(anchors.reduce((a, b) => a + b, 0)).toBe(2); // one anchor per row
  });

  it("trains scales from xend/yend tips", () => {
    const model = runPipeline(
      gg(
        { x: [1], y: [1], xend: [10], yend: [20] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomCurve()
        .spec(),
      size,
    );
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(10);
    }
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(20);
    }
  });

  it("curvature 0 still draws from start to end", () => {
    const model = runPipeline(
      gg(
        { x: [0], y: [0], xend: [1], yend: [0] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomCurve({ curvature: 0, ncp: 2 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.positions.length).toBeGreaterThanOrEqual(4);
    expect(batch.pathOffsets[1]! - batch.pathOffsets[0]!).toBeGreaterThanOrEqual(2);
  });

  it("maps lineend to PathsBatch.linecap (default butt)", () => {
    const round = runPipeline(
      gg(
        { x: [0], y: [0], xend: [1], yend: [1] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomCurve({ lineend: "round", ncp: 2 })
        .spec(),
      size,
    );
    expect((round.scene.batches[0] as PathsBatch).linecap).toBe("round");

    const def = runPipeline(
      gg(
        { x: [0], y: [0], xend: [1], yend: [1] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomCurve({ ncp: 2 })
        .spec(),
      size,
    );
    expect((def.scene.batches[0] as PathsBatch).linecap).toBe("butt");
  });

  it("defaults linewidth to 1 (segment/rule default, schema Default 1)", () => {
    const model = runPipeline(
      gg(
        { x: [0], y: [0], xend: [1], yend: [1] },
        aes({ x: "x", y: "y", xend: "xend", yend: "yend" }),
      )
        .geomCurve({ ncp: 2 })
        .spec(),
      size,
    );
    expect((model.scene.batches[0] as PathsBatch).linewidth).toBe(1);
  });
});

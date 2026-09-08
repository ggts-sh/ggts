/**
 * M2 pipeline — stat connect (#816): expand successive points for path/line.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { size } from "./fixtures.ts";

describe("stat connect (#816)", () => {
  it("path + connect hv expands corners and preserves step vertex order", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 2, 4],
          y: [0, 2, 0],
        },
        aes({ x: "x", y: "y" }),
      )
        .geomPath({ stat: "connect", connection: "hv" })
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "paths");
    expect(batch).toBeDefined();
    if (batch?.kind !== "paths") throw new Error("expected paths batch");
    // Data-space vertices after hv expansion: (0,0),(2,0),(2,2),(4,2),(4,0)
    // Path positions are panel px; count vertices via pathOffsets / positions.
    const nVerts = batch.positions.length / 2;
    expect(nVerts).toBe(5);
    // Tied-x step corners must not be reordered: second and third share x=2
    // in data; after projection, consecutive positions must still form the
    // horizontal-then-vertical elbow (first corner has y of prior point).
    // Check y-panel ordering of verts 1 and 2: both at same x after project,
    // first intermediate is horizontal (same y as start), second is endpoint.
    const ys = [
      batch.positions[1]!,
      batch.positions[3]!,
      batch.positions[5]!,
      batch.positions[7]!,
      batch.positions[9]!,
    ];
    // Panel y increases downward typically — assert the mid elbow pattern:
    // verts [0] and [1] share y (horizontal leg); verts [1] and [2] share x.
    const xs = [
      batch.positions[0]!,
      batch.positions[2]!,
      batch.positions[4]!,
      batch.positions[6]!,
      batch.positions[8]!,
    ];
    expect(ys[0]).toBeCloseTo(ys[1]!, 5);
    expect(xs[1]).toBeCloseTo(xs[2]!, 5);
    expect(xs[3]).toBeCloseTo(xs[4]!, 5);
  });

  it("line + connect keeps expanded order (no post-stat x-sort destroy)", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 2],
          y: [0, 2],
        },
        aes({ x: "x", y: "y" }),
      )
        .geomLine({ stat: "connect", connection: "hv" })
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "paths");
    expect(batch).toBeDefined();
    if (batch?.kind !== "paths") throw new Error("expected paths batch");
    expect(batch.positions.length / 2).toBe(3);
    const xs = [batch.positions[0]!, batch.positions[2]!, batch.positions[4]!];
    const ys = [batch.positions[1]!, batch.positions[3]!, batch.positions[5]!];
    // Horizontal leg: first two verts share y; last two share x.
    expect(ys[0]).toBeCloseTo(ys[1]!, 5);
    expect(xs[1]).toBeCloseTo(xs[2]!, 5);
  });

  it("rejects stat connect on point via schema", () => {
    expect(() =>
      runPipeline(
        {
          data: { x: [0, 1], y: [0, 1] },
          mapping: { x: "x", y: "y" },
          layers: [{ geom: "point", stat: "connect" }],
        },
        size,
      ),
    ).toThrow();
  });

  it("linear connection on path matches identity vertex count", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 1, 2],
          y: [0, 1, 0],
        },
        aes({ x: "x", y: "y" }),
      )
        .geomPath({ stat: "connect", connection: "linear" })
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "paths");
    expect(batch).toBeDefined();
    if (batch?.kind !== "paths") throw new Error("expected paths batch");
    expect(batch.positions.length / 2).toBe(3);
  });
});

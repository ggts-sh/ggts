/**
 * M2 pipeline — stat align for continuous-x area stack (#815).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

describe("stat align (#815)", () => {
  it("enables stacked area when groups have different x samples", () => {
    // Without align, different x keys don't co-stack; with align, both groups
    // share x={0,1,2} and stack produces ymin/ymax.
    const model = runPipeline(
      gg(
        {
          x: [0, 2, 1, 2],
          y: [1, 3, 2, 4],
          g: ["a", "a", "b", "b"],
        },
        aes({ x: "x", y: "y", fill: "g" }),
      )
        .geomArea({ stat: "align", position: "stack" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.closed).toBe(true);
    // Two groups → two filled subpaths
    expect(batch.pathOffsets.length).toBe(3);
    // Domain y should cover stacked total at x=2: 3+4=7
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(7 - 1e-9);
    }
  });

  it("rejects stat align on point", () => {
    expect(() =>
      gg({ x: [0, 1], y: [0, 1] }, aes({ x: "x", y: "y" }))
        .layer({ geom: "point", stat: "align" as "identity", aes: { x: "x", y: "y" } })
        .spec(),
    ).toThrow();
  });
});

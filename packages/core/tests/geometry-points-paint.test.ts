/**
 * Categorical identity scatter stores palette indexes, not a string per point.
 */
import { aes, gg } from "@ggts-sh/spec";
import { describe, expect, it } from "bun:test";

import { registerBasicPoints } from "../src/pipeline/register-basic-points.ts";
import { runPipeline } from "../src/pipeline/run-pipeline.ts";
import type { PointsBatch } from "../src/scene.ts";

registerBasicPoints();

const size = { width: 200, height: 150 };

describe("pointsBatch categorical paint", () => {
  it("stores low-cardinality colors as palette + indexes", () => {
    const model = runPipeline(
      gg(
        { x: [1, 2, 3, 4], y: [1, 2, 3, 4], c: ["a", "b", "a", "b"] },
        aes({ x: "x", y: "y", color: "c" }),
      )
        .geomPoint()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.kind).toBe("points");
    expect(batch.colors).toBeUndefined();
    expect(batch.colorPalette).toHaveLength(2);
    expect([...batch.colorIndexes!]).toEqual([0, 1, 0, 1]);
  });
});

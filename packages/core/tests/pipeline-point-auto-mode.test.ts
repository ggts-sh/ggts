/**
 * Point/text auto inspection mode defaults (#754).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";

const size = { width: 640, height: 400 };

describe("point auto inspect mode (#754)", () => {
  it("defaults points to exact (ring only), not xy crosshair grouping", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 3], y: [4, 5, 6], g: ["a", "b", "a"] }, aes({ x: "x", y: "y", color: "g" }))
        .geomPoint()
        .spec(),
      size,
    );
    const first = model.candidates.candidate(0);
    expect(first).not.toBeNull();
    expect(first!.autoMode).toBe("exact");
  });
});

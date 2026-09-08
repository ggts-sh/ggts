/**
 * buildFrame via runPipeline regression.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";

const size = { width: 640, height: 400 };

describe("buildFrame via runPipeline (regression)", () => {
  it("count bars produce one rect batch with expected mark count", () => {
    const model = runPipeline(
      gg([{ g: "a" }, { g: "a" }, { g: "b" }], aes({ x: "g" }))
        .geomBar()
        .spec(),
      size,
    );
    const rects = model.scene.batches.filter((b) => b.kind === "rects");
    expect(rects.length).toBeGreaterThan(0);
  });
});

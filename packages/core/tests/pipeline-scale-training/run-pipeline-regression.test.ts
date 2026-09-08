/**
 * Scale training via runPipeline (regression anchors).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import { size } from "./fixtures.ts";

describe("scale training via runPipeline (regression anchors)", () => {
  it("emits scale-type advisories for inferred continuous axes", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 10 },
          { x: 2, y: 20 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      size,
    );
    const codes = model.advisories.map((a) => a.code);
    expect(codes).toContain("scale-type-inferred");
  });

  it("forces zero on bar measure axes with advisory", () => {
    const model = runPipeline(
      gg(
        [
          { g: "a", n: 3 },
          { g: "b", n: 5 },
        ],
        aes({ x: "g", y: "n" }),
      )
        .geomCol()
        .spec(),
      size,
    );
    expect(model.advisories.some((a) => a.code === "zero-forced")).toBe(true);
    if (model.scales.y.type !== "band") {
      // Zero is forced pre-expansion; the 5% display expansion then pads a small
      // gap below the baseline (ggplot2's default continuous expansion).
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(0);
      expect(model.scales.y.domain[0]).toBeGreaterThan(-1);
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(5);
    }
  });
});

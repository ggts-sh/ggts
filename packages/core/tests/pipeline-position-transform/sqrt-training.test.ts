/**
 * Position transform — sqrt-training.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg, scaleXSqrt } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { size, xScale } from "./fixtures.ts";

describe("scaleXSqrt — transformed-space training", () => {
  const rows = [0, 1, 4, 9, 16, 25].map((x, i) => ({ x, y: i }));
  const model = runPipeline(
    gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .scales(scaleXSqrt())
      .spec(),
    size,
  );
  const scale = xScale(model);

  it("reports the sqrt transform and admits semantic zero", () => {
    expect(scale.transform).toBe("sqrt");
    expect(scale.normalize(0)).not.toBeNaN();
    expect(scale.normalize(-1)).toBeNaN();
  });

  it("spaces perfect squares evenly (even in sqrt space)", () => {
    const g1 = scale.normalize(4) - scale.normalize(1);
    const g2 = scale.normalize(9) - scale.normalize(4);
    expect(g1).toBeCloseTo(g2, 9);
  });
});

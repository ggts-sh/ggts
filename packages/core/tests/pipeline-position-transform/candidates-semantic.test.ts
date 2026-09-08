/**
 * Position transform — candidates-semantic.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg, scaleXLog10, scaleYLog10 } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { size } from "./fixtures.ts";

describe("candidate values cross back into semantic source space", () => {
  it("inverse-projects synthesized smooth x/y values exactly once", () => {
    const rows = [1, 10, 100, 1000].map((value) => ({ x: value, y: value }));
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomSmooth({ method: "lm", se: false, n: 4 })
        .scales({ ...scaleXLog10(), ...scaleYLog10() })
        .spec(),
      size,
    );
    const candidates = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    ).filter((candidate) => candidate !== null);
    expect(candidates[0]!.xValue).toBeCloseTo(1, 8);
    expect(candidates[0]!.yValue).toBeCloseTo(1, 8);
    expect(candidates.at(-1)!.xValue).toBeCloseTo(1000, 6);
    expect(candidates.at(-1)!.yValue).toBeCloseTo(1000, 6);
  });
});

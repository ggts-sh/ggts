import { describe, expect, it } from "bun:test";

import { aes, gg, scaleXLog10 } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.ts";
import { candidates, path, size } from "./fixtures.ts";

describe("pipeline post-stat coord_transform — contracts", () => {
  it("keeps the identity-scale smooth fit while rendering through coord log", () => {
    const rows = Array.from({ length: 24 }, (_, i) => ({ x: i + 1, y: Math.sqrt(i + 1) }));
    const base = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomSmooth({ method: "lm", se: false, n: 12 })
        .spec(),
      size,
    );
    const coord = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomSmooth({ method: "lm", se: false, n: 12 })
        .coordTransform({ x: "log10" })
        .spec(),
      size,
    );
    const scaled = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomSmooth({ method: "lm", se: false, n: 12 })
        .scales(scaleXLog10())
        .spec(),
      size,
    );
    expect(candidates(coord).map((candidate) => candidate.yValue)).toEqual(
      candidates(base).map((candidate) => candidate.yValue),
    );
    expect(candidates(coord).map((candidate) => candidate.yValue)).not.toEqual(
      candidates(scaled).map((candidate) => candidate.yValue),
    );
    expect(Array.from(path(coord).positions)).not.toEqual(Array.from(path(base).positions));
  });
  it("coordinate limits do not filter/re-stat source rows", () => {
    const rows = [1, 10, 100].map((x) => ({ x, y: x }));
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .coordTransform({
          x: { transform: "log10", limits: [10, 100], expand: false },
        })
        .spec(),
      size,
    );
    expect(model.candidates.size).toBe(3);
    expect(candidates(model).map((candidate) => candidate.xValue)).toEqual([1, 10, 100]);
  });
  it("rejects non-identity transformed coordinates on band axes", () => {
    expect(() =>
      runPipeline(
        gg(
          [
            { x: "a", y: 1 },
            { x: "b", y: 2 },
          ],
          aes({ x: "x", y: "y" }),
        )
          .geomPoint()
          .coordTransform({ x: "log10" })
          .spec(),
        size,
      ),
    ).toThrow(expect.objectContaining({ code: "coord-transform-continuous" }));
  });
});

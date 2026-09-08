/**
 * Position transform — detached-values.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg, scaleXLog10, scaleYLog10 } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { size, xScale } from "./fixtures.ts";

describe("detached positional values honor the transformed-space contract", () => {
  it("forwards annotation intercept evidence exactly once before scale training", () => {
    const model = runPipeline(
      gg([{ x: 1, y: 1 }], aes({ x: "x", y: "y" }))
        .geomPoint()
        .geomRule({ xintercept: 1000, yintercept: 100 })
        .scales({ ...scaleXLog10(), ...scaleYLog10() })
        .spec(),
      size,
    );
    const scale = xScale(model);
    expect(scale.domain[1]).toBeFinite();
    expect(scale.domain[1]).toBeLessThan(10_000);
    expect(scale.normalize(1000)).toBeGreaterThanOrEqual(0);
    expect(scale.normalize(1000)).toBeLessThanOrEqual(1);
    const y = model.scales.y;
    if (y.type === "band") throw new Error("expected a continuous y scale");
    expect(y.domain[1]).toBeFinite();
    expect(y.normalize(100)).toBeGreaterThanOrEqual(0);
    expect(y.normalize(100)).toBeLessThanOrEqual(1);
  });

  it("forwards non-binned count positions before training", () => {
    const rows = [{ x: 10 }, { x: 10 }, { x: 100 }];
    const model = runPipeline(
      gg(rows, aes({ x: "x" }))
        .geomBar()
        .scales(scaleXLog10())
        .spec(),
      size,
    );
    const scale = xScale(model);
    expect(scale.domain[0]).toBeGreaterThan(0);
    expect(scale.domain[1]).toBeLessThan(1000);
    expect(model.scene.batches.some((batch) => batch.kind === "rects")).toBe(true);
    const candidateX = Array.from(
      { length: model.candidates.size },
      (_, id) => model.candidates.candidate(id)?.xValue,
    ).toSorted((a, b) => Number(a) - Number(b));
    expect(candidateX).toEqual([10, 100]);
  });

  it("forwards stat-summary group positions before training and geometry", () => {
    const rows = [
      { x: 10, y: 2 },
      { x: 10, y: 4 },
      { x: 100, y: 6 },
      { x: 100, y: 8 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomErrorbar({ stat: "summary" })
        .scales(scaleXLog10())
        .spec(),
      size,
    );
    const scale = xScale(model);
    expect(scale.domain[1]).toBeLessThan(1000);
    const batch = model.scene.batches.find((candidate) => candidate.kind === "segments");
    if (batch === undefined || batch.kind !== "segments") throw new Error("expected segments");
    for (const position of batch.segments) expect(position).toBeFinite();
  });
});

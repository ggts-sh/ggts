/**
 * Position transform — log10-zero-baseline.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg, scaleYLog10 } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { size } from "./fixtures.ts";

describe("log10 zero-baseline geoms — shared transformed-origin baseline (never log10(0))", () => {
  const barRows = [
    { g: "a", y: 10 },
    { g: "b", y: 100 },
    { g: "c", y: 1000 },
  ];

  it("geomCol under scaleYLog10 renders every bar (no NaN baseline, no row drops)", () => {
    const model = runPipeline(
      gg(barRows, aes({ x: "g", y: "y" }))
        .geomCol()
        .scales(scaleYLog10())
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "rects");
    if (batch === undefined || batch.kind !== "rects") throw new Error("expected a rects batch");
    expect(batch.rowIndex.length).toBe(3);
    for (const v of batch.rects) expect(Number.isFinite(v)).toBe(true);
  });

  it("emits one deduplicated scale-baseline-transformed-origin advisory per axis, not one per row/layer", () => {
    const model = runPipeline(
      gg(barRows, aes({ x: "g", y: "y" }))
        .geomCol()
        .scales(scaleYLog10())
        .spec(),
      size,
    );
    const hits = model.advisories.filter((a) => a.code === "scale-baseline-transformed-origin");
    expect(hits.length).toBe(1);
    expect(hits[0]!.path).toBe("scales.y");
  });

  it("does not emit the transformed-origin advisory for identity/sqrt bar measures", () => {
    const model = runPipeline(
      gg(barRows, aes({ x: "g", y: "y" }))
        .geomCol()
        .spec(),
      size,
    );
    expect(model.advisories.some((a) => a.code === "scale-baseline-transformed-origin")).toBe(
      false,
    );
  });

  it("geomDensity under scaleYLog10 renders a finite baseline (density's ymin shares the helper)", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ x: i + 1 }));
    const model = runPipeline(
      gg(rows, aes({ x: "x" }))
        .geomDensity()
        .scales(scaleYLog10())
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "paths");
    if (batch === undefined || batch.kind !== "paths") throw new Error("expected a paths batch");
    for (const v of batch.positions) expect(Number.isFinite(v)).toBe(true);
    expect(model.advisories.some((a) => a.code === "scale-baseline-transformed-origin")).toBe(true);
  });
});

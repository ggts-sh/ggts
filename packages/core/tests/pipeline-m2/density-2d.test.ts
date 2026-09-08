/**
 * M2 pipeline — geom_density_2d isolines (#802).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

function cloud(n: number): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = ((i * 37 + 11) % 1000) / 1000 + 1e-6;
    const v = ((i * 91 + 17) % 1000) / 1000 + 1e-6;
    const r = Math.sqrt(-2 * Math.log(u));
    const th = 2 * Math.PI * v;
    x.push(r * Math.cos(th));
    y.push(r * Math.sin(th));
  }
  return { x, y };
}

describe("density_2d geom (#802)", () => {
  it("emits path isolines for a scatter cloud", () => {
    const data = cloud(60);
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomDensity2d({ n: 25, bins: 4 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.positions.length / 2).toBeGreaterThan(0);
  });

  it("requires both x and y", () => {
    expect(() =>
      runPipeline(
        gg({ x: [1, 2, 3] }, aes({ x: "x" }))
          .geomDensity2d({ n: 10, bins: 3 })
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("drops tiny groups with a warning", () => {
    const model = runPipeline(
      gg({ x: [1], y: [2] }, aes({ x: "x", y: "y" }))
        .geomDensity2d({ n: 10, bins: 3 })
        .spec(),
      size,
    );
    expect(model.warnings.some((w) => w.code === "density-2d-group-dropped")).toBe(true);
  });
});

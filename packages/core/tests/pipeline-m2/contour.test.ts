/**
 * M2 pipeline — geom_contour isolines (#801).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

/** Regular n×n grid with z = x. */
function grid(n: number): { x: number[]; y: number[]; z: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  const z: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      x.push(i);
      y.push(j);
      z.push(i);
    }
  }
  return { x, y, z };
}

describe("contour geom (#801)", () => {
  it("emits path polylines for explicit breaks", () => {
    const data = grid(4);
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", z: "z" }))
        .geomContour({ breaks: [0.5, 1.5] })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.positions.length / 2).toBeGreaterThan(0);
    expect(model.scales.x.type).toBe("linear");
    expect(model.scales.y.type).toBe("linear");
  });

  it("default bins produces contours on a non-constant field", () => {
    const data = grid(5);
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y", z: "z" }))
        .geomContour()
        .spec(),
      size,
    );
    expect(model.scene.batches.length).toBeGreaterThanOrEqual(1);
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.positions.length / 2).toBeGreaterThan(0);
  });

  it("missing z fails loud", () => {
    expect(() =>
      runPipeline(
        gg(grid(3), aes({ x: "x", y: "y" }))
          .geomContour({ breaks: [0.5] })
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("constant z with bins drops group (no contours)", () => {
    const n = 3;
    const x: number[] = [];
    const y: number[] = [];
    const z: number[] = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        x.push(i);
        y.push(j);
        z.push(1);
      }
    }
    const model = runPipeline(
      gg({ x, y, z }, aes({ x: "x", y: "y", z: "z" }))
        .geomContour({ bins: 5 })
        .spec(),
      size,
    );
    // No drawable marks — empty batch list or empty paths.
    const marks = model.scene.batches.reduce((acc, b) => {
      if (b.kind === "paths") return acc + b.positions.length;
      return acc;
    }, 0);
    expect(marks).toBe(0);
    expect(model.warnings.some((w) => w.code === "contour-group-dropped")).toBe(true);
  });
});

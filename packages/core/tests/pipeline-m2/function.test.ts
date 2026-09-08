/**
 * M2 pipeline — geom_function / stat_function analytic curves.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";
import { buildFunctionFrame } from "../../src/pipeline/frame-stats-function.ts";
import type { PathsBatch } from "../../src/scene.ts";
import { dnorm } from "../../src/stats/function.ts";
import { ColumnTable } from "../../src/table.ts";

const size = { width: 640, height: 400 };

describe("geom_function", () => {
  it("emits a path over xlim with y = dnorm(x)", () => {
    const model = runPipeline(
      gg({ x: [0] })
        .geomFunction({ fun: "dnorm", n: 21, xlim: [-3, 3], args: { mean: 0, sd: 1 } })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.closed).toBeFalsy();
    // 21 vertices
    expect(batch.pathOffsets[1]).toBe(21);
    // Peak near center of panel (x=0 maps mid-domain)
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[1]).toBeGreaterThan(dnorm(0, 0, 1) * 0.9);
    }
  });

  it("trains x domain from xlim when data x is absent", () => {
    const model = runPipeline(
      // Placeholder column so plot data validates; domain still comes from xlim.
      gg({ dummy: [0] })
        .geomFunction({ fun: "identity", n: 5, xlim: [2, 8] })
        .spec(),
      size,
    );
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[0]).toBeLessThanOrEqual(2);
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(8);
    }
  });

  it("uses peer layer x extent when xlim omitted", () => {
    const model = runPipeline(
      gg({ x: [-1, 0, 1], y: [0, 1, 0] }, aes({ x: "x" }))
        .geomPoint({ aes: aes({ y: "y" }) })
        .geomFunction({ fun: "identity", n: 5 })
        .spec(),
      size,
    );
    // Function path present; domain spans point x
    const paths = model.scene.batches.filter((b): b is PathsBatch => b.kind === "paths");
    expect(paths.length).toBe(1);
    expect(paths[0]!.pathOffsets[1]).toBe(5);
    if (model.scales.x.type !== "band") {
      expect(model.scales.x.domain[0]).toBeLessThanOrEqual(-1);
      expect(model.scales.x.domain[1]).toBeGreaterThanOrEqual(1);
    }
  });

  it("uses exact-ish line auto hit mode (x)", () => {
    const model = runPipeline(
      gg({ x: [0] })
        .geomFunction({ fun: "identity", n: 11, xlim: [0, 1] })
        .spec(),
      size,
    );
    expect(model.candidates.candidate(0)?.autoMode).toBe("x");
  });

  it("warns function-fun-unknown (not domain-missing) for typo'd fun with xlim", () => {
    // Schema rejects unknown fun names; this guards the frame path used by
    // unvalidated runPipeline callers (Devin review on #883).
    const style = { field: null, statColumn: null, constant: null, scaledConstant: null };
    const warnings: { code: string }[] = [];
    buildFunctionFrame(
      {
        layer: { geom: "function", params: { fun: "dnormm", n: 11, xlim: [-1, 1] } },
        index: 0,
        xField: null,
        color: { field: null },
        fill: { field: null },
        size: style,
        linewidth: style,
        alpha: style,
        shape: style,
        linetype: style,
        labelField: null,
      } as never,
      ColumnTable.fromRows([{ x: 0 }]),
      warnings as never,
      [-1, 1],
    );
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain("function-fun-unknown");
    expect(codes).not.toContain("function-domain-missing");
  });

  it("forwards the evaluation grid through scale x transform (log10)", () => {
    const model = runPipeline(
      gg({ x: [1, 10, 100] })
        .geomFunction({ fun: "identity", n: 3, xlim: [1, 100] })
        .scales({ x: { type: "linear", transform: "log10", nice: false } })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    // Grid evaluated at data x={1, 50.5, 100}; with log10 the mid vertex must
    // sit near log10(50.5)/log10(100) ≈ 0.85 of the path span — not 0.5 as a
    // linear placement of raw data x would produce.
    const midX = batch.positions[2]!;
    const left = batch.positions[0]!;
    const right = batch.positions[4]!;
    const t = (midX - left) / (right - left);
    expect(t).toBeGreaterThan(0.8);
    expect(t).toBeLessThan(0.9);
  });
});

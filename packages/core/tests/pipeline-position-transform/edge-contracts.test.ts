/**
 * Position transform — edge-contracts.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg, scaleXLog10, scaleXSqrt } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import { size, xScale } from "./fixtures.ts";

describe("transform family edge contracts", () => {
  it("clamps sqrt display expansion to the transform codomain", () => {
    const model = runPipeline(
      gg(
        [0, 1, 4, 9, 16, 25].map((x) => ({ x, y: x })),
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales(scaleXSqrt())
        .spec(),
      size,
    );
    const scale = xScale(model);
    expect(scale.domain[0]).toBe(0);
    expect(scale.transformedDomain[0]).toBe(0);
    expect(scale.invert(0)).toBe(0);
  });

  it("rejects a non-identity transform when the mapped field infers temporal", () => {
    try {
      runPipeline(
        {
          data: {
            values: [
              { when: "2024-01-01", y: 1 },
              { when: "2024-01-02", y: 2 },
            ],
          },
          aes: { x: "when", y: "y" },
          layers: [{ geom: "point" }],
          scales: { x: { transform: "log10" } },
        },
        size,
      );
      throw new Error("expected runPipeline to reject the inferred temporal transform");
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as InstanceType<typeof PipelineError>).code).toBe(
        "scale-type-transform-conflict",
      );
    }
  });

  it("retains transform-domain diagnostics after runtime row filtering", () => {
    const model = runPipeline(
      gg(
        [
          { x: -1, y: 1, group: "keep" },
          { x: 10, y: 2, group: "keep" },
          { x: 100, y: 3, group: "hide" },
        ],
        aes({ x: "x", y: "y", color: "group" }),
      )
        .geomPoint()
        .scales(scaleXLog10())
        .spec(),
      {
        ...size,
        rowFilters: [{ scale: "color", field: "group", mode: "exclude", values: ["hide"] }],
      },
    );
    expect(model.warnings.some((warning) => warning.code === "scale-transform-domain")).toBe(true);
    expect(
      model.scaleDiagnostics.some(
        (diagnostic) =>
          diagnostic.code === "scale-transform-domain" && diagnostic.evidence?.failedCount === 1,
      ),
    ).toBe(true);
  });
});

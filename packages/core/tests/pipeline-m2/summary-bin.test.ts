/**
 * M2 pipeline — stat summary_bin on point / line / errorbar (#817).
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { PathsBatch, PointsBatch, SegmentsBatch } from "../../src/scene.ts";
import { size } from "./fixtures.ts";

const data = {
  x: [0.5, 1.5, 1.6, 2.5, 2.4],
  y: [10, 20, 30, 40, 50],
};

describe("stat summary_bin (#817)", () => {
  it("errorbar summary_bin emits segments for non-empty bins", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomErrorbar({ stat: "summary_bin", binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as SegmentsBatch;
    expect(batch.kind).toBe("segments");
    // 3 non-empty bins → 3 vertical ranges (each errorbar = 3 segments typically)
    expect(batch.segments.length / 4).toBeGreaterThanOrEqual(3);
  });

  it("point summary_bin emits one mark per non-empty bin", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomPoint({ stat: "summary_bin", binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PointsBatch;
    expect(batch.kind).toBe("points");
    expect(batch.positions.length / 2).toBe(3);
  });

  it("line summary_bin connects bin centers", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomLine({ stat: "summary_bin", binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    // one open path with 3 vertices (non-empty bins)
    expect(batch.positions.length / 2).toBe(3);
    expect(batch.pathOffsets.length).toBe(2);
  });

  it("median summary_bin over a reversed date y yields finite step vertices", () => {
    // Kyoto lesson contract (#1066): bloom days are ISO dates on a reversed
    // date scale. positionColumn only special-cases temporalKind "time", so
    // date y must still produce finite binned medians.
    const bloom = {
      year: [800, 810, 820, 900, 910, 920, 1000, 1010, 1020],
      day: [
        "2001-04-20",
        "2001-04-18",
        "2001-04-22",
        "2001-04-15",
        "2001-04-14",
        "2001-04-16",
        "2001-04-10",
        "2001-04-12",
        "2001-04-11",
      ],
    };
    const model = runPipeline(
      gg(bloom, aes({ x: "year", y: "day" }))
        .geomLine({
          stat: "summary_bin",
          fun: "median",
          binwidth: 50,
          curve: "step-hv",
        })
        .scaleYDate({
          reverse: true,
          breaks: ["2001-04-05", "2001-04-15", "2001-04-25"],
          dateLabels: "%b %d",
          domain: ["2001-05-10", "2001-03-18"],
        })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.curve).toBe("step-hv");
    const n = batch.positions.length / 2;
    expect(n).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < batch.positions.length; i++) {
      expect(Number.isFinite(batch.positions[i]!)).toBe(true);
    }
    // Earlier median (later century) sits higher on the reversed date axis.
    // Bins: ~800–850, ~900–950, ~1000–1050 → y medians ~Apr 20, Apr 15, Apr 11.
    const y0 = batch.positions.at(1);
    const yLast = batch.positions.at(-1);
    if (y0 === undefined || yLast === undefined) {
      throw new Error("expected path vertices for summary_bin median trend");
    }
    expect(yLast).toBeLessThan(y0);
    const labels = model.scene.panels[0]?.axisY?.map((tick) => tick.label) ?? [];
    expect(labels).toEqual(["Apr 05", "Apr 15", "Apr 25"]);
  });

  it("default bins emits advisory", () => {
    const model = runPipeline(
      gg(data, aes({ x: "x", y: "y" }))
        .geomPoint({ stat: "summary_bin" })
        .spec(),
      size,
    );
    expect(model.advisories.some((a) => a.code === "bin-default-bins")).toBe(true);
  });

  it("center + boundary is rejected", () => {
    expect(() =>
      runPipeline(
        gg(data, aes({ x: "x", y: "y" }))
          .geomPoint({
            stat: "summary_bin",
            binwidth: 1,
            center: 0,
            boundary: 0,
          })
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("discrete x is rejected", () => {
    expect(() =>
      runPipeline(
        gg({ x: ["a", "b", "a"], y: [1, 2, 3] }, aes({ x: "x", y: "y" }))
          .geomPoint({ stat: "summary_bin", bins: 5 })
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
  });
});

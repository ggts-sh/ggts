/**
 * after_stat color/fill diagnostics (#915).
 *
 * Supported stats (bin, count, density, density_2d, bin_hex, …) publish
 * columns in STAT_COLOR_COLUMNS and resolve them via colorColumns (#953).
 * Unsupported stats still emit `stat-channel-unsupported`.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../src/pipeline.ts";

const size = { width: 400, height: 300 };

function statChannelWarnings(warnings: readonly { code: string; message: string }[]): string[] {
  return warnings.filter((w) => w.code === "stat-channel-unsupported").map((w) => w.message);
}

function cloud(n: number): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    x.push(Math.cos(i) * 2);
    y.push(Math.sin(i * 1.7) * 2);
  }
  return { x, y };
}

describe("after_stat color/fill (#915)", () => {
  it("stays silent for geom_histogram fill = after_stat(count) (#953)", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 2, 3, 3, 3] }, aes({ x: "x", fill: { stat: "count" } }))
        .geomHistogram({ binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    expect(statChannelWarnings(model.warnings)).toEqual([]);
    expect(model.scene.batches.length).toBeGreaterThan(0);
  });

  it("warns for after_stat color on a stat with no colour outputs", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 3], y: [1, 2, 3] }, aes({ x: "x", y: "y", color: { stat: "y" } }))
        .geomPoint({ stat: "summary_bin", binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    expect(statChannelWarnings(model.warnings).length).toBe(1);
  });

  it("publishes the rolling summary to style channels like summary_bin does", () => {
    // Review on #1470: spec validation accepts { stat: "y" } on any channel of
    // a summary_rolling layer, but the style after-stat map had no entry, so
    // a validated spec threw stat-channel-unsupported at render.
    const model = runPipeline(
      gg({ x: [1, 2, 3, 4, 5], y: [1, 4, 2, 8, 3] }, aes({ x: "x", y: "y" }))
        .geomLine({ stat: "summary_rolling", window: 3, fun: "mean" })
        .spec(),
      size,
    );
    expect(model.scene.batches.length).toBeGreaterThan(0);
    const styled = runPipeline(
      gg(
        { x: [1, 2, 3, 4, 5], y: [1, 4, 2, 8, 3] },
        aes({ x: "x", y: "y", linewidth: { stat: "y" } }),
      )
        .geomLine({ stat: "summary_rolling", window: 3, fun: "mean" })
        .spec(),
      size,
    );
    expect(statChannelWarnings(styled.warnings)).toEqual([]);
    expect(styled.scene.batches.length).toBeGreaterThan(0);
  });

  it("stays silent for density_2d_filled fill = after_stat(level)", () => {
    const model = runPipeline(
      gg(cloud(60), aes({ x: "x", y: "y" }))
        .geomDensity2dFilled({ n: 20, bins: 4 })
        .spec(),
      size,
    );
    expect(statChannelWarnings(model.warnings)).toEqual([]);
  });

  it("stays silent for density_2d color = after_stat(level)", () => {
    const model = runPipeline(
      gg(cloud(60), aes({ x: "x", y: "y", color: { stat: "level" } }))
        .geomDensity2d({ n: 20, bins: 4 })
        .spec(),
      size,
    );
    expect(statChannelWarnings(model.warnings)).toEqual([]);
  });

  it("stays silent for geom_hex color/fill = after_stat(count)", () => {
    const model = runPipeline(
      gg(cloud(40), aes({ x: "x", y: "y", color: { stat: "count" }, fill: { stat: "count" } }))
        .geomHex({ bins: 8 })
        .spec(),
      size,
    );
    expect(statChannelWarnings(model.warnings)).toEqual([]);
  });

  it("warns for an unknown column even on density_2d_filled", () => {
    const model = runPipeline(
      gg(cloud(60), aes({ x: "x", y: "y", fill: { stat: "bogus" } }))
        .geomDensity2dFilled({ n: 20, bins: 4 })
        .spec(),
      size,
    );
    const messages = statChannelWarnings(model.warnings);
    expect(messages.length).toBe(1);
    expect(messages[0]).toContain("bogus");
  });

  it("does not warn for ordinary field-mapped fill", () => {
    const model = runPipeline(
      gg({ x: [1, 2, 3], g: ["a", "b", "a"] }, aes({ x: "x", fill: "g" }))
        .geomHistogram({ binwidth: 1, boundary: 0 })
        .spec(),
      size,
    );
    expect(statChannelWarnings(model.warnings)).toEqual([]);
  });
});

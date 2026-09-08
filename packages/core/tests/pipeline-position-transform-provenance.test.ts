/**
 * PR 3 — stat-output transform provenance.
 *
 * Every position read routes through the effective axis program with an
 * internal role: `source-applied` (already handled by TransformedColumnView),
 * `scale-space` (a stat computed its output FROM already-transformed inputs —
 * smooth x/y/bands, bin x/xmin/xmax, density x, summary/boxplot aggregates —
 * and must never be forwarded again), or `semantic-measure` (a stat-invented
 * mapped measure — count, density, scaled/ncount/ndensity, and bin-count
 * equivalents — computed in its own units and forwarded through the axis
 * transform exactly once, before position/training). This file proves the
 * `semantic-measure` half of that contract and guards against transform²
 * (double-forwarding a value that was already scale-space).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg, scaleYLog10 } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";

const size = { width: 640, height: 400 };

function yScale(model: ReturnType<typeof runPipeline>) {
  const scale = model.scales.y;
  if (scale.type === "band") throw new Error("expected a continuous y scale");
  return scale;
}

describe("count measure — semantic-measure: forwarded exactly once", () => {
  it("scaleYLog10 on a count-stat bar chart trains on log10(count), not a raw-count-as-transformed misread", () => {
    const rows = [
      ...Array.from({ length: 10 }, () => ({ g: "a" })),
      ...Array.from({ length: 100 }, () => ({ g: "b" })),
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "g" }))
        .geomBar()
        .scales(scaleYLog10())
        .spec(),
      size,
    );
    const scale = yScale(model);
    expect(scale.transform).toBe("log10");
    // Correct: the semantic domain covers the real counts (10..100), padded.
    // Bug (measure never forwarded): raw counts [10, 100] get trained AS THE
    // TRANSFORMED domain, so the public semantic domain becomes
    // 10^10..10^100 — many orders of magnitude off.
    expect(scale.domain[0]).toBeGreaterThan(0);
    expect(scale.domain[1]).toBeLessThan(1000);
  });

  it("count measure and a stack-position count measure produce log-uniform bar-top spacing", () => {
    const rows = [
      ...Array.from({ length: 10 }, () => ({ g: "a" })),
      ...Array.from({ length: 100 }, () => ({ g: "b" })),
      ...Array.from({ length: 1000 }, () => ({ g: "c" })),
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "g" }))
        .geomBar()
        .scales(scaleYLog10())
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "rects");
    if (batch === undefined || batch.kind !== "rects") throw new Error("expected a rects batch");
    // rects: [x, y(top), w, h] per row, panel-local px, y = top edge.
    const tops = Array.from({ length: batch.rects.length / 4 }, (_, i) => batch.rects[i * 4 + 1]!);
    tops.sort((a, b) => b - a); // ascending bar height => descending top-y
    const gap1 = tops[0]! - tops[1]!;
    const gap2 = tops[1]! - tops[2]!;
    // Equal decade ratios (10 -> 100 -> 1000) render at equal pixel gaps on a
    // correctly forwarded log10 measure axis; the un-forwarded bug produces
    // wildly unequal gaps (raw counts trained as if already log-spaced).
    expect(gap1 / gap2).toBeGreaterThan(0.8);
    expect(gap1 / gap2).toBeLessThan(1.25);
  });
});

describe("density y measure — semantic-measure: forwarded exactly once", () => {
  it("scaleYLog10 on a density layer's domain reaches well below 1 (the real KDE values), not clustered at ~1", () => {
    // Density estimates here are small positive numbers (<< 1, peak ~0.05).
    // The area's zero-baseline sits at the transformed origin 0 (semantic 1)
    // and is legitimately part of the trained extent (task 2), so the domain
    // upper bound is baseline-dominated — but the LOWER bound is diagnostic:
    // correct (forwarded) density values are strongly negative in log10
    // space (log10(0.00002)..log10(0.047) ~= -4.7..-1.3), giving a semantic
    // lower bound far below 1. The bug (measure never forwarded) misreads
    // the raw density values themselves as already-transformed, so the
    // extent clusters at [0, ~0.05] and the semantic domain lower bound
    // lands near 10^0 = 1 instead.
    const rows = Array.from({ length: 200 }, (_, i) => ({ x: Math.sin(i / 7) * 10 + i / 20 }));
    const model = runPipeline(
      gg(rows, aes({ x: "x" }))
        .geomDensity()
        .scales(scaleYLog10())
        .spec(),
      size,
    );
    const scale = yScale(model);
    expect(scale.transform).toBe("log10");
    expect(scale.domain[0]).toBeLessThan(0.01);
  });

  it("bin density measure (a histogram's y = { stat: 'density' }) renders equal-ratio bins at equal log10 pixel gaps", () => {
    // Three well-separated single-bin spikes (binwidth 1000, spikes tightly
    // clustered well inside each bin) with counts in ratio 1:10:100.
    const rows = [
      { x: 500 },
      ...Array.from({ length: 10 }, () => ({ x: 1500 })),
      ...Array.from({ length: 100 }, () => ({ x: 2500 })),
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: { stat: "density" } }))
        .geomHistogram({ binwidth: 1000, boundary: 0 })
        .scales(scaleYLog10())
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "rects");
    if (batch === undefined || batch.kind !== "rects") throw new Error("expected a rects batch");
    // Density values here are all << semantic 1 (the log10 baseline), so
    // every bar grows DOWNWARD from a near-top baseline; the bottom edge
    // (y + height), not the top edge, carries the per-bin value signal.
    const bottoms = Array.from(
      { length: batch.rects.length / 4 },
      (_, i) => batch.rects[i * 4 + 1]! + batch.rects[i * 4 + 3]!,
    );
    bottoms.sort((a, b) => a - b);
    const gap1 = bottoms[1]! - bottoms[0]!;
    const gap2 = bottoms[2]! - bottoms[1]!;
    expect(gap1 / gap2).toBeGreaterThan(0.8);
    expect(gap1 / gap2).toBeLessThan(1.25);
  });
});

describe("bin count measure — semantic-measure: forwarded exactly once", () => {
  it("scaleYLog10 on a histogram's count axis keeps a finite, plausible semantic domain", () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({ x: i % 50 }));
    const model = runPipeline(
      gg(rows, aes({ x: "x" }))
        .geomHistogram({ bins: 10 })
        .scales(scaleYLog10())
        .spec(),
      size,
    );
    const scale = yScale(model);
    expect(scale.transform).toBe("log10");
    expect(scale.domain[0]).toBeGreaterThan(0);
    expect(scale.domain[1]).toBeLessThan(1000);
  });
});

describe("transform² guard — scale-space stat outputs are never forwarded twice", () => {
  it("a smooth fit's y under scaleYLog10 is NOT the same as forwarding its output again", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ x: i + 1, y: (i + 1) * 3 }));
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomSmooth()
        .scales(scaleYLog10())
        .spec(),
      size,
    );
    const scale = yScale(model);
    expect(scale.transform).toBe("log10");
    // The fitted line is over transformed (log10) y; the semantic domain must
    // stay in the neighborhood of the real y data (3..120) — a transform²
    // bug (re-forwarding an already-scale-space fit) would land the domain
    // an order of magnitude away, not just drift from loess endpoint fit.
    expect(scale.domain[0]).toBeGreaterThan(0.1);
    expect(scale.domain[0]).toBeLessThanOrEqual(10);
    expect(scale.domain[1]).toBeGreaterThanOrEqual(50);
    expect(scale.domain[1]).toBeLessThan(1000);
  });

  it("boxplot aggregates under scaleYLog10 stay in the real data's neighborhood (no re-forward)", () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ g: i % 2 === 0 ? "a" : "b", y: 10 + i }));
    const model = runPipeline(
      gg(rows, aes({ x: "g", y: "y" }))
        .geomBoxplot()
        .scales(scaleYLog10())
        .spec(),
      size,
    );
    const scale = yScale(model);
    expect(scale.transform).toBe("log10");
    expect(scale.domain[0]).toBeGreaterThan(0);
    expect(scale.domain[0]).toBeLessThanOrEqual(15);
    expect(scale.domain[1]).toBeGreaterThanOrEqual(65);
  });
});

/**
 * Gate G4 — the rolling-median trend: one window median per observation
 * year, joined linearly, smoother than the raw series it summarizes.
 */
import { runPipeline } from "@ggts-sh/core";
import { describe, expect, it } from "bun:test";

import { foldSakura } from "../quickstart.ts";
import { makeRows } from "./test-helpers.ts";

const rows = makeRows();

describe("gate G4 — the rolling-median trend", () => {
  it("draws one window median per observation year, joined linearly", () => {
    // foldSakura(1): theme + trend + chartlines + y-tick polish (finished reading order for signal).
    const model = runPipeline(foldSakura(1, rows).spec, { width: 900, height: 360 });
    const trend = model.scene.batches.find((batch) => batch.kind === "paths");
    expect(trend).toBeDefined();
    expect(trend!.curve).toBe("linear");
    const vertices = trend!.positions.length / 2;
    // summary_rolling emits one row per unique x — the whole series, not a
    // binned decimation.
    expect(vertices).toBe(new Set(rows.map((row) => row.year)).size);
    // And it is smoother than the raw series it summarizes: the average
    // year-to-year vertical step of the line sits well under the points'.
    const points = model.scene.batches.find((batch) => batch.kind === "points");
    expect(points).toBeDefined();
    expect(meanYStep(trend!.positions)).toBeLessThan(meanYStep(points!.positions) / 2);
  });

  it("reads as one signal: flat for a millennium, then early", () => {
    const model = runPipeline(foldSakura(1, rows).spec, { width: 900, height: 360 });
    const trend = model.scene.batches.find((batch) => batch.kind === "paths");
    expect(trend).toBeDefined();
    // Screen y grows downward; reverse date scale puts earlier bloom higher
    // (smaller y). Average the pre-industrial middle third vs the modern last
    // third — a single end bin can be noisy.
    const n = trend!.positions.length / 2;
    const third = Math.floor(n / 3);
    let midSum = 0;
    let lateSum = 0;
    for (let i = third; i < 2 * third; i += 1) midSum += trend!.positions[i * 2 + 1]!;
    for (let i = n - third; i < n; i += 1) lateSum += trend!.positions[i * 2 + 1]!;
    expect(lateSum / third).toBeLessThan(midSum / third);
  });
});

/** Mean absolute step between consecutive y positions (screen px). */
function meanYStep(positions: ArrayLike<number>) {
  let sum = 0;
  const n = positions.length / 2;
  for (let i = 1; i < n; i += 1)
    sum += Math.abs(positions[i * 2 + 1]! - positions[(i - 1) * 2 + 1]!);
  return sum / (n - 1);
}

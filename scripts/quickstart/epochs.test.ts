/**
 * Gates G5, G7, G9 — the climate epoch bands. They claim periods, not the
 * record; they never capture inspection (#1068); and they still encompass
 * every observation.
 */
import { runPipeline } from "@ggts-sh/core";
import { describe, expect, it } from "bun:test";

import { SAKURA_EPOCHS, SAKURA_STEPS, foldSakura } from "../quickstart.ts";
import { makeRows } from "./test-helpers.ts";

const rows = makeRows();

describe("gate G5 — climate epoch bands claim periods, not the record", () => {
  it("starts after the first observation and leaves a gap between MWP and LIA", () => {
    expect(SAKURA_EPOCHS.map((band) => [band.year, band.until])).toEqual([
      [950, 1250],
      [1300, 1850],
      [1850, 2026],
    ]);
    // First band does not start at the first observation year.
    expect(SAKURA_EPOCHS[0]!.year).toBeGreaterThan(812);
    // Gap between Medieval Warm Period and Little Ice Age.
    expect(SAKURA_EPOCHS[1]!.year).toBeGreaterThan(SAKURA_EPOCHS[0]!.until);
  });

  it("folds those bounds into the rect layer and the source const", () => {
    const folded = foldSakura(2, rows);
    const epochs = folded.spec.layers.find((layer) => layer.geom === "rect");
    expect(epochs?.data).toEqual({ values: SAKURA_EPOCHS });
    expect(folded.source).toContain("year: 950, until: 1250");
    expect(folded.source).toContain("year: 1300, until: 1850");
    // Bands claim climate periods, not the extent of the record.
    expect(folded.source).not.toContain("year: 812");
  });
});

/**
 * #1068: epoch bands are labelled decoration. Without `inspect: false` a
 * full-panel rect reports distance 0 for any pointer inside it, so nearest
 * never reaches a bloom observation or the trend — the two things the chart
 * is about. #1065 shipped the opt-out; this gate keeps the lesson using it.
 */
describe("gate G7 — epoch bands never capture inspection (#1068)", () => {
  const size = { width: 900, height: 480 } as const;
  const epochStep = SAKURA_STEPS[1]!;

  it("opts epochs out of inspection in the step delta", () => {
    expect(epochStep.id).toBe("add-epoch-bands");
    const layers = epochStep.spec.layers as { epochs?: { inspect?: false } } | undefined;
    expect(layers?.epochs?.inspect).toBe(false);
  });

  it("folds inspect: false onto the decorative epoch layers from the step that introduces them", () => {
    // foldSakura(2) = first two steps; step 1 is add-epoch-bands.
    const folded = foldSakura(2, rows);
    const epochs = folded.spec.layers[layerWithValues(folded.spec.layers, SAKURA_EPOCHS)];
    expect(epochs?.geom).toBe("rect");
    expect(epochs?.inspect).toBe(false);
    const names = folded.spec.layers.find(
      (layer) => layer.geom === "text" && layer.inspect === false,
    );
    expect(names).toBeDefined();
  });

  it("prints inspect={false} in the fragment and the folded source the reader copies", () => {
    // Force the source/fragment red first; the component-prop whitelist is
    // widened only after this assertion would otherwise fail for the right reason.
    expect(epochStep.fragment).toContain("inspect={false}");
    const folded = foldSakura(2, rows);
    expect(folded.source).toContain("inspect={false}");
    expect(folded.source).toMatch(/<GeomRect[\s\S]*?inspect=\{false\}/);
    expect(folded.source).toMatch(/<GeomText[\s\S]*?inspect=\{false\}/);
    // Decorative epoch edge rules were removed — they only fought gridlines.
    expect(folded.source).not.toContain("epochEdges");
  });

  for (const annotations of [true, false] as const) {
    const label = annotations ? "wide (with callouts)" : "narrow (annotations dropped)";

    it(`keeps decorative layers out of candidates on the ${label} finished chart`, () => {
      // Narrow hosts fold with { annotations: false }; layer
      // indexes differ (7 vs 5), so both variants must pass.
      const folded = foldSakura(SAKURA_STEPS.length, rows, { annotations });
      const model = runPipeline(folded.spec, size);
      const layers = folded.spec.layers;

      const epochIndex = layerWithValues(layers, SAKURA_EPOCHS);
      expect(epochIndex, "epochs layer present").toBeGreaterThanOrEqual(0);
      expect(layers[epochIndex]!.geom).toBe("rect");

      for (let id = 0; id < model.candidates.size; id += 1) {
        const candidate = model.candidates.candidate(id);
        if (candidate === null) continue;
        expect(candidate.layerIndex).not.toBe(epochIndex);
      }
    });

    it(`lets nearest on an observation reach the points layer on the ${label} chart`, () => {
      const folded = foldSakura(SAKURA_STEPS.length, rows, { annotations });
      const model = runPipeline(folded.spec, size);
      const layers = folded.spec.layers;
      const pointIndex = layers.findIndex((layer) => layer.geom === "point");
      const epochIndex = layerWithValues(layers, SAKURA_EPOCHS);
      expect(pointIndex).toBeGreaterThanOrEqual(0);

      // Late-record observations: an on-mark probe must return the bloom point
      // (year + date), not a band. Off-mark exact returns null after opt-out —
      // do not expect a substitute point at panel center.
      //
      // Not every observation answers as the point. The median trend line is a
      // stepped stroke drawn over the points, and topmost-hit gives it the
      // observations it covers. So this asserts what the gate is for: SOME
      // observation is reachable, and the epoch band is NEVER the answer.
      const probes: { x: number; y: number; year: number; date: string }[] = [];
      for (let id = 0; id < model.candidates.size; id += 1) {
        const candidate = model.candidates.candidate(id);
        if (candidate === null || candidate.layerIndex !== pointIndex) continue;
        if (typeof candidate.xValue !== "number") continue;
        if (candidate.xValue < 1995 || candidate.xValue > 2005) continue;
        if (typeof candidate.yValue !== "string") continue;
        probes.push({
          x: candidate.x,
          y: candidate.y,
          year: candidate.xValue,
          date: candidate.yValue,
        });
      }
      expect(probes.length, "expected point candidates near year 2000").toBeGreaterThan(0);

      let reached = 0;
      for (const probe of probes) {
        const hit = model.candidates.nearest(probe.x, probe.y, {
          mode: "exact",
          maxDistance: 24,
        });
        expect(hit).not.toBeNull();
        // The band never wins on a mark, whichever layer does.
        expect(hit!.layerIndex).not.toBe(epochIndex);
        // Band geometry columns must not leak through the winning candidate.
        expect(hit!.xValue).not.toBe("top");
        expect(String(hit!.yValue)).not.toMatch(/^(top|bottom|until)$/);
        if (hit!.layerIndex !== pointIndex) continue;
        expect(hit!.xValue).toBe(probe.year);
        expect(hit!.yValue).toBe(probe.date);
        reached += 1;
      }
      expect(reached, "expected an observation to answer as the points layer").toBeGreaterThan(0);

      // Empty space used to answer as the band (distance 0). After opt-out,
      // exact mode returns nothing off-mark — or at least never the band.
      const empty = model.candidates.nearest(size.width / 2, size.height / 2, {
        mode: "exact",
        maxDistance: size.width,
      });
      if (empty !== null) {
        expect(empty.layerIndex).not.toBe(epochIndex);
      }
    });
  }
});

describe("gate G9 — epoch bands encompass every observation", () => {
  it("sets band top early enough that every bloom sits inside the fill", () => {
    // Earliest bloom in the record is 25 March. Band top stays at 18 March so
    // those points sit inside the rect; domain top is earlier still (name strip).
    for (const band of SAKURA_EPOCHS) {
      expect(band.top).toBe("03-18");
      expect(band.bottom).toBe("05-10");
    }
  });
});

/** Layer lookup by inline data values — not by geom (finished fold has two rules). */
function layerWithValues(layers: readonly { data?: unknown }[], values: unknown): number {
  return layers.findIndex((layer) => {
    const data = layer.data;
    if (data === undefined || typeof data !== "object" || data === null) return false;
    if (!("values" in data)) return false;
    return data.values === values;
  });
}

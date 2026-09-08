import { describe, expect, it } from "bun:test";

import { aes, gg, scaleXBinned, scaleXLog10, scaleYLog10 } from "@ggts-sh/spec";

import { PipelineError, runPipeline } from "../src/pipeline.ts";

const size = { width: 400, height: 240 };

function lineage(model: ReturnType<typeof runPipeline>, candidateId: number): number[] {
  const candidate = model.candidates.candidate(candidateId)!;
  return [...model.lineage.keys(candidate.lineage)].toSorted((a, b) => a - b);
}

describe("stat interaction contract", () => {
  it("advertises only generated semantic fields candidates can supply", () => {
    const histogram = runPipeline(
      {
        data: { values: [{ x: 0 }, { x: 0.2 }, { x: 1.2 }] },
        layers: [
          {
            geom: "histogram",
            aes: { x: { field: "x" } },
            params: { binwidth: 1, boundary: 0 },
          },
        ],
      },
      size,
    );
    expect(histogram.layerFields[0]).toEqual([
      { channel: "x", field: "x", source: "stat" },
      { channel: "y", field: "count", source: "stat" },
    ]);

    const densityHistogram = runPipeline(
      {
        data: { values: [{ x: 0 }, { x: 0.2 }, { x: 1.2 }] },
        layers: [
          {
            geom: "histogram",
            aes: { x: { field: "x" }, y: { stat: "density" } },
            params: { binwidth: 1, boundary: 0 },
          },
        ],
      },
      size,
    );
    expect(densityHistogram.layerFields[0]).toEqual([
      { channel: "x", field: "x", source: "stat" },
      { channel: "y", field: "density", source: "stat" },
    ]);

    const smooth = runPipeline(
      {
        data: {
          values: [
            { x: 0, y: 1 },
            { x: 1, y: 3 },
            { x: 2, y: 5 },
          ],
        },
        layers: [
          {
            geom: "smooth",
            stat: "smooth",
            aes: { x: { field: "x" }, y: { field: "y" } },
            params: { method: "lm", se: false },
          },
        ],
      },
      size,
    );
    expect(smooth.layerFields[0]).toEqual([
      { channel: "x", field: "x", source: "stat" },
      { channel: "y", field: "y", source: "stat" },
    ]);

    const boxplot = runPipeline(
      {
        data: {
          values: [
            { group: "a", y: 1 },
            { group: "a", y: 3 },
          ],
        },
        layers: [
          {
            geom: "boxplot",
            stat: "boxplot",
            aes: { x: { field: "group" }, y: { field: "y" } },
          },
        ],
      },
      size,
    );
    expect(boxplot.layerFields[0]).toEqual([
      { channel: "x", field: "x", source: "stat" },
      { channel: "y", field: "middle", source: "stat" },
    ]);

    const summary = runPipeline(
      {
        data: {
          values: [
            { group: "a", y: 1 },
            { group: "a", y: 3 },
          ],
        },
        layers: [
          {
            geom: "errorbar",
            stat: "summary",
            aes: { x: { field: "group" }, y: { field: "y" } },
          },
        ],
      },
      size,
    );
    expect(summary.layerFields[0]).toEqual([
      { channel: "x", field: "x", source: "stat" },
      { channel: "y", field: "y", source: "stat" },
    ]);
  });

  it("exposes histogram centers, computed measures, and exact bin lineage", () => {
    const model = runPipeline(
      {
        data: { values: [{ x: 0 }, { x: 0.2 }, { x: 1.2 }] },
        layers: [
          {
            geom: "histogram",
            aes: { x: { field: "x" } },
            params: { binwidth: 1, boundary: 0 },
          },
        ],
      },
      size,
    );

    expect(model.candidates.candidate(0)).toMatchObject({ xValue: 0.5, yValue: 2 });
    expect(lineage(model, 0)).toEqual([0, 1]);
    expect(model.candidates.candidate(1)).toMatchObject({ xValue: 1.5, yValue: 1 });
    expect(lineage(model, 1)).toEqual([2]);
  });

  it("assigns log10 histogram lineage in transformed space (not raw semantics)", () => {
    // binwidth 1 at boundary 0 under log10 → decade bins; rows 1,10,100,1000
    // land in three bins with counts 2,1,1 — lineage must match those counts.
    const model = runPipeline(
      gg(
        [1, 10, 100, 1000].map((x) => ({ x })),
        aes({ x: "x" }),
      )
        .geomHistogram({ binwidth: 1, boundary: 0 })
        .scales(scaleXLog10())
        .spec(),
      size,
    );
    const lineages = Array.from({ length: model.candidates.size }, (_, id) => lineage(model, id));
    const counts = Array.from({ length: model.candidates.size }, (_, id) => {
      const candidate = model.candidates.candidate(id)!;
      return { y: candidate.yValue, n: lineages[id]!.length, rows: lineages[id] };
    });
    expect(counts.map((c) => c.y)).toEqual([2, 1, 1]);
    expect(counts.map((c) => c.n)).toEqual([2, 1, 1]);
    expect(lineages.flat().toSorted((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });

  it("resolves binned count lineage by bin id, not inverse bin center", () => {
    const model = runPipeline(
      gg([{ x: 1 }, { x: 2 }, { x: 11 }, { x: 12 }, { x: 13 }], aes({ x: "x" }))
        .geomBar()
        .scales(scaleXBinned({ breaks: [0, 10, 20] }))
        .spec(),
      size,
    );
    expect(model.candidates.size).toBe(2);
    expect(model.candidates.candidate(0)).toMatchObject({ yValue: 2 });
    expect(lineage(model, 0)).toEqual([0, 1]);
    expect(model.candidates.candidate(1)).toMatchObject({ yValue: 3 });
    expect(lineage(model, 1)).toEqual([2, 3, 4]);
  });

  it("excludes transform-invalid rows from smooth candidate lineage", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1 },
          { x: 2, y: 4 },
          { x: 3, y: 9 },
          { x: 4, y: -1 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomSmooth({ method: "lm", se: false })
        .scales(scaleYLog10())
        .spec(),
      size,
    );
    expect(model.candidates.size).toBeGreaterThan(0);
    for (let id = 0; id < model.candidates.size; id++) {
      expect(lineage(model, id)).toEqual([0, 1, 2]);
    }
  });

  it("rejects temporal annotation intercepts under a non-identity transform", () => {
    expect(() =>
      runPipeline(
        {
          data: { values: [{ dummy: 1 }] },
          layers: [{ geom: "rule", params: { xintercept: "2024-01-01" } }],
          scales: { x: { transform: "log10", nice: false } },
        },
        size,
      ),
    ).toThrow(PipelineError);
    try {
      runPipeline(
        {
          data: { values: [{ dummy: 1 }] },
          layers: [{ geom: "rule", params: { xintercept: "2024-01-01" } }],
          scales: { x: { transform: "log10", nice: false } },
        },
        size,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      expect((error as PipelineError).code).toBe("scale-type-transform-conflict");
    }
  });

  it("allows forced-linear numeric annotation strings under log10", () => {
    const model = runPipeline(
      {
        data: { values: [{ dummy: 1 }] },
        layers: [{ geom: "rule", params: { xintercept: "2024" } }],
        scales: { x: { type: "linear", transform: "log10", nice: false } },
      },
      size,
    );
    expect(model.domains.effective.x[0]).toBeGreaterThan(0);
    expect(model.domains.effective.x[1]).toBeGreaterThan(model.domains.effective.x[0]!);
  });

  it("still rejects non-finite date intercepts on forced-linear log axes", () => {
    expect(() =>
      runPipeline(
        {
          data: { values: [{ dummy: 1 }] },
          layers: [{ geom: "rule", params: { xintercept: "2024-01-01" } }],
          scales: { x: { type: "linear", transform: "log10", nice: false } },
        },
        size,
      ),
    ).toThrow(PipelineError);
  });

  it("uses the box middle for aggregate primitives and the observation for outliers", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { group: "a", y: 1 },
            { group: "a", y: 2 },
            { group: "a", y: 3 },
            { group: "a", y: 100 },
          ],
        },
        layers: [
          {
            geom: "boxplot",
            stat: "boxplot",
            aes: { x: { field: "group" }, y: { field: "y" } },
          },
        ],
      },
      size,
    );
    const candidates = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    );
    const box = candidates.find((candidate) => candidate?.kind === "rects")!;
    const outlier = candidates.find((candidate) => candidate?.kind === "points")!;

    expect(box).toMatchObject({ xValue: "a", yValue: 2.5 });
    expect(lineage(model, box.id)).toEqual([0, 1, 2, 3]);
    expect(outlier).toMatchObject({ xValue: "a", yValue: 100 });
    expect(lineage(model, outlier.id)).toEqual([3]);
  });

  it("exposes summary centers and memberships", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { group: "a", y: 1 },
            { group: "a", y: 3 },
            { group: "b", y: 10 },
            { group: "b", y: 14 },
          ],
        },
        layers: [
          {
            geom: "errorbar",
            stat: "summary",
            aes: { x: { field: "group" }, y: { field: "y" } },
          },
        ],
      },
      size,
    );

    expect(model.candidates.candidate(0)).toMatchObject({ xValue: "a", yValue: 2 });
    expect(lineage(model, 0)).toEqual([0, 1]);
    expect(model.candidates.candidate(3)).toMatchObject({ xValue: "b", yValue: 12 });
    expect(lineage(model, 3)).toEqual([2, 3]);
  });

  it("exposes fitted smooth coordinates with the fitted group's lineage", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { x: 0, y: 1 },
            { x: 1, y: 3 },
            { x: 2, y: 5 },
          ],
        },
        layers: [
          {
            geom: "smooth",
            stat: "smooth",
            aes: { x: { field: "x" }, y: { field: "y" } },
            params: { method: "lm", se: false },
          },
        ],
      },
      size,
    );

    const first = model.candidates.candidate(0)!;
    const last = model.candidates.candidate(model.candidates.size - 1)!;
    expect(first.xValue).toBeCloseTo(0);
    expect(first.yValue).toBeCloseTo(1);
    expect(last.xValue).toBeCloseTo(2);
    expect(last.yValue).toBeCloseTo(5);
    expect(lineage(model, first.id)).toEqual([0, 1, 2]);
    expect(lineage(model, last.id)).toEqual([0, 1, 2]);
  });
});

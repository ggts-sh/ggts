/**
 * M1 geoms: col, bar, area, rule, text, and multi-geom determinism.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import type { SpecInput } from "@ggts-sh/spec";
import { EDITION_DEFAULTS } from "../../src/editions.ts";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import { renderToSVGString } from "../../src/render-svg-full.ts";
import type { GlyphsBatch, PathsBatch, RectsBatch, SegmentsBatch } from "../../src/scene.ts";
import { salesRows, size } from "./fixtures.ts";

describe("col geom (stacked by default)", () => {
  const spec = () =>
    gg(salesRows, aes({ x: "city", y: "sales", fill: "kind" }))
      .geomCol()
      .spec();

  it("emits a rects batch with stacked heights and per-rect fills", () => {
    const model = runPipeline(spec(), size);
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.kind).toBe("rects");
    expect(batch.rects.length / 4).toBe(4);
    expect(batch.fills).toHaveLength(4);
    expect(new Set(batch.fills).size).toBe(2);
    // stacked: two rects per band share x and abut vertically. Row 0
    // (Berlin/web, first-seen group) stacks ON TOP (ggplot2 order): its
    // bottom edge equals the store rect's top edge.
    const x0 = batch.rects[0]!;
    const x4 = batch.rects[4]!;
    expect(x0).toBeCloseTo(x4, 4);
    const webBottom = batch.rects[1]! + batch.rects[3]!;
    const storeTop = batch.rects[5]!;
    expect(webBottom).toBeCloseTo(storeTop, 3);
  });

  it("forces zero on the y scale with an advisory", () => {
    const model = runPipeline(spec(), size);
    expect(model.scales.y.type).toBe("linear");
    // bars anchor at 0; the trained domain reaches 0 then pads 5% below it.
    if (model.scales.y.type !== "band") expect(model.scales.y.domain[0]).toBeLessThanOrEqual(0);
    expect(model.advisories.some((a) => a.code === "zero-forced")).toBe(true);
  });

  it("explicit zero: false suppresses the forcing (bars still contribute their zero baseline)", () => {
    const noZero = gg(salesRows, aes({ x: "city", y: "sales", fill: "kind" }))
      .geomCol({ position: "dodge" })
      .scales({ y: { zero: false, nice: false } })
      .spec();
    const model = runPipeline(noZero, size);
    expect(model.advisories.some((a) => a.code === "zero-forced")).toBe(false);
    // bar geometry itself grows from 0, so the trained domain still reaches it
    // bars anchor at 0; the trained domain reaches 0 then pads 5% below it.
    if (model.scales.y.type !== "band") expect(model.scales.y.domain[0]).toBeLessThanOrEqual(0);

    // zero: true on a plain point layer extends the domain to 0
    const pointZero = runPipeline(
      gg(salesRows, aes({ x: "city", y: "sales" }))
        .geomPoint()
        .scales({ y: { zero: true, nice: false } })
        .spec(),
      size,
    );
    if (pointZero.scales.y.type !== "band")
      expect(pointZero.scales.y.domain[0]).toBeLessThanOrEqual(0);
  });

  it("dodge places side-by-side rects (no vertical stacking)", () => {
    const model = runPipeline(
      gg(salesRows, aes({ x: "city", y: "sales", fill: "kind" }))
        .geomCol({ position: "dodge" })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as RectsBatch;
    // both Berlin rects start at the baseline (bottom edge = ymax pixel of 0)
    const bottom0 = batch.rects[1]! + batch.rects[3]!;
    const bottom4 = batch.rects[5]! + batch.rects[7]!;
    expect(bottom0).toBeCloseTo(bottom4, 3);
    expect(batch.rects[0]!).not.toBeCloseTo(batch.rects[4]!, 1);
  });

  it("fill position rescales each band to proportions (y domain [0,1])", () => {
    const model = runPipeline(
      gg(salesRows, aes({ x: "city", y: "sales", fill: "kind" }))
        .geomCol({ position: "fill" })
        .spec(),
      size,
    );
    // fill positions produce proportions in [0, 1]; 5% display expansion pads both ends.
    if (model.scales.y.type !== "band") expect(model.scales.y.domain).toEqual([-0.05, 1.05]);
  });
});

describe("bar geom (count stat)", () => {
  const rows = [
    { cls: "a", g: "u" },
    { cls: "a", g: "v" },
    { cls: "b", g: "u" },
    { cls: "a", g: "u" },
  ];

  it("counts rows per x; y axis titled count", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "cls" }))
        .geomBar()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.kind).toBe("rects");
    expect(batch.rects.length / 4).toBe(2);
    // "a" has 3 rows, "b" 1: the first rect is 3x the height of the second
    expect(batch.rects[3]!).toBeCloseTo(3 * batch.rects[7]!, 3);
    expect(model.scene.axes.y.title).toBe("count");
  });

  it("stacks counts per fill group and sums weights when mapped", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "cls", fill: "g" }))
        .geomBar()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.rects.length / 4).toBe(3); // (a,u), (a,v), (b,u)
    expect(batch.fills).toHaveLength(3);

    const weighted = runPipeline(
      gg(
        rows.map((r, i) => ({ ...r, w: i + 1 })),
        aes({ x: "cls", weight: "w" }),
      )
        .geomBar()
        .spec(),
      size,
    );
    const wBatch = weighted.scene.batches[0] as RectsBatch;
    // a: 1+2+4 = 7, b: 3 -> heights 7:3
    expect(wBatch.rects[3]! / wBatch.rects[7]!).toBeCloseTo(7 / 3, 3);
  });

  it("rejects a data-mapped y with a structured error", () => {
    const spec: SpecInput = {
      data: { values: rows },
      aes: { x: "cls", y: "g" },
      layers: [{ geom: "bar" }],
    };
    try {
      runPipeline(spec, size);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as PipelineError).code).toBe("computed-y-mapped");
    }
  });
});

describe("area geom", () => {
  const series = [
    { t: 1, v: 3, s: "p" },
    { t: 2, v: 5, s: "p" },
    { t: 3, v: 4, s: "p" },
    { t: 1, v: 1, s: "q" },
    { t: 2, v: 2, s: "q" },
    { t: 3, v: 2, s: "q" },
  ];

  it("emits closed filled polygons, stacked per group", () => {
    const model = runPipeline(
      gg(series, aes({ x: "t", y: "v", fill: "s" }))
        .geomArea()
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as PathsBatch;
    expect(batch.kind).toBe("paths");
    expect(batch.closed).toBe(true);
    expect(batch.fills).toHaveLength(2);
    expect(batch.pathOffsets.length).toBe(3);
    // each polygon has 2n vertices (upper + lower edge)
    expect(batch.pathOffsets[1]! - batch.pathOffsets[0]!).toBe(6);
    // y domain stacks to at least 3+1=4 .. 5+2=7
    if (model.scales.y.type !== "band") {
      expect(model.scales.y.domain[0]).toBeLessThanOrEqual(0); // zero forced (then 5% padding)
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(7);
    }
  });
});

describe("rule geom — two honest forms", () => {
  const rows = [
    { x: 1, y: 10 },
    { x: 5, y: 30 },
  ];

  it("annotation form: fixed intercepts span the panel", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .geomRule({ yintercept: 20, xintercept: [2, 4] })
        .spec(),
      size,
    );
    const batch = model.scene.batches[1] as SegmentsBatch;
    expect(batch.kind).toBe("segments");
    expect(batch.segments.length / 4).toBe(3);
    expect(batch.rowIndex[0]).toBe(0xffffffff); // annotation rows have no source row
  });

  it("annotation intercepts train the scales", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .geomRule({ yintercept: 100 })
        .spec(),
      size,
    );
    if (model.scales.y.type !== "band")
      expect(model.scales.y.domain[1]).toBeGreaterThanOrEqual(100);
  });

  it("data-driven form: one vertical rule per row, color-mappable", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { pos: 2, k: "a" },
            { pos: 4, k: "b" },
          ],
        },
        layers: [{ geom: "rule", aes: { x: { field: "pos" }, color: { field: "k" } } }],
      },
      size,
    );
    const batch = model.scene.batches[0] as SegmentsBatch;
    expect(batch.segments.length / 4).toBe(2);
    expect(batch.strokes).toHaveLength(2);
    expect(batch.strokes![0]).not.toBe(batch.strokes![1]);
  });

  it("mixed forms / missing forms / both axes throw structured errors", () => {
    const expectCode = (spec: SpecInput, code: string) => {
      try {
        runPipeline(spec, size);
        throw new Error("should have thrown");
      } catch (e) {
        expect((e as PipelineError).code).toBe(code);
      }
    };
    const data = { values: rows };
    expectCode(
      { data, layers: [{ geom: "rule", aes: { x: { field: "x" } }, params: { yintercept: 1 } }] },
      "rule-form-ambiguous",
    );
    expectCode({ data, layers: [{ geom: "rule" }] }, "rule-form-missing");
    expectCode(
      { data, layers: [{ geom: "rule", aes: { x: { field: "x" }, y: { field: "y" } } }] },
      "rule-both-axes",
    );
  });
});

describe("text geom", () => {
  const rows = [
    { x: 1, y: 10, name: "alpha" },
    { x: 5, y: 30, name: "beta" },
  ];

  it("emits glyphs with anchor/size/dx/dy params", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y", label: "name" }))
        .geomText({ anchor: "start", size: 14, dx: 4, dy: -2 })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as GlyphsBatch;
    expect(batch.kind).toBe("glyphs");
    expect(batch.texts).toEqual(["alpha", "beta"]);
    expect(batch.anchor).toBe("start");
    expect(batch.size).toBe(14);
  });

  it("requires a label channel", () => {
    try {
      runPipeline(
        gg(rows, aes({ x: "x", y: "y" }))
          .geomText()
          .spec(),
        size,
      );
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as PipelineError).code).toBe("missing-channel");
    }
  });
});

describe("determinism across the new geoms", () => {
  it("byte-identical stacked-bar + legend + rule + text render", () => {
    const spec = gg(salesRows, aes({ x: "city", y: "sales", fill: "kind" }))
      .geomCol()
      .geomRule({ yintercept: 40, aes: { fill: null } })
      .geomText({ aes: { label: "kind", fill: null }, size: 9 })
      .labs({ title: "Sales" })
      .theme("light")
      .spec();
    const a = renderToSVGString(spec, { ...size, editions: EDITION_DEFAULTS });
    const b = renderToSVGString(spec, { ...size, editions: EDITION_DEFAULTS });
    expect(a).toBe(b);
    expect(a).toContain("gg-rects");
    expect(a).toContain("gg-segments");
    expect(a).toContain("gg-glyphs");
    expect(a).toContain("gg-legend");
  });
});

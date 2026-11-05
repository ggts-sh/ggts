/**
 * position: "fill" must publish post-position proportions as candidate y
 * values so scale labels like ".0%" format shares (65%), not raw counts
 * (87300%). Repro: examples/bar/proportions — Naples Soldiers men=873.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { registerAll } from "../src/index.ts";
import { runPipeline } from "../src/pipeline.ts";

registerAll();

const size = { width: 640, height: 400 };

/** Armada Naples subset from examples/bar/proportions/data.ts. */
const naples = [
  { squadron: "Naples", role: "Soldiers", men: 873 },
  { squadron: "Naples", role: "Sailors", men: 468 },
] as const;

describe("position fill — candidate y matches axis space", () => {
  it("publishes proportions (not raw weights) so percent labels format shares", () => {
    const model = runPipeline(
      gg([...naples], aes({ x: "squadron", fill: "role", weight: "men" }))
        .geomBar({ position: "fill" })
        .scales({ y: { labels: ".0%" } })
        .spec(),
      size,
    );

    const candidates = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    ).filter((c) => c !== null);

    expect(candidates.length).toBe(2);

    // Soldiers 873 / (873+468) ≈ 0.650; Sailors ≈ 0.350.
    const byRole = new Map(
      candidates.map((c) => {
        // seriesId follows first-seen fill order: Soldiers=0, Sailors=1.
        return [c.seriesId, c] as const;
      }),
    );
    const soldiers = byRole.get(0)!;
    const sailors = byRole.get(1)!;

    expect(soldiers.yValue).toBeCloseTo(873 / (873 + 468), 8);
    expect(sailors.yValue).toBeCloseTo(468 / (873 + 468), 8);

    // Axis formatter multiplies by 100 — pre-fix this printed "87300%".
    expect(model.axisFormatters.y(soldiers.yValue)).toBe("65%");
    expect(model.axisFormatters.y(sailors.yValue)).toBe("35%");
    expect(model.axisFormatters.y(soldiers.yValue)).not.toContain("873");
  });

  it("publishes the same fill shares for identity-stat cols (source-backed)", () => {
    // geomCol + mapped y keeps stat identity, so construction is source-backed.
    // Inspect y must still be the post-position share, not the source column.
    const model = runPipeline(
      gg(
        naples.map((row) => ({ squadron: row.squadron, role: row.role, men: row.men })),
        aes({ x: "squadron", y: "men", fill: "role" }),
      )
        .geomCol({ position: "fill" })
        .scales({ y: { labels: ".0%" } })
        .spec(),
      size,
    );

    const candidates = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    ).filter((c) => c !== null);

    expect(candidates.length).toBe(2);
    const yValues = candidates.map((c) => c.yValue as number).toSorted((a, b) => a - b);
    expect(yValues[0]).toBeCloseTo(468 / (873 + 468), 8);
    expect(yValues[1]).toBeCloseTo(873 / (873 + 468), 8);
    expect(model.axisFormatters.y(yValues[1])).toBe("65%");
    expect(model.axisFormatters.y(yValues[0])).toBe("35%");
  });

  it("maps compacted fill rects back to the original frame row", () => {
    // First x is outside the trained domain → no rect. Remaining candidates
    // must still read their own post-position shares, not the dropped slot.
    const model = runPipeline(
      gg(
        [
          { squadron: "Ghost", role: "Ghost", men: 1000 },
          { squadron: "Naples", role: "Soldiers", men: 2 },
          { squadron: "Naples", role: "Sailors", men: 8 },
        ],
        aes({ x: "squadron", y: "men", fill: "role" }),
      )
        .geomCol({ position: "fill" })
        .scales({ x: { domain: ["Naples"] } })
        .spec(),
      size,
    );
    const yValues = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    )
      .filter((c) => c !== null)
      .map((c) => c.yValue as number)
      .toSorted((a, b) => a - b);
    expect(yValues).toHaveLength(2);
    expect(yValues[0]).toBeCloseTo(2 / 10, 8);
    expect(yValues[1]).toBeCloseTo(8 / 10, 8);
  });

  it("publishes stack segment heights for identity-stat cols (source-backed)", () => {
    const model = runPipeline(
      gg(
        naples.map((row) => ({ squadron: row.squadron, role: row.role, men: row.men })),
        aes({ x: "squadron", y: "men", fill: "role" }),
      )
        .geomCol({ position: "stack" })
        .spec(),
      size,
    );
    const yValues = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    )
      .filter((c) => c !== null)
      .map((c) => c.yValue as number)
      .toSorted((a, b) => a - b);
    expect(yValues[0]).toBeCloseTo(468, 8);
    expect(yValues[1]).toBeCloseTo(873, 8);
  });

  it("keeps stack candidate y as the segment height (raw contribution)", () => {
    const model = runPipeline(
      gg([...naples], aes({ x: "squadron", fill: "role", weight: "men" }))
        .geomBar({ position: "stack" })
        .spec(),
      size,
    );
    const candidates = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    ).filter((c) => c !== null);
    const yValues = candidates.map((c) => c.yValue as number).toSorted((a, b) => a - b);
    expect(yValues[0]).toBeCloseTo(468, 8);
    expect(yValues[1]).toBeCloseTo(873, 8);
  });

  it("preserves sign for negative stacked contributions", () => {
    const model = runPipeline(
      gg(
        [
          { g: "a", cls: "pos", y: 3 },
          { g: "a", cls: "neg", y: -2 },
        ],
        aes({ x: "g", y: "y", fill: "cls" }),
      )
        .geomCol({ position: "stack" })
        .spec(),
      size,
    );
    const yValues = Array.from({ length: model.candidates.size }, (_, id) =>
      model.candidates.candidate(id),
    )
      .filter((c) => c !== null)
      .map((c) => c.yValue as number)
      .toSorted((a, b) => a - b);
    expect(yValues[0]).toBeCloseTo(-2, 8);
    expect(yValues[1]).toBeCloseTo(3, 8);
  });

  it("does not mutate the shared source y column under identity stack", () => {
    const rows = [
      { g: "a", cls: "x", y: 10 },
      { g: "a", cls: "y", y: 20 },
    ];
    runPipeline(
      gg(rows, aes({ x: "g", y: "y", fill: "cls" }))
        .geomCol({ position: "fill" })
        .spec(),
      size,
    );
    // Source rows must still hold the authored values after fill rewrites
    // frame.yNumeric (no in-place alias mutation of the table cache).
    expect(rows[0]!.y).toBe(10);
    expect(rows[1]!.y).toBe(20);
  });
});

describe("percent labels out-of-range advisory", () => {
  it("fires when labels are percent and the domain is not proportion-scale", () => {
    const model = runPipeline(
      gg(
        [
          { x: "a", y: 40 },
          { x: "b", y: 80 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomCol()
        .scales({ y: { labels: ".0%" } })
        .spec(),
      size,
    );
    expect(model.advisories.some((a) => a.code === "percent-labels-out-of-range")).toBe(true);
  });

  it("also fires for trimmed percent formats (~%) that numberFormatter accepts", () => {
    const model = runPipeline(
      gg(
        [
          { x: "a", y: 40 },
          { x: "b", y: 80 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomCol()
        .scales({ y: { labels: ".1~%" } })
        .spec(),
      size,
    );
    expect(model.advisories.some((a) => a.code === "percent-labels-out-of-range")).toBe(true);
  });

  it("stays quiet for position fill with percent labels (domain ≈ [0,1])", () => {
    const model = runPipeline(
      gg([...naples], aes({ x: "squadron", fill: "role", weight: "men" }))
        .geomBar({ position: "fill" })
        .scales({ y: { labels: ".0%" } })
        .spec(),
      size,
    );
    expect(model.advisories.some((a) => a.code === "percent-labels-out-of-range")).toBe(false);
  });
});

describe("stacked rect candidates after a scale domain drops rows", () => {
  const rows = (categories: number) =>
    Array.from({ length: categories * 3 }, (_, i) => ({
      x: `c${Math.floor(i / 3)}`,
      fill: `f${i % 3}`,
      y: 1 + (i % 7),
    }));
  const inDomain = (categories: number, keep: (index: number) => boolean) =>
    Array.from({ length: categories }, (_, i) => `c${i}`).filter((_, i) => keep(i));
  const readCandidates = (model: ReturnType<typeof runPipeline>) =>
    Array.from({ length: model.candidates.size }, (_, id) => model.candidates.candidate(id)).filter(
      (candidate) => candidate !== null,
    );

  for (const [label, keep] of [
    ["the first categories", (i: number) => i >= 2],
    ["a middle category", (i: number) => i !== 3],
    ["every second category", (i: number) => i % 2 === 1],
  ] as const) {
    it(`keeps each stack segment height when the domain leaves out ${label}`, () => {
      const data = rows(8);
      const domain = inDomain(8, keep);
      const model = runPipeline(
        gg(data, aes({ x: "x", y: "y", fill: "fill" }))
          .geomCol()
          .scaleXDiscrete({ domain })
          .spec(),
        size,
      );
      const candidates = readCandidates(model);
      const kept = data.flatMap((row, index) => (domain.includes(row.x) ? [index] : []));
      expect(candidates.map((candidate) => candidate.rowIndex!).toSorted((p, q) => p - q)).toEqual(
        kept,
      );
      for (const candidate of candidates) {
        expect(candidate.yValue).toBe(data[candidate.rowIndex!]!.y);
      }
    });

    it(`keeps each fill share when the domain leaves out ${label}`, () => {
      const data = rows(8);
      const domain = inDomain(8, keep);
      const model = runPipeline(
        gg(data, aes({ x: "x", y: "y", fill: "fill" }))
          .geomCol({ position: "fill" })
          .scaleXDiscrete({ domain })
          .spec(),
        size,
      );
      const totals = new Map<string, number>();
      for (const row of data) totals.set(row.x, (totals.get(row.x) ?? 0) + row.y);
      const candidates = readCandidates(model);
      expect(candidates.length).toBe(data.filter((row) => domain.includes(row.x)).length);
      for (const candidate of candidates) {
        const row = data[candidate.rowIndex!]!;
        expect(candidate.yValue).toBeCloseTo(row.y / totals.get(row.x)!, 12);
      }
    });
  }
});

describe("candidates after a scale domain drops categories", () => {
  // Counts per category and fill: a 1,2; b 3,4; c 5,6; d 7,8.
  const counts: Record<string, [number, number]> = { a: [1, 2], b: [3, 4], c: [5, 6], d: [7, 8] };
  const rows = Object.entries(counts).flatMap(([x, [p, q]]) => [
    ...Array.from({ length: p }, () => ({ x, f: "p" })),
    ...Array.from({ length: q }, () => ({ x, f: "q" })),
  ]);
  const domain = ["b", "c", "d"];
  const candidatesOf = (model: ReturnType<typeof runPipeline>) =>
    Array.from({ length: model.candidates.size }, (_, id) => model.candidates.candidate(id)).filter(
      (candidate) => candidate !== null,
    );
  const readXY = (spec: Parameters<typeof runPipeline>[0]) =>
    candidatesOf(runPipeline(spec, size)).map((c) => [c.xValue, c.yValue]);

  it("reads the kept frame row for a count bar with stack", () => {
    const spec = gg(rows, aes({ x: "x", fill: "f" }))
      .geomBar()
      .scaleXDiscrete({ domain })
      .spec();
    expect(readXY(spec)).toEqual([
      ["b", 3],
      ["b", 4],
      ["c", 5],
      ["c", 6],
      ["d", 7],
      ["d", 8],
    ]);
  });

  it("reads the kept frame row for a count bar with fill", () => {
    const spec = gg(rows, aes({ x: "x", fill: "f" }))
      .geomBar({ position: "fill" })
      .scaleXDiscrete({ domain })
      .spec();
    const shares = readXY(spec);
    expect(shares.map(([x]) => x)).toEqual(["b", "b", "c", "c", "d", "d"]);
    for (const [i, x] of ["b", "b", "c", "c", "d", "d"].entries()) {
      const [p, q] = counts[x]!;
      expect(shares[i]![1]).toBeCloseTo((i % 2 === 0 ? p : q) / (p + q), 12);
    }
  });

  it("reads the kept frame row for a count bar without fill", () => {
    const spec = gg(rows, aes({ x: "x" }))
      .geomBar()
      .scaleXDiscrete({ domain })
      .spec();
    expect(readXY(spec)).toEqual([
      ["b", 7],
      ["c", 11],
      ["d", 15],
    ]);
  });

  it("reads the kept frame row for a polar count bar", () => {
    const spec = gg(rows, aes({ x: "x" }))
      .geomBar()
      .scaleXDiscrete({ domain })
      .coordPolar()
      .spec();
    expect(readXY(spec)).toEqual([
      ["b", 7],
      ["c", 11],
      ["d", 15],
    ]);
  });

  it("reads the kept frame row for count points", () => {
    const spec = gg(rows, aes({ x: "x", y: "f" }))
      .geomCount()
      .scaleXDiscrete({ domain })
      .spec();
    expect(readXY(spec)).toEqual([
      ["b", "p"],
      ["b", "q"],
      ["c", "p"],
      ["c", "q"],
      ["d", "p"],
      ["d", "q"],
    ]);
  });

  it("reads the kept frame row for boxplot marks", () => {
    // Category x holds values in its own range, so a candidate from the wrong row is out of range.
    const base: Record<string, number> = { a: 0, b: 10, c: 20, d: 30 };
    const data = Object.entries(base).flatMap(([x, lo]) =>
      Array.from({ length: 5 }, (_, i) => ({ x, v: lo + i })),
    );
    const spec = gg(data, aes({ x: "x", y: "v" }))
      .geomBoxplot()
      .scaleXDiscrete({ domain })
      .spec();
    const marks = readXY(spec);
    expect(marks.length).toBeGreaterThan(0);
    for (const [x, y] of marks) {
      expect(domain).toContain(x as string);
      expect(y as number).toBeGreaterThanOrEqual(base[x as string]!);
      expect(y as number).toBeLessThanOrEqual(base[x as string]! + 4);
    }
  });

  it("reads the kept frame row for histogram bars", () => {
    // Bin k (width 10) holds k + 1 values; limits drop bins 0 and 1.
    const data = Array.from({ length: 6 }, (_, k) =>
      Array.from({ length: k + 1 }, (__, i) => ({ v: k * 10 + 1 + i })),
    ).flat();
    const spec = gg(data, aes({ x: "v" }))
      .geomHistogram({ binwidth: 10, boundary: 0 })
      .scaleXContinuous({ limits: [20, 60] })
      .spec();
    expect(candidatesOf(runPipeline(spec, size)).map((c) => c.yValue)).toEqual([3, 4, 5, 6]);
  });
});

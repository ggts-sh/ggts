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

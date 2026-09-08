/**
 * Continuous geom_col bar width uses stats.resolution (unique-first).
 * Locks resolution()===0 → gap=1 fallback for lone/all-equal x.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";

const size = { width: 1000, height: 400 };

function rectWidths(model: ReturnType<typeof runPipeline>): number[] {
  const batch = model.scene.batches.find((b) => b.kind === "rects");
  if (batch === undefined || batch.kind !== "rects") throw new Error("expected rects");
  const widths: number[] = [];
  for (let i = 0; i < batch.rects.length; i += 4) widths.push(batch.rects[i + 2]!);
  return widths;
}

describe("continuous geom_col — resolution-driven bar width", () => {
  it("min positive x-gap scales bar width (multiset cardinality ignored)", () => {
    // Same domain [0,6]; min gaps 2 vs 1 → widths 2×.
    const scales = {
      x: {
        type: "linear" as const,
        domain: [0, 6] as [number, number],
        expand: { mult: 0, add: 0 },
      },
      y: { type: "linear" as const, expand: { mult: 0, add: 0 } },
    };
    // Many duplicates of the same three x values — unique-first still sees gap 2.
    const wideRows = Array.from({ length: 30 }, (_, i) => ({
      x: [0, 2, 6][i % 3]!,
      y: 1,
    }));
    const narrowRows = Array.from({ length: 30 }, (_, i) => ({
      x: [0, 1, 6][i % 3]!,
      y: 1,
    }));
    const wide = runPipeline(
      gg(wideRows, aes({ x: "x", y: "y" }))
        .geomCol({ width: 1 })
        .scales(scales)
        .spec(),
      size,
    );
    const narrow = runPipeline(
      gg(narrowRows, aes({ x: "x", y: "y" }))
        .geomCol({ width: 1 })
        .scales(scales)
        .spec(),
      size,
    );
    const wWide = rectWidths(wide)[0]!;
    const wNarrow = rectWidths(narrow)[0]!;
    expect(wWide / wNarrow).toBeCloseTo(2, 5);
  });

  it("all-equal continuous x uses gap=1 fallback (resolution 0)", () => {
    // Without fallback, widthFrac would be 0 and bars would vanish.
    const model = runPipeline(
      gg(
        [
          { x: 5, y: 1 },
          { x: 5, y: 2 },
          { x: 5, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomCol({ width: 1 })
        .scales({
          x: { type: "linear", expand: { mult: 0, add: 0 } },
          y: { type: "linear", expand: { mult: 0, add: 0 } },
        })
        .spec(),
      size,
    );
    const widths = rectWidths(model);
    expect(widths.length).toBe(3);
    for (const w of widths) expect(w).toBeGreaterThan(0);
  });
});

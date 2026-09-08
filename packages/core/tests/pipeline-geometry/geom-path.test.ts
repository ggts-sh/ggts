/**
 * geom_path connects in data order (no x-sort), unlike geom_line (#788).
 */
import { describe, expect, it } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";

import type { PortableSpec } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.js";

const viewport = { width: 200, height: 200 };

function pathPositions(geom: "line" | "path"): Float32Array {
  // x order is 3, 1, 2 — path should follow that; line should sort to 1,2,3.
  const spec = fromAny({
    data: {
      values: [
        { x: 3, y: 30 },
        { x: 1, y: 10 },
        { x: 2, y: 20 },
      ],
    },
    aes: { x: { field: "x" }, y: { field: "y" } },
    layers: [{ geom }],
  }) as PortableSpec;
  const model = runPipeline(spec, viewport);
  const paths = model.scene.batches.find((b) => b.kind === "paths");
  if (paths?.kind !== "paths") throw new Error("expected paths batch");
  return paths.positions;
}

describe("geom_path vs geom_line order (#788)", () => {
  it("geom_line sorts vertices by x", () => {
    const pos = pathPositions("line");
    // positions are [x0,y0,x1,y1,x2,y2] in viewport space — compare y which
    // maps monotonically with data y (larger data y → smaller SVG y if flipped).
    // Use rowIndex or check x order via domain projection: compare relative x.
    const xs = [pos[0]!, pos[2]!, pos[4]!];
    expect(xs[0]!).toBeLessThan(xs[1]!);
    expect(xs[1]!).toBeLessThan(xs[2]!);
  });

  it("geom_path keeps data row order (not x-sorted)", () => {
    const pos = pathPositions("path");
    const xs = [pos[0]!, pos[2]!, pos[4]!];
    // data order x=3,1,2 → first x is max, then min, then mid
    expect(xs[0]!).toBeGreaterThan(xs[1]!);
    expect(xs[0]!).toBeGreaterThan(xs[2]!);
    expect(xs[1]!).toBeLessThan(xs[2]!);
  });

  it("accepts path in schema validation", async () => {
    const { validate } = await import("@ggts-sh/spec");
    const result = validate({
      data: { values: [{ x: 1, y: 2 }] },
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [{ geom: "path" }],
    });
    expect(result.ok).toBe(true);
  });
});

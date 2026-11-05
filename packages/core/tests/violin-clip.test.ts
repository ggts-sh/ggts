/**
 * A violin with trim: false under a pinned y domain stays inside the panel (#1937).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { registerAll } from "../src/register.ts";

registerAll();

const rows = Array.from({ length: 30 }, (_, i) => ({
  g: "a",
  v: 100 + (i % 10) * 3 + ((i * 7) % 5),
}));

function violin(domain: [number, number], coord?: { type: "transform"; clip: false }) {
  const spec = gg(rows, aes({ x: "g", y: "v" }))
    .geomViolin({ trim: false })
    .scales({ y: { domain } })
    .spec();
  const model = runPipeline(coord ? { ...spec, coord } : spec, { width: 400, height: 400 });
  const batch = model.scene.batches.find((b) => b.kind === "paths");
  if (batch?.kind !== "paths") throw new Error("expected paths");
  const vertices: [number, number][] = [];
  for (let i = 0; i < batch.positions.length; i += 2) {
    vertices.push([batch.positions[i]!, batch.positions[i + 1]!]);
  }
  return { model, batch, vertices };
}

describe("violin with trim: false under a pinned y domain (#1937)", () => {
  // The default 5% expansion puts the panel limits just outside the domain.
  it.each([
    ["the upper limit", [105, 125]],
    ["the lower limit", [100, 120]],
    ["both limits", [108, 112]],
  ] as const)("keeps every vertex inside the panel when the tails cross %s", (_, domain) => {
    const { model, batch, vertices } = violin([domain[0], domain[1]]);
    const height = model.scene.panels[0]!.height;
    expect(vertices.some(([, y]) => y === 0 || y === height)).toBe(true);
    for (const [, y] of vertices) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(height);
    }
    const count = vertices.length;
    expect(batch.rowIndex.length).toBe(count);
    expect(batch.closedFrameRows?.length).toBe(count);
    expect(batch.pathOffsets.at(-1)).toBe(count);
  });

  it("cuts at the crossing, so the outline does not bend", () => {
    const clipped = violin([108, 112]).vertices;
    const full = violin([108, 112], { type: "transform", clip: false }).vertices;
    // Every vertex on a panel edge lies on a segment of the uncut outline.
    const height = 352;
    const edge = clipped.filter(([, y]) => y === 0 || y === height);
    expect(edge.length).toBeGreaterThanOrEqual(4);
    const onOutline = ([x, y]: [number, number]) =>
      full.some(([x0, y0], i) => {
        const [x1, y1] = full[(i + 1) % full.length]!;
        if ((y0 - y) * (y1 - y) > 0 || y0 === y1) return false;
        return Math.abs(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0) - x) < 1e-2;
      });
    for (const v of edge) expect(onOutline(v)).toBe(true);
  });

  it("keeps vertices inside the panel on a flipped coordinate", () => {
    const spec = gg(rows, aes({ x: "g", y: "v" }))
      .geomViolin({ trim: false })
      .scales({ y: { domain: [105, 125] } })
      .coordFlip()
      .spec();
    const model = runPipeline(spec, { width: 400, height: 300 });
    const batch = model.scene.batches.find((b) => b.kind === "paths");
    if (batch?.kind !== "paths") throw new Error("expected paths");
    const { width, height } = model.scene.panels[0]!;
    for (let i = 0; i < batch.positions.length; i += 2) {
      expect(batch.positions[i]!).toBeGreaterThanOrEqual(0);
      expect(batch.positions[i]!).toBeLessThanOrEqual(width);
      expect(batch.positions[i + 1]!).toBeGreaterThanOrEqual(0);
      expect(batch.positions[i + 1]!).toBeLessThanOrEqual(height);
    }
  });

  it("keeps the path as before when the panel does not clip", () => {
    const { model, vertices } = violin([105, 125], { type: "transform", clip: false });
    expect(vertices.some(([, y]) => y > model.scene.panels[0]!.height)).toBe(true);
  });

  it("does not add vertices to a violin that stays inside the panel", () => {
    const { batch } = violin([60, 160]);
    // 512 density rows, two sides each.
    expect(batch.positions.length / 2).toBe(1024);
  });
});

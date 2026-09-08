/**
 * coord_radial pipeline — pie / coxcomb / points.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { sceneToSVGString } from "../src/render-svg-scene.ts";

const size = { width: 400, height: 400 };

describe("coord_radial pipeline", () => {
  it("projects stacked cols with theta=y into filled sector paths (pie)", () => {
    const model = runPipeline(
      gg(
        [
          { pie: "all", cat: "a", n: 1 },
          { pie: "all", cat: "b", n: 2 },
          { pie: "all", cat: "c", n: 3 },
        ],
        aes({ x: "pie", y: "n", fill: "cat" }),
      )
        .geomCol({ width: 1, position: "stack" })
        .coordRadial({ theta: "y", expand: false })
        .spec(),
      size,
    );

    const paths = model.scene.batches.filter((b) => b.kind === "paths");
    const rects = model.scene.batches.filter((b) => b.kind === "rects");
    // Under polar, rects become closed filled paths (sectors).
    expect(rects).toHaveLength(0);
    expect(paths.length).toBeGreaterThan(0);
    const filled = paths.filter(
      (b) => b.kind === "paths" && b.closed === true && b.fills !== undefined,
    );
    expect(filled.length).toBeGreaterThan(0);
    for (const batch of filled) {
      if (batch.kind !== "paths") continue;
      expect(batch.positions.length).toBeGreaterThan(6);
      expect([...batch.positions].every((v) => Number.isFinite(v))).toBe(true);
    }

    // Three stack slices → three subpaths or three batches with fills
    const fillCount = filled.reduce((n, b) => {
      if (b.kind !== "paths") return n;
      return n + (b.fills?.filter((f) => f !== null && f !== undefined).length ?? 0);
    }, 0);
    expect(fillCount).toBeGreaterThanOrEqual(3);

    const svg = sceneToSVGString(model.scene);
    expect(svg).toContain("<path");
  });

  it("projects scatter points into polar panel space", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 0.5, y: 0.5 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .coordRadial({ expand: false })
        .spec(),
      size,
    );
    const batch = model.scene.batches.find((b) => b.kind === "points");
    if (batch?.kind !== "points") throw new Error("expected points");
    // Not all points remain on a cartesian diagonal after polar.
    const xs = [batch.positions[0]!, batch.positions[2]!, batch.positions[4]!];
    const ys = [batch.positions[1]!, batch.positions[3]!, batch.positions[5]!];
    expect(xs.every((v) => Number.isFinite(v))).toBe(true);
    expect(ys.every((v) => Number.isFinite(v))).toBe(true);
    // Origin (0,0) → r=0 → panel center under expand:false full-circle radial.
    const panel = model.scene.panels[0]!;
    const cx = panel.width / 2;
    const cy = panel.height / 2;
    expect(Math.hypot(xs[0]! - cx, ys[0]! - cy)).toBeLessThan(panel.width * 0.12);
    // Outer corner (1,1) is farther from center than the origin.
    expect(Math.hypot(xs[1]! - cx, ys[1]! - cy)).toBeGreaterThan(
      Math.hypot(xs[0]! - cx, ys[0]! - cy),
    );
  });

  it("uses a square data rectangle for full-circle radial coords", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .coordRadial()
        .spec(),
      { width: 640, height: 400 },
    );
    const panel = model.scene.panels[0]!;
    expect(panel.width).toBeCloseTo(panel.height, 0);
  });

  it("keeps pie panels square even when theta/r data spans differ", () => {
    const model = runPipeline(
      gg(
        [
          { pie: "all", cat: "a", n: 1 },
          { pie: "all", cat: "b", n: 99 },
        ],
        aes({ x: "pie", y: "n", fill: "cat" }),
      )
        .geomCol({ width: 1, position: "stack" })
        .coordRadial({ theta: "y", expand: false })
        .spec(),
      { width: 640, height: 400 },
    );
    const panel = model.scene.panels[0]!;
    expect(panel.width).toBeCloseTo(panel.height, 0);
  });

  it("sizes partial-arc panels to the polar bbox aspect (not a forced square)", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .coordRadial({ start: -0.4 * Math.PI, end: 0.4 * Math.PI, expand: false })
        .spec(),
      { width: 640, height: 400 },
    );
    const panel = model.scene.panels[0]!;
    // Upper partial arc is wider than tall (bbox aspect ≠ 1), unlike full-circle pie.
    expect(panel.height / panel.width).not.toBeCloseTo(1, 1);
    expect(panel.height / panel.width).toBeLessThan(1);
  });

  it("honors clip default off for radial and on for polar alias", () => {
    const radial = runPipeline(
      gg([{ x: 1, y: 1 }], aes({ x: "x", y: "y" }))
        .geomPoint()
        .coordRadial()
        .spec(),
      size,
    );
    expect(radial.scene.panels[0]?.clip).toBe(false);

    const polar = runPipeline(
      gg([{ x: 1, y: 1 }], aes({ x: "x", y: "y" }))
        .geomPoint()
        .coordPolar()
        .spec(),
      size,
    );
    expect(polar.scene.panels[0]?.clip).toBe(true);
  });

  it("does not invent cartesian domains from pixel invert under polar", () => {
    const model = runPipeline(
      gg(
        [
          { pie: "all", cat: "a", n: 1 },
          { pie: "all", cat: "b", n: 2 },
        ],
        aes({ x: "pie", y: "n", fill: "cat" }),
      )
        .geomCol({ width: 1, position: "stack" })
        .coordRadial({ theta: "y", expand: false })
        .spec(),
      size,
    );
    const panel = model.viewport.panels[0]!;
    const inverted = panel.invert({
      x0: panel.bounds.x0 + 10,
      y0: panel.bounds.y0 + 10,
      x1: panel.bounds.x1 - 10,
      y1: panel.bounds.y1 - 10,
    });
    // Joint polar refuses cartesian invert rather than lying about domains.
    expect(inverted.x).toBeUndefined();
    expect(inverted.y).toBeUndefined();
  });

  it("aligns expand:false axis ticks with evidence domain (not padded range)", () => {
    // Stacked pie: y evidence is [0, 6]. expand:false remaps geometry and
    // panel domains to that span; cartesian chrome must not still tick the
    // padded trained domain (e.g. [-0.3, 6.3]) with inset endpoint positions.
    // Explicit breaks pin endpoints so the assertion does not depend on the
    // continuous break algorithm choosing 0 and 6.
    const model = runPipeline(
      gg(
        [
          { pie: "all", cat: "a", n: 1 },
          { pie: "all", cat: "b", n: 2 },
          { pie: "all", cat: "c", n: 3 },
        ],
        aes({ x: "pie", y: "n", fill: "cat" }),
      )
        .geomCol({ width: 1, position: "stack" })
        .scales({ y: { breaks: [0, 6] } })
        .coordRadial({ theta: "y", expand: false })
        .spec(),
      size,
    );
    const panel = model.scene.panels[0]!;
    const panelDomainY = model.domains.effective.panels[0]?.y;
    expect(panelDomainY).toEqual([0, 6]);

    const ticksY = panel.axisY ?? [];
    expect(ticksY.length).toBeGreaterThan(0);
    for (const tick of ticksY) {
      if (typeof tick.value !== "number") continue;
      expect(tick.value).toBeGreaterThanOrEqual(0);
      expect(tick.value).toBeLessThanOrEqual(6);
    }

    const lo = ticksY.find((t) => t.value === 0);
    const hi = ticksY.find((t) => t.value === 6);
    expect(lo).toBeDefined();
    expect(hi).toBeDefined();
    // fromEnd y: value 0 → bottom edge, value 6 → top edge under remapped scale.
    expect(lo!.pos).toBeCloseTo(panel.height, 0);
    expect(hi!.pos).toBeCloseTo(0, 0);
  });
});

/**
 * facet wrap — panel grid
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { pointFills } from "../../src/mark-style.ts";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { PointsBatch, RectsBatch } from "../../src/scene.ts";
import { STRIP_BAND } from "../../src/scene.ts";
import { size, wrapRows, wrapSpec } from "./fixtures.ts";

describe("facet wrap — panel grid", () => {
  it("one panel per distinct value, sorted ascending, near-square wrap", () => {
    const model = runPipeline(wrapSpec(), size);
    const panels = model.scene.panels;
    expect(panels).toHaveLength(3);
    expect(panels.map((p) => p.strip)).toEqual(["a", "b", "c"]);
    // 3 panels, default ncol = ceil(sqrt(3)) = 2 -> 2 columns, 2 rows.
    expect(panels[0]!.y).toBe(panels[1]!.y);
    expect(panels[2]!.y).toBeGreaterThan(panels[0]!.y);
    // Row-major placement: panel 0 left of panel 1.
    expect(panels[0]!.x).toBeLessThan(panels[1]!.x);
    // Strips reserve a band above every panel.
    expect(panels[0]!.y).toBeGreaterThanOrEqual(STRIP_BAND);
  });

  it("respects explicit ncol", () => {
    const model = runPipeline(
      gg(wrapRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({ wrap: "g", ncol: 3 })
        .spec(),
      size,
    );
    const panels = model.scene.panels;
    expect(panels).toHaveLength(3);
    expect(new Set(panels.map((p) => p.y)).size).toBe(1); // one row
  });

  it("each panel gets only its own rows (partition BEFORE geometry)", () => {
    const model = runPipeline(wrapSpec(), size);
    const points = model.scene.batches.filter((b): b is PointsBatch => b.kind === "points");
    expect(points).toHaveLength(3); // one batch per panel
    for (const batch of points) expect(batch.rowIndex.length).toBe(2);
    // rowIndex still refers to SOURCE rows: panel "a" (sorted first) owns
    // source rows 2 and 3.
    const panelA = points.find((b) => b.panelIndex === 0)!;
    expect([...panelA.rowIndex].toSorted((a, b) => a - b)).toEqual([2, 3]);
  });

  it("fixed scales: axes only on the grid edges; ticks identical across panels", () => {
    const model = runPipeline(wrapSpec("fixed"), size);
    const panels = model.scene.panels;
    // 2x2 wrap of 3 panels: left column = panels 0 and 2 draw the y axis.
    expect(panels[0]!.axisY).not.toBeNull();
    expect(panels[1]!.axisY).toBeNull();
    expect(panels[2]!.axisY).not.toBeNull();
    // Bottom-most panel of each column draws x: col 0 -> panel 2; col 1 ->
    // panel 1 (last row is partial).
    expect(panels[2]!.axisX).not.toBeNull();
    expect(panels[1]!.axisX).not.toBeNull();
    expect(panels[0]!.axisX).toBeNull();
    // Grid lines exist on EVERY panel and coincide (shared scales).
    expect(panels[1]!.grid.y).toEqual(panels[0]!.grid.y);
  });

  it("free_y: per-panel y domains, per-panel left axes", () => {
    const model = runPipeline(wrapSpec("free_y"), size);
    const panels = model.scene.panels;
    // Every panel draws its own y axis now.
    for (const p of panels) expect(p.axisY).not.toBeNull();
    // Panel "c" (y up to 900) has a different domain than panel "a".
    const domains = model.scales.panels.map((s) => (s.y as { domain: [number, number] }).domain);
    expect(domains[0]![1]).toBeLessThan(100);
    expect(domains[2]![1]).toBeGreaterThanOrEqual(900);
    // x stays shared.
    const xDomains = model.scales.panels.map((s) => (s.x as { domain: [number, number] }).domain);
    expect(xDomains[0]).toEqual(xDomains[2]);
  });

  it("fixed scales train on the union of panel domains", () => {
    const model = runPipeline(wrapSpec("fixed"), size);
    const yDomain = (model.scales.y as { domain: [number, number] }).domain;
    expect(yDomain[1]).toBeGreaterThanOrEqual(900); // panel c's extreme
  });

  it("discrete color assignments are ALWAYS global — one legend, stable colors across panels", () => {
    const model = runPipeline(wrapSpec("free"), size);
    expect(model.scene.legends).toHaveLength(1);
    const points = model.scene.batches.filter((b): b is PointsBatch => b.kind === "points");
    // Row order within each panel is u, v — colors match across panels.
    const colorPairs = points.map((b) => pointFills(b).join("|"));
    expect(new Set(colorPairs).size).toBe(1);
  });

  it("facet grid: rows x cols combinations, combined strip labels, empty combos kept", () => {
    const rows = [
      { x: 1, y: 1, r: "r1", c: "c1" },
      { x: 2, y: 2, r: "r1", c: "c2" },
      { x: 3, y: 3, r: "r2", c: "c1" },
      // r2/c2 never occurs -> empty panel
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({ rows: "r", cols: "c" })
        .spec(),
      size,
    );
    const panels = model.scene.panels;
    expect(panels).toHaveLength(4);
    expect(panels.map((p) => p.strip)).toEqual(["r1 / c1", "r1 / c2", "r2 / c1", "r2 / c2"]);
    const points = model.scene.batches.filter((b): b is PointsBatch => b.kind === "points");
    expect(points.map((b) => b.panelIndex).toSorted((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it("null facet values form their own panel, sorted last", () => {
    const rows = [
      { x: 1, y: 1, g: null },
      { x: 2, y: 2, g: "a" },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .facet({ wrap: "g" })
        .spec(),
      size,
    );
    expect(model.scene.panels.map((p) => p.strip)).toEqual(["a", "(null)"]);
  });

  it("unknown facet field is a structured error with did-you-mean", () => {
    expect(() =>
      runPipeline(
        gg(wrapRows, aes({ x: "x", y: "y" }))
          .geomPoint()
          .facet({ wrap: "gg" })
          .spec(),
        size,
      ),
    ).toThrow(PipelineError);
    try {
      runPipeline(
        gg(wrapRows, aes({ x: "x", y: "y" }))
          .geomPoint()
          .facet({ wrap: "gg" })
          .spec(),
        size,
      );
    } catch (error) {
      const e = error as PipelineError;
      expect(e.code).toBe("unknown-field");
      expect(e.path).toBe("/facet/wrap");
      expect(e.message).toContain('Did you mean "g"?');
    }
  });

  it("per-panel stats: stacked bars stack within their panel only", () => {
    const rows = [
      { cat: "a", kind: "u", g: "p1" },
      { cat: "a", kind: "v", g: "p1" },
      { cat: "a", kind: "u", g: "p2" },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "cat", fill: "kind" }))
        .geomBar()
        .facet({ wrap: "g" })
        .spec(),
      size,
    );
    const rects = model.scene.batches.filter((b): b is RectsBatch => b.kind === "rects");
    const p1 = rects.find((b) => b.panelIndex === 0)!;
    const p2 = rects.find((b) => b.panelIndex === 1)!;
    expect(p1.rects.length / 4).toBe(2); // two stacked segments
    expect(p2.rects.length / 4).toBe(1); // one segment: only u present
  });
});

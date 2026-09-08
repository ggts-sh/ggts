/**
 * Characterization tests for the finalize phase (layout → geometry → scene →
 * contracts → domains → candidates → RenderModel) via runPipeline. Observable
 * contracts only. Direct finalize(PipelineRunState) coverage lives in
 * pipeline-finalize.test.ts (#1075).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";

const size = { width: 640, height: 400 };

describe("finalize via runPipeline", () => {
  it("emits layer-major batch order for multi-layer paint", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 4 },
          { x: 3, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .geomLine()
        .spec(),
      size,
    );
    expect(model.scene.batches.length).toBeGreaterThanOrEqual(2);
    // layerIndex is paint order: point layer (0) before line layer (1)
    const layerOrder = model.scene.batches.map((b) => b.layerIndex);
    expect(layerOrder[0]).toBe(0);
    expect(layerOrder.every((li, i) => i === 0 || li >= layerOrder[i - 1]!)).toBe(true);
    expect(model.layerBackends).toHaveLength(2);
    expect(model.layerFields).toHaveLength(2);
  });

  it("builds candidates and domain snapshots after geometry", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 10 },
          { x: 2, y: 20 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      size,
    );
    expect(model.scene.panels.length).toBe(1);
    expect(model.domains.effective.x.length).toBe(2);
    expect(model.domains.baseline.x.length).toBe(2);
    expect(model.candidates.size).toBeGreaterThan(0);
    expect(model.runId).toBeGreaterThan(0);
    expect(model.row(0)).not.toBeNull();
  });

  it("rule and text layers produce segments and glyphs batches", () => {
    const rule = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomRule({ yintercept: 2.5 })
        .spec(),
      size,
    );
    expect(rule.scene.batches.some((b) => b.kind === "segments")).toBe(true);

    const text = runPipeline(
      gg(
        [
          { x: 1, y: 2, label: "a" },
          { x: 2, y: 3, label: "b" },
        ],
        aes({ x: "x", y: "y", label: "label" }),
      )
        .geomText()
        .spec(),
      size,
    );
    expect(text.scene.batches.some((b) => b.kind === "glyphs")).toBe(true);
  });

  it("area layer produces a paths batch", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 4 },
          { x: 3, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomArea()
        .spec(),
      size,
    );
    expect(model.scene.batches.some((b) => b.kind === "paths")).toBe(true);
  });
});

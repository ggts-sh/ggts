import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";

describe("RenderModel semantic viewport", () => {
  it("inverts a plot-pixel rectangle through the panel's semantic axes", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales({
          x: { domain: [0, 10], nice: false, expand: { mult: 0, add: 0 } },
          y: { domain: [0, 10], nice: false, expand: { mult: 0, add: 0 } },
        })
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;
    const domains = panel.invert({
      x0: scenePanel.x + scenePanel.width * 0.25,
      y0: scenePanel.y + scenePanel.height * 0.25,
      x1: scenePanel.x + scenePanel.width * 0.75,
      y1: scenePanel.y + scenePanel.height * 0.75,
    });

    expect(domains.x?.[0]).toBeCloseTo(2.5, 10);
    expect(domains.x?.[1]).toBeCloseTo(7.5, 10);
    expect(domains.y?.[0]).toBeCloseTo(2.5, 10);
    expect(domains.y?.[1]).toBeCloseTo(7.5, 10);
  });

  it("inverts the panel coordinate projector before the trained scale", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 0 },
          { x: 100, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales({
          x: { domain: [1, 100], nice: false, expand: { mult: 0, add: 0 } },
          y: { domain: [0, 10], nice: false, expand: { mult: 0, add: 0 } },
        })
        .coordTransform({ x: { transform: "log10", expand: false } })
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;
    const domains = panel.invert({
      x0: scenePanel.x + scenePanel.width * 0.5,
      y0: scenePanel.y,
      x1: scenePanel.x + scenePanel.width,
      y1: scenePanel.y + scenePanel.height,
    });

    expect(domains.x?.[0]).toBeCloseTo(10, 10);
    expect(domains.x?.[1]).toBeCloseTo(100, 10);
  });

  it("keeps semantic x and y ownership under coordinate flip", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 100 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales({
          x: { domain: [0, 10], nice: false, expand: { mult: 0, add: 0 } },
          y: { domain: [0, 100], nice: false, expand: { mult: 0, add: 0 } },
        })
        .coordFlip()
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;
    const domains = panel.invert({
      x0: scenePanel.x + scenePanel.width * 0.5,
      y0: scenePanel.y,
      x1: scenePanel.x + scenePanel.width,
      y1: scenePanel.y + scenePanel.height,
    });

    expect(domains.x?.[0]).toBeCloseTo(0, 10);
    expect(domains.x?.[1]).toBeCloseTo(10, 10);
    expect(domains.y?.[0]).toBeCloseTo(50, 10);
    expect(domains.y?.[1]).toBeCloseTo(100, 10);
  });

  it("returns inclusive semantic endpoints for a categorical axis", () => {
    const model = runPipeline(
      gg(
        [
          { category: "a", y: 1 },
          { category: "b", y: 2 },
          { category: "c", y: 3 },
          { category: "d", y: 4 },
        ],
        aes({ x: "category", y: "y" }),
      )
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;
    const domains = panel.invert({
      x0: scenePanel.x + scenePanel.width * 0.2,
      y0: scenePanel.y,
      x1: scenePanel.x + scenePanel.width * 0.7,
      y1: scenePanel.y + scenePanel.height,
    });

    expect(domains.x).toEqual(["a", "c"]);
  });

  it("projects semantic domains through the coordinate projector into panel pixels", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 0 },
          { x: 100, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales({
          x: { domain: [1, 100], nice: false, expand: { mult: 0, add: 0 } },
          y: { domain: [0, 10], nice: false, expand: { mult: 0, add: 0 } },
        })
        .coordTransform({ x: { transform: "log10", expand: false } })
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;
    const pixels = panel.project({ x: { kind: "continuous", domain: [10, 100] } });

    expect(pixels.x0).toBeCloseTo(scenePanel.x + scenePanel.width * 0.5, 10);
    expect(pixels.x1).toBeCloseTo(scenePanel.x + scenePanel.width, 10);
    expect(pixels.y0).toBeCloseTo(scenePanel.y, 10);
    expect(pixels.y1).toBeCloseTo(scenePanel.y + scenePanel.height, 10);
  });

  it("reports raw screen-normalized spans for a plot-pixel rect", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales({
          x: { domain: [0, 10], nice: false, expand: { mult: 0, add: 0 } },
          y: { domain: [0, 10], nice: false, expand: { mult: 0, add: 0 } },
        })
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;
    const span = panel.normalizedSpan({
      x0: scenePanel.x + scenePanel.width * 0.25,
      y0: scenePanel.y + scenePanel.height * 0.25,
      x1: scenePanel.x + scenePanel.width * 0.75,
      y1: scenePanel.y + scenePanel.height * 0.75,
    });

    expect(span.x).toBeCloseTo(0.5, 10);
    expect(span.y).toBeCloseTo(0.5, 10);
  });
});

import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";

describe("RenderModel semantic viewport", () => {
  it("resolves a facet by pixel position and uses its panel-local scale", () => {
    const model = runPipeline(
      gg(
        [
          { panel: "west", x: 0, y: 0 },
          { panel: "west", x: 10, y: 1 },
          { panel: "east", x: 100, y: 0 },
          { panel: "east", x: 200, y: 1 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .facet({ wrap: "panel", scales: "free_x" })
        .scales({ x: { nice: false, expand: { mult: 0, add: 0 } } })
        .spec(),
      { width: 600, height: 300 },
    );
    const scenePanel = model.scene.panels.find((panel) => panel.strip === "east")!;
    const panel = model.viewport.panelAt({
      x: scenePanel.x + scenePanel.width / 2,
      y: scenePanel.y + scenePanel.height / 2,
    })!;
    const domains = panel.invert(panel.bounds);

    expect(panel.id).toBe(scenePanel.id);
    expect(model.viewport.panels.map((candidate) => candidate.id)).toEqual(
      model.scene.panels.map((candidate) => candidate.id),
    );
    expect(domains.x?.[0]).toBeCloseTo(100, 10);
    expect(domains.x?.[1]).toBeCloseTo(200, 10);
  });

  it("queries panel candidates in semantic-axis mode", () => {
    const model = runPipeline(
      gg(
        [
          { x: 2, y: 1 },
          { x: 8, y: 9 },
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
    const first = model.candidates.candidate(0)!;
    const matches = panel.query(
      {
        x0: first.x - 1,
        y0: scenePanel.y + scenePanel.height - 1,
        x1: first.x + 1,
        y1: scenePanel.y + scenePanel.height,
      },
      "x",
    );

    expect(matches.map((candidate) => candidate.rowIndex)).toEqual([0]);
  });

  it("panel.nearest never surfaces a candidate from another facet (#787)", () => {
    // Stacked facets + mode "x": unscoped nearest uses a full-height strip and
    // |Δx| distance, so a hover in A at B's screen-x seeds B. Panel-scoped
    // nearest must refuse that leak.
    const model = runPipeline(
      gg(
        [
          { g: "A", x: 1, y: 5 },
          { g: "B", x: 5, y: 5 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .facet({ wrap: "g", ncol: 1 })
        .scales({
          x: { domain: [0, 10], nice: false, expand: { mult: 0, add: 0 } },
          y: { domain: [0, 10], nice: false, expand: { mult: 0, add: 0 } },
        })
        .spec(),
      { width: 200, height: 400 },
    );
    const panelA = model.scene.panels[0]!;
    const candB = model.candidates.candidate(1)!;
    expect(candB.panelId).toBe(model.scene.panels[1]!.id);

    const probe = { x: candB.x, y: panelA.y + panelA.height / 2 };
    // Documents the leak the viewport API closes.
    expect(
      model.candidates.nearest(probe.x, probe.y, { mode: "x", maxDistance: 24 })?.panelId,
    ).toBe(candB.panelId);

    const viewportPanel = model.viewport.panelAt(probe)!;
    expect(viewportPanel.id).toBe(panelA.id);
    expect(viewportPanel.nearest(probe, { mode: "x", maxDistance: 24 })).toBeNull();
  });

  it("panelAtOrOnly falls back only when the plot has a single panel", () => {
    const single = runPipeline(
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
    const only = single.viewport.panels[0]!;
    const outside = { x: only.bounds.x0 - 10, y: only.bounds.y0 - 10 };
    expect(single.viewport.panelAt(outside)).toBeNull();
    expect(single.viewport.panelAtOrOnly(outside)?.id).toBe(only.id);
    expect(
      single.viewport.panelAtOrOnly({ x: only.bounds.x0 + 1, y: only.bounds.y0 + 1 })?.id,
    ).toBe(only.id);

    const multi = runPipeline(
      gg(
        [
          { g: "A", x: 1, y: 1 },
          { g: "B", x: 2, y: 2 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .facet({ wrap: "g" })
        .spec(),
      { width: 400, height: 200 },
    );
    expect(multi.viewport.panels.length).toBe(2);
    expect(multi.viewport.panelAtOrOnly({ x: -50, y: -50 })).toBeNull();
    const first = multi.viewport.panels[0]!;
    expect(
      multi.viewport.panelAtOrOnly({
        x: (first.bounds.x0 + first.bounds.x1) / 2,
        y: (first.bounds.y0 + first.bounds.y1) / 2,
      })?.id,
    ).toBe(first.id);
  });

  it("locate maps client coordinates into scene space under CSS scale", () => {
    // Scene 400×200; CSS-scaled capture rect 200×100 at (100,100) → 2× scale on both axes.
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
      { width: 400, height: 200 },
    );
    expect(model.scene.width).toBe(400);
    expect(model.scene.height).toBe(200);
    expect(
      model.viewport.locate(150, 120, { left: 100, top: 100, width: 200, height: 100 }),
    ).toEqual({ x: 100, y: 40 });
  });

  it("locate accounts for non-zero rect offset and non-square CSS scale", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      { width: 300, height: 150 },
    );
    // rect 100×50 → scale 3× on x, 3× on y; client at rect origin → plot origin.
    expect(model.viewport.locate(40, 60, { left: 40, top: 60, width: 100, height: 50 })).toEqual({
      x: 0,
      y: 0,
    });
    // Mid-rect client: ((90-40)/100)*300 = 150, ((85-60)/50)*150 = 75.
    expect(model.viewport.locate(90, 85, { left: 40, top: 60, width: 100, height: 50 })).toEqual({
      x: 150,
      y: 75,
    });
  });

  it("locate returns origin when the capture element has zero size", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      { width: 400, height: 200 },
    );
    expect(model.viewport.locate(10, 10, { left: 0, top: 0, width: 0, height: 50 })).toEqual({
      x: 0,
      y: 0,
    });
    expect(model.viewport.locate(10, 10, { left: 0, top: 0, width: 50, height: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("locate does not clamp out-of-bounds client coordinates", () => {
    // Drag past the capture edge must keep negative / past-edge plot coords.
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      { width: 100, height: 100 },
    );
    expect(model.viewport.locate(50, 50, { left: 100, top: 100, width: 100, height: 100 })).toEqual(
      {
        x: -50,
        y: -50,
      },
    );
    expect(
      model.viewport.locate(250, 250, { left: 100, top: 100, width: 100, height: 100 }),
    ).toEqual({ x: 150, y: 150 });
  });
});

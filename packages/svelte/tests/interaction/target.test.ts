import "../setup-register-all.js";
/**
 * Resolved-target ownership (#1080): one nearest path, one distance policy,
 * panel-scoped so faceted probes cannot seed a neighbouring facet (#787).
 */
import { describe, expect, it } from "vitest";
import { runPipeline, type RenderModel } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

import {
  POINT_SELECT_NEAREST_MAX_DISTANCE_PX,
  resolveTarget,
  targetSearch,
  type TargetIntent,
} from "../../src/lib/interaction/target.js";

/** Stacked two-facet plot with one mark per facet — same geometry as core #787. */
function facetedStackedModel(): RenderModel {
  return runPipeline(
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
}

/** Single-panel points at known screen positions for distance-policy checks. */
function singlePanelDistanceModel(): RenderModel {
  return runPipeline(
    gg(
      [
        { id: "near", x: 5, y: 5 },
        { id: "far", x: 9, y: 5 },
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
}

describe("targetSearch distance policy table", () => {
  it("maps point-select to xy + the documented 24px radius", () => {
    expect(targetSearch("point-select", null)).toEqual({
      mode: "xy",
      maxDistance: POINT_SELECT_NEAREST_MAX_DISTANCE_PX,
    });
    expect(POINT_SELECT_NEAREST_MAX_DISTANCE_PX).toBe(24);
  });

  it("maps hover and tap to the inspect snapshot mode and maxDistance", () => {
    const inspect = { mode: "x" as const, maxDistance: 16 };
    expect(targetSearch("hover", inspect)).toEqual({ mode: "x", maxDistance: 16 });
    expect(targetSearch("tap", inspect)).toEqual({ mode: "x", maxDistance: 16 });
  });

  it("returns null for hover/tap when inspect is absent", () => {
    expect(targetSearch("hover", null)).toBeNull();
    expect(targetSearch("tap", null)).toBeNull();
  });
});

describe("resolveTarget panel scoping (#787)", () => {
  const intents: TargetIntent[] = ["hover", "tap", "point-select"];

  for (const intent of intents) {
    it(`${intent}: never resolves a mark from a neighbouring facet`, () => {
      const model = facetedStackedModel();
      const panelA = model.scene.panels[0];
      const panelB = model.scene.panels[1];
      const candB = model.candidates.candidate(1);
      if (panelA === undefined || panelB === undefined || candB === null) {
        throw new Error("expected two faceted panels and candidate B");
      }
      expect(candB.panelId).toBe(panelB.id);

      // Probe at panel A's mid-y and candidate B's screen-x — unscoped
      // mode "x" nearest would leak B; panel-scoped must refuse.
      const point = { x: candB.x, y: panelA.y + panelA.height / 2 };
      const inspect = { mode: "x" as const, maxDistance: 24 };
      const target = resolveTarget({ model, point, intent, inspect });
      expect(target).toBeNull();
    });
  }

  it("resolves the in-panel mark when the probe is inside its panel", () => {
    const model = facetedStackedModel();
    const candA = model.candidates.candidate(0)!;
    const target = resolveTarget({
      model,
      point: { x: candA.x, y: candA.y },
      intent: "hover",
      inspect: { mode: "xy", maxDistance: 24 },
    });
    expect(target).not.toBeNull();
    expect(target!.candidateId).toBe(candA.id);
    expect(target!.panelId).toBe(candA.panelId);
    expect(target!.panel.id).toBe(candA.panelId);
  });
});

describe("resolveTarget distance policy outcomes", () => {
  it("at the same pointer, hover@16px and point-select@24px differ when a mark sits at ~20px", () => {
    const model = singlePanelDistanceModel();
    const near = model.candidates.candidate(0)!;
    // Place the probe left of "near" so distance is ~20 plot px.
    const distancePx = 20;
    const point = { x: near.x - distancePx, y: near.y };
    // Sanity: nearest with 24 hits, with 16 does not (via store, unscoped ok here).
    expect(model.candidates.nearest(point.x, point.y, { mode: "xy", maxDistance: 24 })?.id).toBe(
      near.id,
    );
    expect(model.candidates.nearest(point.x, point.y, { mode: "xy", maxDistance: 16 })).toBeNull();
    // Document that 20 plot px is within 24 and outside 16.
    expect(distancePx).toBeLessThan(POINT_SELECT_NEAREST_MAX_DISTANCE_PX);
    expect(distancePx).toBeGreaterThan(16);

    expect(
      resolveTarget({
        model,
        point,
        intent: "point-select",
        inspect: null,
      })?.candidateId,
    ).toBe(near.id);

    expect(
      resolveTarget({
        model,
        point,
        intent: "hover",
        inspect: { mode: "xy", maxDistance: 16 },
      }),
    ).toBeNull();

    expect(
      resolveTarget({
        model,
        point,
        intent: "tap",
        inspect: { mode: "xy", maxDistance: 16 },
      }),
    ).toBeNull();

    expect(
      resolveTarget({
        model,
        point,
        intent: "hover",
        inspect: { mode: "xy", maxDistance: 24 },
      })?.candidateId,
    ).toBe(near.id);
  });
});

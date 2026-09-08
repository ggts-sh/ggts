/**
 * Characterization tests for domain snapshots and RenderModel assembly.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { computeEffectiveDomains } from "../src/pipeline/compute-domains.ts";
import type { RenderModel } from "../src/pipeline/types.ts";
import { trainContinuous } from "../src/scales/train.ts";

const size = { width: 640, height: 400 };

/** Plan-list order of ids for an aesthetic — the #1310 assignment contract. */
function expectedGuidePlanIds(model: RenderModel, aesthetic: "x" | "y"): string[] {
  return model.guidePlans.filter((plan) => plan.aesthetic === aesthetic).map((plan) => plan.id);
}

const temporalFacetRows = [
  { year: "1835", value: 1, r: "a", c: "1" },
  { year: "1900", value: 2, r: "a", c: "1" },
  { year: "2026", value: 3, r: "a", c: "1" },
  { year: "1835", value: 4, r: "b", c: "1" },
  { year: "1900", value: 5, r: "b", c: "1" },
  { year: "2026", value: 6, r: "b", c: "1" },
  { year: "1835", value: 7, r: "a", c: "2" },
  { year: "1900", value: 8, r: "a", c: "2" },
  { year: "2026", value: 9, r: "a", c: "2" },
  { year: "1835", value: 10, r: "b", c: "2" },
  { year: "1900", value: 11, r: "b", c: "2" },
  { year: "2026", value: 12, r: "b", c: "2" },
];

describe("computeEffectiveDomains", () => {
  it("freezes x/y and per-panel domain snapshots", () => {
    const x = trainContinuous([Float64Array.of(1, 2, 3)], { type: "linear" }).scale;
    const y = trainContinuous([Float64Array.of(10, 20)], { type: "linear" }).scale;
    const snap = computeEffectiveDomains(x, y, [{ x, y }]);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.panels)).toBe(true);
    expect(snap.x.length).toBe(2);
    expect(typeof snap.x[0]).toBe("number");
    expect(snap.panels).toHaveLength(1);
  });
});

describe("assembleRenderModel via runPipeline", () => {
  it("exposes dispose that clears batches and nulls row lookup", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      size,
    );
    expect(model.scene.batches.length).toBeGreaterThan(0);
    expect(model.row(0)).not.toBeNull();
    model.dispose();
    expect(model.scene.batches).toHaveLength(0);
    expect(model.row(0)).toBeNull();
    // dispose is idempotent
    model.dispose();
    expect(model.scene.batches).toHaveLength(0);
  });

  it("keeps baseline and effective domain snapshots on the model", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 4 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      size,
    );
    expect(model.domains.effective.x.length).toBeGreaterThan(0);
    expect(model.domains.baseline.x.length).toBeGreaterThan(0);
  });

  // #1310: scale decisions index guide plans by aesthetic without a D×P rescan.
  // Contract: each decision's guidePlanIds is the plan-list-order ids for that aesthetic.
  describe("scaleDecision.guidePlanIds (#1310)", () => {
    it("assigns single-panel plan ids in guidePlans order", () => {
      const model = runPipeline(
        gg(temporalFacetRows, aes({ x: "year", y: "value" }))
          .geomLine()
          .spec(),
        size,
      );
      expect(model.scaleDecisions.length).toBeGreaterThan(0);
      for (const decision of model.scaleDecisions) {
        expect(decision.guidePlanIds).toEqual(expectedGuidePlanIds(model, decision.aesthetic));
      }
      expect(model.scaleDecisions[0]?.guidePlanIds).toEqual(["axis:x:panel:0"]);
    });

    it("assigns wrap-facet plan ids in guidePlans order", () => {
      const model = runPipeline(
        gg(temporalFacetRows, aes({ x: "year", y: "value" }))
          .geomLine()
          .facet({ wrap: "r" })
          .spec(),
        size,
      );
      expect(model.scene.panels.length).toBe(2);
      expect(model.scaleDecisions.length).toBeGreaterThan(0);
      for (const decision of model.scaleDecisions) {
        expect(decision.guidePlanIds).toEqual(expectedGuidePlanIds(model, decision.aesthetic));
      }
      // Shared y on panel 0 only; x on both panels (plan-list order).
      expect(model.scaleDecisions[0]?.guidePlanIds).toEqual(["axis:x:panel:0", "axis:x:panel:1"]);
    });

    it("assigns grid-facet plan ids in guidePlans order", () => {
      const model = runPipeline(
        gg(temporalFacetRows, aes({ x: "year", y: "value" }))
          .geomLine()
          .facet({ rows: "r", cols: "c" })
          .spec(),
        size,
      );
      expect(model.scene.panels.length).toBe(4);
      expect(model.scaleDecisions.length).toBeGreaterThan(0);
      for (const decision of model.scaleDecisions) {
        expect(decision.guidePlanIds).toEqual(expectedGuidePlanIds(model, decision.aesthetic));
      }
      // Outer-axis sharing: only bottom-row panels carry an x guide.
      expect(model.scaleDecisions[0]?.guidePlanIds).toEqual(["axis:x:panel:2", "axis:x:panel:3"]);
    });
  });
});

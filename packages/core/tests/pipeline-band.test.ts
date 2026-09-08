import { describe, expect, it } from "bun:test";

import { runPipeline } from "../src/pipeline.ts";
import type { SpecInput } from "@ggts-sh/spec";

const rows = [
  { category: "Resolución", count: 9000 },
  { category: "Corrección (errores o erratas)", count: 3200 },
  { category: "Sentencia", count: 2800 },
  { category: "Orden", count: 2500 },
  { category: "Otro", count: 900 },
];
const spec: SpecInput = {
  data: { values: rows },
  layers: [{ geom: "col", aes: { x: { field: "category" }, y: { field: "count" } } }],
};

describe("band axis diagnostics (#387)", () => {
  it("emits a rotated advisory that surfaces guide pin + coord_flip, at a narrow width", () => {
    const model = runPipeline(spec, { width: 240, height: 300 });
    const advisory = model.advisories.find((a) => a.code === "band-labels-rotated");
    expect(advisory).toBeDefined();
    expect(advisory?.path).toBe("/scales/x");
    expect(advisory?.howToOverride).toContain("coordFlip");
    expect(advisory?.howToOverride).toContain("guide");
    expect(advisory?.howToOverride).toContain("scales.x.guide");
  });

  it("emits a band-label-margin-overflow diagnostic with a coord_flip fix", () => {
    // Unbreakable single-token labels: wrap and wrap-then−45° cannot help, so
    // full-string −45° truncates and surfaces margin-overflow + coord_flip.
    // (Multi-word Spanish rows at 240px now clear via hybrid #637 without this diag.)
    const unbreakable: SpecInput = {
      data: {
        values: [
          { category: "Anlageverwaltungsgesellschaftsvertrag", count: 9 },
          { category: "Rechtsschutzversicherungsgesellschaften", count: 3 },
          { category: "Donaudampfschiffahrtsgesellschaftskapitän", count: 2 },
        ],
      },
      layers: [{ geom: "col", aes: { x: { field: "category" }, y: { field: "count" } } }],
    };
    const model = runPipeline(unbreakable, { width: 240, height: 300 });
    const diag = model.scaleDiagnostics.find((d) => d.code === "band-label-margin-overflow");
    expect(diag).toBeDefined();
    expect(diag?.path).toBe("/scales/x");
    // The band diagnostic (not temporal text) with a coord_flip fix.
    expect(diag?.problem).toMatch(/categorical/i);
    expect(diag?.fixes.some((f) => f.typescript === ".coordFlip()")).toBe(true);
  });

  it("emits a wrapped advisory (not rotated) at a readable width", () => {
    const model = runPipeline(spec, { width: 560, height: 300 });
    expect(model.advisories.some((a) => a.code === "band-labels-wrapped")).toBe(true);
    expect(model.advisories.some((a) => a.code === "band-labels-rotated")).toBe(false);
  });

  it("plans band labels in faceted charts too (Codex P2)", () => {
    const facetSpec: SpecInput = {
      data: {
        values: rows.flatMap((r) => [
          { ...r, panel: "A" },
          { ...r, panel: "B" },
        ]),
      },
      layers: [{ geom: "col", aes: { x: { field: "category" }, y: { field: "count" } } }],
      facet: { cols: "panel" },
    };
    // Two side-by-side panels at 700px → each panel band is narrow → wrap/rotate.
    const model = runPipeline(facetSpec, { width: 700, height: 300 });
    expect(model.advisories.some((a) => a.code.startsWith("band-labels-"))).toBe(true);
  });

  it("describes a single-line end-cap overflow in terms of width, not rotation (Codex P3)", () => {
    // One category with a very long label at a narrow width stays single-line
    // (no neighbour to collide with) but overflows the end cap. The diagnostic
    // must steer users to width, and must NOT claim the label was rotated.
    const loneSpec: SpecInput = {
      data: {
        values: [{ c: "Una sola categoría con una etiqueta larguísima que se desborda", n: 5 }],
      },
      layers: [{ geom: "col", aes: { x: { field: "c" }, y: { field: "n" } } }],
    };
    const model = runPipeline(loneSpec, { width: 220, height: 300 });
    const diag = model.scaleDiagnostics.find((d) => d.code === "band-label-margin-overflow");
    expect(diag).toBeDefined();
    expect(diag?.problem).not.toMatch(/rotat/i);
    expect(`${diag?.cause} ${diag?.fixes.map((f) => f.description).join(" ")}`).toMatch(/width/i);
    // No band-labels-rotated advisory either, since the axis is still single-line.
    expect(model.advisories.some((a) => a.code === "band-labels-rotated")).toBe(false);
  });

  it("describes forced-wrap margin overflow without claiming rotation (Codex #527)", () => {
    const wrapSpec: SpecInput = {
      data: { values: rows },
      layers: [{ geom: "col", aes: { x: { field: "category" }, y: { field: "count" } } }],
      scales: { x: { guide: { mode: "wrap", wrap: 8 } } },
    };
    // Short height forces wrap block past the orthogonal margin cap.
    const model = runPipeline(wrapSpec, { width: 560, height: 80 });
    const diag = model.scaleDiagnostics.find((d) => d.code === "band-label-margin-overflow");
    expect(diag).toBeDefined();
    expect(diag?.problem).toMatch(/wrap/i);
    expect(diag?.problem).not.toMatch(/rotat/i);
    expect(diag?.cause).not.toMatch(/rotat/i);
  });

  it("re-plans the narrower final facet panel so the band margin is reserved (Codex P2)", () => {
    // Two columns force each panel far narrower than the whole width. The band is
    // re-measured at the final panel size (not the optimistic approx), so the
    // faceted chart still escalates to rotation — proving the second shared pass.
    const facetSpec: SpecInput = {
      data: {
        values: rows.flatMap((r) => [
          { ...r, panel: "A" },
          { ...r, panel: "B" },
        ]),
      },
      layers: [{ geom: "col", aes: { x: { field: "category" }, y: { field: "count" } } }],
      facet: { cols: "panel" },
    };
    const model = runPipeline(facetSpec, { width: 420, height: 300 });
    expect(model.advisories.some((a) => a.code === "band-labels-rotated")).toBe(true);
  });

  it("keeps every planned band label under an active x coord projection (Codex P2)", () => {
    // A reversed x coord projector activates suppressProjectedLabelOverlap, which
    // measures labels as centered single-line. It must NOT blank the labels the
    // planner already rotated/wrapped to fit — every bar keeps its name.
    const revSpec: SpecInput = {
      ...spec,
      coord: { type: "transform", x: { transform: "identity", reverse: true } },
    };
    const model = runPipeline(revSpec, { width: 240, height: 300 });
    const panel = model.scene.panels[0];
    expect(panel).toBeDefined();
    const xTicks = panel?.axisX ?? [];
    const planned = xTicks.filter((t) => t.angle !== undefined || (t.lines?.length ?? 0) > 1);
    expect(planned.length).toBeGreaterThan(0); // the axis really is rotated/wrapped
    // None of the planned band labels were blanked by projection suppression.
    expect(planned.every((t) => t.label !== "")).toBe(true);
  });

  it("does not over-escalate a faceted panel that has room to wrap (Codex P2)", () => {
    // The facet re-plan must pass the TOTAL cell box, not the inner panel width;
    // otherwise layout() subtracts margins twice and rotates a panel that fits
    // when wrapped. At a width where each panel comfortably wraps, expect wrapped
    // (or single-line), never rotated.
    const facetSpec: SpecInput = {
      data: {
        values: rows.flatMap((r) => [
          { ...r, panel: "A" },
          { ...r, panel: "B" },
        ]),
      },
      layers: [{ geom: "col", aes: { x: { field: "category" }, y: { field: "count" } } }],
      facet: { cols: "panel" },
    };
    const model = runPipeline(facetSpec, { width: 1120, height: 320 });
    expect(model.advisories.some((a) => a.code === "band-labels-rotated")).toBe(false);
  });

  it("does not degrade a short-label bar chart", () => {
    const shortSpec: SpecInput = {
      data: {
        values: [
          { c: "IT", n: 1 },
          { c: "HR", n: 2 },
          { c: "Ops", n: 3 },
        ],
      },
      layers: [{ geom: "col", aes: { x: { field: "c" }, y: { field: "n" } } }],
    };
    const model = runPipeline(shortSpec, { width: 480, height: 300 });
    expect(model.advisories.some((a) => a.code.startsWith("band-labels-"))).toBe(false);
    expect(model.scaleDiagnostics.some((d) => d.code.startsWith("band-label-"))).toBe(false);
  });
});

describe("band axis guide pins (#407)", () => {
  it("scaleXDiscrete guide.mode=rotate+angle pins the guide plan", () => {
    const pinned: SpecInput = {
      ...spec,
      scales: {
        x: { type: "band", guide: { mode: "rotate", angle: -90 } },
      },
    };
    // Width where auto would wrap (560) — author pin still rotates at −90.
    const model = runPipeline(pinned, { width: 560, height: 300 });
    const plan = model.guidePlans.find(
      (p) => p.type === "axis" && p.scaleType === "band" && p.aesthetic === "x",
    );
    expect(plan?.type).toBe("axis");
    if (plan?.type !== "axis") return;
    expect(plan.bandLabelMode).toBe("rotated");
    expect(plan.bandLabelAngle).toBe(-90);
  });

  it("guide.mode=single suppresses wrap/rotate advisories", () => {
    const pinned: SpecInput = {
      ...spec,
      scales: {
        x: { type: "band", guide: { mode: "single" } },
      },
    };
    const model = runPipeline(pinned, { width: 240, height: 300 });
    expect(model.advisories.some((a) => a.code.startsWith("band-labels-"))).toBe(false);
    const plan = model.guidePlans.find(
      (p) => p.type === "axis" && p.scaleType === "band" && p.aesthetic === "x",
    );
    expect(plan?.type).toBe("axis");
    if (plan?.type !== "axis") return;
    expect(plan.bandLabelMode).toBe("single-line");
    expect(plan.bandLabelAuthorPinned).toBe(true);
  });

  it("guide.mode=wrap/rotate suppress heuristic advisories for pinned modes", () => {
    // Short labels would stay single-line under auto; forced wrap must not claim a heuristic.
    const shortSpec: SpecInput = {
      data: {
        values: [
          { category: "IT", count: 1 },
          { category: "HR", count: 2 },
          { category: "Ops", count: 3 },
        ],
      },
      layers: [{ geom: "col", aes: { x: { field: "category" }, y: { field: "count" } } }],
      scales: { x: { type: "band", guide: { mode: "wrap" } } },
    };
    const wrapModel = runPipeline(shortSpec, { width: 480, height: 300 });
    expect(wrapModel.advisories.some((a) => a.code.startsWith("band-labels-"))).toBe(false);
    const wrapPlan = wrapModel.guidePlans.find(
      (p) => p.type === "axis" && p.scaleType === "band" && p.aesthetic === "x",
    );
    expect(wrapPlan?.type).toBe("axis");
    if (wrapPlan?.type === "axis") {
      expect(wrapPlan.bandLabelMode).toBe("wrapped");
      expect(wrapPlan.bandLabelAuthorPinned).toBe(true);
    }

    const rotatePinned: SpecInput = {
      ...spec,
      scales: { x: { type: "band", guide: { mode: "rotate", angle: -45 } } },
    };
    const rotateModel = runPipeline(rotatePinned, { width: 560, height: 300 });
    expect(rotateModel.advisories.some((a) => a.code.startsWith("band-labels-"))).toBe(false);
    const rotatePlan = rotateModel.guidePlans.find(
      (p) => p.type === "axis" && p.scaleType === "band" && p.aesthetic === "x",
    );
    expect(rotatePlan?.type).toBe("axis");
    if (rotatePlan?.type === "axis") {
      expect(rotatePlan.bandLabelMode).toBe("rotated");
      expect(rotatePlan.bandLabelAuthorPinned).toBe(true);
    }
  });

  it("guide.mode=off hides band labels on vertical (y) axes", () => {
    const pinned: SpecInput = {
      data: {
        values: [
          { category: "North region", count: 1 },
          { category: "South region", count: 2 },
          { category: "East region", count: 3 },
        ],
      },
      // Horizontal bars: categorical on y (vertical band axis).
      layers: [{ geom: "col", aes: { y: { field: "category" }, x: { field: "count" } } }],
      scales: { y: { type: "band", guide: { mode: "off" } } },
    };
    const model = runPipeline(pinned, { width: 400, height: 300 });
    const plan = model.guidePlans.find(
      (p) => p.type === "axis" && p.scaleType === "band" && p.aesthetic === "y",
    );
    expect(plan?.type).toBe("axis");
    if (plan?.type !== "axis") return;
    expect(plan.ticks.every((t) => t.label === "")).toBe(true);
    expect(plan.bandLabelAuthorPinned).toBe(true);
  });

  it("wrapped advisory howToOverride points at scales.x.guide", () => {
    const model = runPipeline(spec, { width: 560, height: 300 });
    const advisory = model.advisories.find((a) => a.code === "band-labels-wrapped");
    expect(advisory?.howToOverride).toContain("scales.x.guide");
  });
});

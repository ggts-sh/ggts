/**
 * The viewport builds a key→value index per band axis. Under the default fixed
 * facet scales every panel receives the *same* scale object, so building that
 * index per panel walked one domain P times and retained P copies of it.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { trainBand } from "../src/scales/train-band.ts";
import { encodeKey } from "../src/scales/state.ts";
import { trainContinuous } from "../src/scales/train-continuous.ts";
import type { PositionScale } from "../src/scales/train-types.ts";
import { createSemanticViewport } from "../src/semantic-viewport.ts";

const CATEGORIES = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** A faceted model, used only for real panels and a real candidate store. */
function facetedModel() {
  const data = CATEGORIES.flatMap((cat) =>
    ["g1", "g2", "g3", "g4"].map((g) => ({ cat, g, v: cat.codePointAt(0) ?? 0 })),
  );
  return runPipeline(
    gg(data, aes({ x: "cat", y: "v" }))
      .geomCol()
      .facet({ wrap: "g" })
      .spec(),
    { width: 640, height: 400 },
  );
}

/** Same scale, but every read of a domain element is counted. */
function counting(scale: PositionScale): { scale: PositionScale; reads: () => number } {
  let reads = 0;
  const rawDomain = new Proxy(scale.rawDomain as unknown[], {
    get(target, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property)) reads += 1;
      return Reflect.get(target, property, receiver) as unknown;
    },
  });
  return { scale: { ...scale, rawDomain }, reads: () => reads };
}

function viewportOver(
  model: ReturnType<typeof runPipeline>,
  perPanel: (index: number) => Readonly<{ x: PositionScale; y: PositionScale }>,
) {
  const panels = model.scene.panels;
  return createSemanticViewport({
    panels,
    scales: { ...perPanel(0), panels: panels.map((_, i) => perPanel(i)) },
    coordProjectors: [],
    flipped: false,
    candidates: () => model.candidates,
    sceneSize: { width: 640, height: 400 },
  });
}

describe("semantic viewport band index", () => {
  it("walks a shared band domain once, not once per panel", () => {
    const model = facetedModel();
    expect(model.scene.panels.length).toBeGreaterThan(1);
    const x = counting(trainBand([CATEGORIES]));
    const y = trainContinuous([new Float64Array([0, 100])]);
    viewportOver(model, () => ({ x: x.scale, y }));
    // One walk of the domain, whatever the panel count. Building per panel read
    // 8 x 4 = 32 here and scales with both.
    expect(x.reads()).toBe(CATEGORIES.length);
    model.dispose();
  });

  it("keeps a per-panel domain for each panel under free scales", () => {
    const model = facetedModel();
    const y = trainContinuous([new Float64Array([0, 100])]);
    // Free scales give every panel its own scale object and its own categories.
    const perPanel = model.scene.panels.map((_, i) => trainBand([[`p${i}-only`, "shared"]]));
    const viewport = viewportOver(model, (i) => ({ x: perPanel[i]!, y }));
    for (let i = 0; i < model.scene.panels.length; i++) {
      const panel = viewport.panels[i]!;
      const span = panel.resolve({ x: { kind: "band", keys: [`p${i}-only`, "shared"] } });
      expect(span.x).toEqual([`p${i}-only`, "shared"]);
      // A neighbour's category must not resolve here.
      const other = (i + 1) % model.scene.panels.length;
      const foreign = panel.resolve({ x: { kind: "band", keys: [`p${other}-only`] } });
      expect(foreign.x).toBeUndefined();
    }
    model.dispose();
  });

  it("resolves shared-scale panels identically to per-panel indexes", () => {
    const model = facetedModel();
    const x = trainBand([CATEGORIES]);
    const y = trainContinuous([new Float64Array([0, 100])]);
    const viewport = viewportOver(model, () => ({ x, y }));
    for (const panel of viewport.panels) {
      expect(panel.resolve({ x: { kind: "band", keys: ["b", "zzz", "f"] } }).x).toEqual(["b", "f"]);
      expect(panel.resolve({ x: { kind: "band", keys: ["zzz"] } }).x).toBeUndefined();
    }
    model.dispose();
  });

  it("shares the index across both axes and through project", () => {
    // Band on x and y, one scale object serving every panel on both axes.
    const model = facetedModel();
    const scale = counting(trainBand([CATEGORIES]));
    const viewport = viewportOver(model, () => ({ x: scale.scale, y: scale.scale }));
    expect(scale.reads()).toBe(CATEGORIES.length);
    for (const panel of viewport.panels) {
      const selection = {
        x: { kind: "band" as const, keys: ["b", "f"] },
        y: { kind: "band" as const, keys: ["c", "e"] },
      };
      expect(panel.resolve(selection).x).toEqual(["b", "f"]);
      expect(panel.resolve(selection).y).toEqual(["c", "e"]);
      // project reads the same shared map; a wrong or empty one collapses it.
      const rect = panel.project(selection);
      expect(rect.x1).toBeGreaterThan(rect.x0);
      expect(rect.y1).toBeGreaterThan(rect.y0);
    }
    model.dispose();
  });

  it("keeps first-wins when two domain values share an encoded key", () => {
    // encodeKey collides only for equal-epoch Dates, and trainBand dedupes them,
    // so the colliding domain has to be built by hand. resolve reads nothing but
    // the index, which is why this stands up despite the rest of the scale
    // object describing the domain it was trained on.
    const model = facetedModel();
    const first = new Date(0);
    const second = new Date(0);
    const x: PositionScale = { ...trainBand([[first]]), rawDomain: [first, second] };
    const y = trainContinuous([new Float64Array([0, 100])]);
    const viewport = viewportOver(model, () => ({ x, y }));
    const key = encodeKey(first);
    for (const panel of viewport.panels) {
      const span = panel.resolve({ x: { kind: "band", keys: [key] } }).x;
      // Identity, not equality: the two Dates compare equal, so only `toBe`
      // tells first-wins from last-wins.
      expect(span?.[0]).toBe(first);
      expect(span?.[1]).toBe(first);
    }
    model.dispose();
  });

  it("hands every panel the same scale object under fixed facet scales", () => {
    // The premise the memo rests on. If training ever copies the scale per panel
    // the memo silently degrades to one index per panel, and nothing else here
    // would notice.
    const model = facetedModel();
    const perPanel = model.scales.panels;
    expect(perPanel.length).toBeGreaterThan(1);
    for (const panel of perPanel) {
      expect(panel.x).toBe(model.scales.x);
      expect(panel.y).toBe(model.scales.y);
    }
    model.dispose();
  });
});

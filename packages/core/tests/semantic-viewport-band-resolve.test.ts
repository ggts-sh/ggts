import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { encodeKey } from "../src/scales/state.ts";

describe("RenderModel semantic viewport", () => {
  it("resolves a band selection without materializing every key", () => {
    // resolve() reports the first and last selected values. It used to map the
    // whole key list to get them, allocating an array per key to read two.
    const categories = Array.from({ length: 400 }, (_, i) => `c${i}`);
    const model = runPipeline(
      gg(
        categories.map((category, i) => ({ category, y: i })),
        aes({ x: "category", y: "y" }),
      )
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;

    let reads = 0;
    const keys = new Proxy(
      categories.map((category) => encodeKey(category)),
      {
        get(target, prop) {
          if (typeof prop === "string" && /^\d+$/.test(prop)) reads += 1;
          return Reflect.get(target, prop) as unknown;
        },
      },
    );
    expect(panel.resolve({ x: { kind: "band", keys } }).x).toEqual(["c0", "c399"]);
    // Exactly two, and independent of the key count: a bound relative to the
    // fixture size would go green if the fixture ever shrank.
    expect(reads).toBe(2);
    model.dispose();
  });

  it("still finds the ends when the outermost keys are not on the axis", () => {
    const model = runPipeline(
      gg(
        [
          { category: "a", y: 1 },
          { category: "b", y: 2 },
          { category: "c", y: 3 },
        ],
        aes({ x: "category", y: "y" }),
      )
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;

    // Unknown keys bracket the real ones and must be skipped from both sides.
    const keys = ["ghost-1", encodeKey("a"), encodeKey("c"), "ghost-2"];
    expect(panel.resolve({ x: { kind: "band", keys } }).x).toEqual(["a", "c"]);
    // Every key unknown: no span at all.
    expect(panel.resolve({ x: { kind: "band", keys: ["ghost-1", "ghost-2"] } }).x).toBeUndefined();
    // A single known key is both ends, whether or not unknowns bracket it —
    // the second reaches the same return only after the backward scan runs.
    expect(panel.resolve({ x: { kind: "band", keys: [encodeKey("b")] } }).x).toEqual(["b", "b"]);
    expect(
      panel.resolve({ x: { kind: "band", keys: ["ghost-1", encodeKey("b"), "ghost-2"] } }).x,
    ).toEqual(["b", "b"]);
    // No keys at all: nothing to span.
    expect(panel.resolve({ x: { kind: "band", keys: [] } }).x).toBeUndefined();
    // A key repeated is still just that value at both ends.
    expect(
      panel.resolve({ x: { kind: "band", keys: [encodeKey("b"), encodeKey("b")] } }).x,
    ).toEqual(["b", "b"]);
  });

  it("spans a band y axis the same way", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, category: "a" },
          { x: 2, category: "b" },
          { x: 3, category: "c" },
        ],
        aes({ x: "x", y: "category" }),
      )
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;
    expect(
      panel.resolve({ y: { kind: "band", keys: ["ghost", encodeKey("a"), encodeKey("c")] } }).y,
    ).toEqual(["a", "c"]);
    model.dispose();
    model.dispose();
  });

  // --- #1332: project() normalizes only the domain extremes, not every key ---

  it("projects a band selection by normalizing only the domain extremes (#1332)", () => {
    const categories = Array.from({ length: 200 }, (_, i) => `c${i}`);
    const model = runPipeline(
      gg(
        categories.map((category, i) => ({ category, y: i })),
        aes({ x: "category", y: "y" }),
      )
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    const scale = model.scales.panels[0]?.x ?? model.scales.x;
    let normalizeCalls = 0;
    const original = scale.normalize.bind(scale);
    scale.normalize = (value: unknown) => {
      normalizeCalls += 1;
      return original(value);
    };
    const panel = model.viewport.panel(model.scene.panels[0]!.id)!;
    const keys = categories.map((category) => encodeKey(category));
    const pixels = panel.project({ x: { kind: "band", keys } });
    // Contiguous full domain: two extremes, one normalize each.
    expect(normalizeCalls).toBe(2);
    expect(pixels.x0).toBeCloseTo(model.scene.panels[0]!.x, 10);
    expect(pixels.x1).toBeCloseTo(model.scene.panels[0]!.x + model.scene.panels[0]!.width, 10);
    model.dispose();
  });

  it("projects non-contiguous band keys from domain extremes, not list ends (#1332)", () => {
    // Keys ordered b, a, d — list ends are b and d, but the selection's domain
    // extremes are a and d. The span must cover a→d.
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
    const shuffled = panel.project({
      x: {
        kind: "band",
        keys: [encodeKey("b"), encodeKey("a"), encodeKey("d")],
      },
    });
    const full = panel.project({
      x: {
        kind: "band",
        keys: [encodeKey("a"), encodeKey("b"), encodeKey("c"), encodeKey("d")],
      },
    });
    // a is the leftmost category; d the rightmost. Missing c does not shrink
    // the outer extent when a and d are both selected.
    expect(shuffled.x0).toBeCloseTo(full.x0, 10);
    expect(shuffled.x1).toBeCloseTo(full.x1, 10);
    expect(shuffled.x0).toBeCloseTo(scenePanel.x, 10);
    expect(shuffled.x1).toBeCloseTo(scenePanel.x + scenePanel.width, 10);
    model.dispose();
  });

  it("projects a reversed band axis from the same extremes (#1332)", () => {
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
        .scales({ x: { reverse: true } })
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;
    // Contiguous b,c under reverse: a is rightmost in screen space.
    const pixels = panel.project({
      x: { kind: "band", keys: [encodeKey("b"), encodeKey("c")] },
    });
    // Domain indices 1 and 2 of 4; reverse flips centers. Edge-to-edge of b,c
    // is the middle half of the panel still — reverse swaps left/right but
    // the expanded half-step span width is the same.
    expect(pixels.x1 - pixels.x0).toBeCloseTo(scenePanel.width * 0.5, 10);
    expect(pixels.x0).toBeCloseTo(scenePanel.x + scenePanel.width * 0.25, 10);
    expect(pixels.x1).toBeCloseTo(scenePanel.x + scenePanel.width * 0.75, 10);
    model.dispose();
  });

  it("projects a band y selection the same way (#1332)", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, category: "a" },
          { x: 2, category: "b" },
          { x: 3, category: "c" },
          { x: 4, category: "d" },
        ],
        aes({ x: "x", y: "category" }),
      )
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;
    const scale = model.scales.panels[0]?.y ?? model.scales.y;
    let normalizeCalls = 0;
    const original = scale.normalize.bind(scale);
    scale.normalize = (value: unknown) => {
      normalizeCalls += 1;
      return original(value);
    };
    const pixels = panel.project({
      y: {
        kind: "band",
        keys: [encodeKey("d"), encodeKey("a"), encodeKey("c")],
      },
    });
    expect(normalizeCalls).toBe(2);
    // a..d cover the full y band domain.
    expect(pixels.y0).toBeCloseTo(scenePanel.y, 10);
    expect(pixels.y1).toBeCloseTo(scenePanel.y + scenePanel.height, 10);
    model.dispose();
  });
});

import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { encodeKey } from "../src/scales/state.ts";

describe("RenderModel semantic viewport", () => {
  it("projects encoded categorical identities edge to edge", () => {
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
    const pixels = panel.project({
      x: { kind: "band", keys: [encodeKey("b"), encodeKey("c")] },
    });

    expect(pixels.x0).toBeCloseTo(scenePanel.x + scenePanel.width * 0.25, 10);
    expect(pixels.x1).toBeCloseTo(scenePanel.x + scenePanel.width * 0.75, 10);
  });

  /**
   * The band extent must not be derived via Math.min(...centers): `keys` is a
   * public unbounded string[], so spreading one argument per selected key
   * RangeErrors on a wide enough band brush. Every key here is distinct, so a
   * dedupe-then-spread "fix" fails this too. Mirrors the grouping.ts guard.
   */
  it("projects a wide band selection without spreading the keys", () => {
    const categories = Array.from({ length: 500 }, (_, i) => `c${String(i)}`);
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
    const originalMin = Math.min;
    const originalMax = Math.max;
    const guard =
      (name: string, original: (...args: number[]) => number) =>
      (...args: number[]): number => {
        if (args.length > 100) {
          throw new Error(
            `Math.${name} spread over ${String(args.length)} args (band extent leak)`,
          );
        }
        return original(...args);
      };
    Math.min = guard("min", originalMin);
    Math.max = guard("max", originalMax);
    try {
      const pixels = panel.project({
        x: { kind: "band", keys: categories.map((category) => encodeKey(category)) },
      });

      expect(pixels.x0).toBeCloseTo(scenePanel.x, 10);
      expect(pixels.x1).toBeCloseTo(scenePanel.x + scenePanel.width, 10);
    } finally {
      Math.min = originalMin;
      Math.max = originalMax;
    }
  });

  it("skips band keys outside the domain when projecting", () => {
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

    const mixed = panel.project({
      x: { kind: "band", keys: [encodeKey("zz"), encodeKey("b"), encodeKey("c"), encodeKey("yy")] },
    });
    expect(mixed.x0).toBeCloseTo(scenePanel.x + scenePanel.width * 0.25, 10);
    expect(mixed.x1).toBeCloseTo(scenePanel.x + scenePanel.width * 0.75, 10);

    const unknown = panel.project({
      x: { kind: "band", keys: [encodeKey("zz")] },
    });
    expect(unknown.x0).toBeCloseTo(scenePanel.x, 10);
    expect(unknown.x1).toBeCloseTo(scenePanel.x + scenePanel.width, 10);

    const empty = panel.project({ x: { kind: "band", keys: [] } });
    expect(empty.x0).toBeCloseTo(scenePanel.x, 10);
    expect(empty.x1).toBeCloseTo(scenePanel.x + scenePanel.width, 10);
  });

  it("resolves encoded categorical identities to raw semantic endpoints", () => {
    const model = runPipeline(
      gg(
        [
          { category: 1, y: 1 },
          { category: "1", y: 2 },
          { category: true, y: 3 },
        ],
        aes({ x: "category", y: "y" }),
      )
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;

    expect(
      panel.resolve({
        x: { kind: "band", keys: [encodeKey(1), encodeKey(true)] },
      }).x,
    ).toEqual([1, true]);
  });

  it("exposes a continuous axis edit model with domain and reversal", () => {
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
          y: { domain: [0, 10], nice: false, expand: { mult: 0, add: 0 }, reverse: true },
        })
        .spec(),
      { width: 400, height: 300 },
    );
    const scenePanel = model.scene.panels[0]!;
    const panel = model.viewport.panel(scenePanel.id)!;
    const x = panel.axisEditModel("x");
    const y = panel.axisEditModel("y");

    expect(x).toEqual({
      kind: "continuous",
      type: "linear",
      transform: "identity",
      domain: [0, 10],
      reversed: false,
    });
    expect(y.kind).toBe("continuous");
    if (y.kind === "continuous") {
      expect(y.type).toBe("linear");
      expect(y.transform).toBe("identity");
      expect(y.domain[0]).toBeCloseTo(0, 10);
      expect(y.domain[1]).toBeCloseTo(10, 10);
      expect(y.reversed).toBe(true);
    }
  });

  it("slices inclusive band categories between edit endpoints", () => {
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
    const x = panel.axisEditModel("x");

    expect(x.kind).toBe("band");
    if (x.kind === "band") {
      expect(x.rawDomain).toEqual(["a", "b", "c", "d"]);
      expect(x.slice(["b", "c"])).toEqual(["b", "c"]);
      expect(x.slice(["c", "a"])).toEqual(["a", "b", "c"]);
      expect(x.slice(["b", "missing"])).toBeUndefined();
    }
  });
});

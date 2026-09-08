/**
 * Browser DOM behavior tests for the @ggts-sh/core/svg-live positional
 * patcher (#1471 Angle 1). Real browser semantics (setAttribute,
 * MutationObserver) across chromium/firefox/webkit.
 *
 * Every parity test renders the updated scene to a fresh SVG string and
 * asserts the patched subtree is isEqualNode-equivalent to the fresh parse:
 * patching must be observably identical to the old render+swap path on every
 * in-skeleton update, and the skeleton root must never be replaced
 * (listeners/state survive). Write-count tests use MutationObserver to prove
 * compare-before-write: unchanged channels must not be touched at all.
 */
import { beforeAll, describe, expect, test } from "vitest";

import { runScene, sceneToSVGString, type Scene } from "@ggts-sh/core/headless";
import {
  registerBasicAreas,
  registerBasicBars,
  registerBasicLines,
  registerBasicPoints,
  registerFiniteStyle,
  registerNumericStyle,
  registerOrdinalColor,
} from "@ggts-sh/core/headless/register";
import { mountSceneSvg } from "@ggts-sh/core/svg-live";
import type { SpecInput } from "@ggts-sh/spec/portable";

const W = 800;
const H = 500;

interface ScatterData {
  x: Float64Array;
  y: Float64Array;
  cls: string[];
}

function scatter(n: number): ScatterData {
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const cls: string[] = [];
  for (let i = 0; i < n; i++) {
    x[i] = (i % 100) / 10;
    y[i] = ((i * 7) % 97) / 10;
    cls.push(`c${i % 6}`);
  }
  return { x, y, cls };
}

function scatterSpec(data: ScatterData): SpecInput {
  return {
    data: { columns: data },
    aes: { x: "x", y: "y", color: "cls" },
    layers: [{ geom: "point", params: { size: 1.5, alpha: 0.7 } }],
  };
}

interface SeriesData {
  x: Float64Array;
  y: Float64Array;
  series: string[];
}

function series(perSeries: number, seriesCount: number): SeriesData {
  const n = perSeries * seriesCount;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const s: string[] = [];
  for (let si = 0; si < seriesCount; si++) {
    for (let i = 0; i < perSeries; i++) {
      const j = si * perSeries + i;
      x[j] = i / (perSeries - 1);
      y[j] = Math.sin(i / 50 + si) * 5 + si * 2;
      s[j] = `s${si}`;
    }
  }
  return { x, y, series: s };
}

function lineSpec(data: SeriesData): SpecInput {
  return {
    data: { columns: data },
    aes: { x: "x", y: "y", color: "series", group: "series" },
    layers: [{ geom: "line" }],
  };
}

interface BarsData {
  category: string[];
  value: number[];
  stack: string[];
}

function bars(categories: number, stacks: number): BarsData {
  const category: string[] = [];
  const value: number[] = [];
  const stack: string[] = [];
  for (let c = 0; c < categories; c++) {
    for (let s = 0; s < stacks; s++) {
      category.push(`cat${c}`);
      value.push(((c * 31 + s * 17) % 23) + 1);
      stack.push(`stk${s}`);
    }
  }
  return { category, value, stack };
}

function barsSpec(data: BarsData): SpecInput {
  return {
    data: { columns: data },
    aes: { x: "category", y: "value", fill: "stack" },
    layers: [{ geom: "col", position: "stack" }],
  };
}

function perturbScatter(d: ScatterData, bump: number): ScatterData {
  const y = Float64Array.from(d.y, (v) => v + bump);
  const cls = [...d.cls.slice(1), d.cls[0]];
  return { x: d.x, y, cls };
}

function perturbSeries(d: SeriesData, bump: number): SeriesData {
  return { ...d, y: Float64Array.from(d.y, (v) => v + bump) };
}

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  return el;
}

/** Parse the fresh-render string of a scene for structural comparison. */
function freshSvg(scene: Scene): Element {
  const holder = document.createElement("div");
  holder.innerHTML = sceneToSVGString(scene);
  return holder.firstElementChild!;
}

/** Count attribute mutations under root during fn(). */
function observedWrites(root: Element, fn: () => void): number {
  let count = 0;
  const observer = new MutationObserver((records) => {
    for (const r of records) if (r.type === "attributes") count++;
  });
  observer.observe(root, { attributes: true, subtree: true });
  fn();
  observer.disconnect();
  return count;
}

beforeAll(() => {
  registerBasicPoints();
  registerBasicLines();
  registerBasicAreas();
  registerBasicBars();
  registerOrdinalColor();
  registerFiniteStyle();
  registerNumericStyle();
});

describe("svg-live patch parity", () => {
  test("scatter update: patched subtree equals fresh render; root preserved", () => {
    const a = scatter(200);
    const b = perturbScatter(a, 0.9);
    const sceneA = runScene(scatterSpec(a), { width: W, height: H });
    const sceneB = runScene(scatterSpec(b), { width: W, height: H });
    const container = freshContainer();
    const live = mountSceneSvg(container, sceneA);
    const rootBefore = container.querySelector("svg")!;
    const circBefore = container.querySelector("circle")!;
    live.update(sceneB);
    expect(container.querySelector("svg")).toBe(rootBefore);
    expect(container.querySelector("circle")).toBe(circBefore);
    expect(rootBefore.isEqualNode(freshSvg(sceneB))).toBe(true);
    live.destroy();
    container.remove();
  });

  test("line update: parity; identical update writes nothing", () => {
    const a = series(500, 3);
    const moved = perturbSeries(a, 0.9);
    const sceneA = runScene(lineSpec(a), { width: W, height: H });
    const sceneMoved = runScene(lineSpec(moved), { width: W, height: H });
    const container = freshContainer();
    const live = mountSceneSvg(container, sceneA);
    const svg = container.querySelector("svg")!;
    const dBefore = Array.from(svg.querySelectorAll("path")).map((p) => p.getAttribute("d"));
    live.update(sceneMoved);
    const dAfter = Array.from(svg.querySelectorAll("path")).map((p) => p.getAttribute("d"));
    expect(dAfter.some((d, i) => d !== dBefore[i])).toBe(true);
    expect(svg.isEqualNode(freshSvg(sceneMoved))).toBe(true);
    // Identical-data update: zero attribute writes anywhere in the subtree.
    const sceneA2 = runScene(lineSpec(a), { width: W, height: H });
    expect(
      observedWrites(svg, () => {
        live.update(sceneA2);
      }),
    ).toBe(0);
    live.destroy();
    container.remove();
  });

  test("scatter identical update: zero writes; fill-only update leaves cx alone", () => {
    const a = scatter(120);
    const sceneA = runScene(scatterSpec(a), { width: W, height: H });
    const container = freshContainer();
    const live = mountSceneSvg(container, sceneA);
    const svg = container.querySelector("svg")!;
    expect(
      observedWrites(svg, () => {
        live.update(runScene(scatterSpec(a), { width: W, height: H }));
      }),
    ).toBe(0);
    // Fill-only change: keep the first-appearance domain order anchored by
    // rows 0..5 (c0..c5), flip tail rows c0→c1. Row 0 keeps its fill; row 6
    // (c0) changes. A full rotation would leave colorIndexes identical
    // (domain order follows first appearance), proving nothing.
    const cls = [...a.cls];
    for (let i = 6; i < cls.length; i++) if (cls[i] === "c0") cls[i] = "c1";
    const recolored: ScatterData = { ...a, cls };
    const sceneRecolor = runScene(scatterSpec(recolored), { width: W, height: H });
    const circles = svg.querySelectorAll(".gg-marks circle");
    const row0 = circles[0];
    const row6 = circles[6];
    const cxBefore = row6.getAttribute("cx");
    const fill0Before = row0.getAttribute("fill");
    const fill6Before = row6.getAttribute("fill");
    const writes = observedWrites(svg, () => {
      live.update(sceneRecolor);
    });
    expect(row6.getAttribute("cx")).toBe(cxBefore);
    expect(row0.getAttribute("fill")).toBe(fill0Before);
    expect(row6.getAttribute("fill")).not.toBe(fill6Before);
    expect(writes).toBeLessThanOrEqual(2 * a.x.length);
    expect(svg.isEqualNode(freshSvg(sceneRecolor))).toBe(true);
    live.destroy();
    container.remove();
  });

  test("bars update: parity through rect patcher", () => {
    const a = bars(50, 4);
    const b: BarsData = { ...a, value: a.value.map((v) => v + 2) };
    const sceneA = runScene(barsSpec(a), { width: W, height: H });
    const sceneB = runScene(barsSpec(b), { width: W, height: H });
    const container = freshContainer();
    const live = mountSceneSvg(container, sceneA);
    const svg = container.querySelector("svg")!;
    live.update(sceneB);
    expect(svg.isEqualNode(freshSvg(sceneB))).toBe(true);
    live.destroy();
    container.remove();
  });

  test("opacity that rounds to 1 stays emitted when alphas appear in place", () => {
    // Devin Review #1662: alphaAttr omits only raw alpha === 1; 0.997 still
    // emits opacity="1". Patcher and fallback attrs must share that rule.
    const a = scatter(1e3);
    const sceneA = runScene(scatterSpec(a), { width: W, height: H });
    const raw = runScene(scatterSpec(a), { width: W, height: H });
    const sceneB: Scene = {
      ...raw,
      batches: raw.batches.map((batch) =>
        batch.kind === "points"
          ? {
              ...batch,
              alphas: new Float32Array(batch.positions.length / 2).fill(0.997),
            }
          : batch,
      ),
    };
    const container = freshContainer();
    const live = mountSceneSvg(container, sceneA);
    const svg = container.querySelector("svg")!;
    live.update(sceneB);
    // Same count/signature: positional patch, NOT a remount.
    expect(container.querySelector("svg")).toBe(svg);
    expect(svg.querySelector(".gg-points circle")?.getAttribute("opacity")).toBe("1");
    expect(svg.isEqualNode(freshSvg(sceneB))).toBe(true);
    live.destroy();
    container.remove();
  });

  test("area update: parity through path patcher (fill branch)", () => {
    const a = series(200, 2);
    const b = perturbSeries(a, 1.5);
    const spec = (d: SeriesData): SpecInput => ({
      data: { columns: d },
      aes: { x: "x", y: "y", fill: "series", group: "series" },
      layers: [{ geom: "area", position: "identity" }],
    });
    const sceneA = runScene(spec(a), { width: W, height: H });
    const sceneB = runScene(spec(b), { width: W, height: H });
    const container = freshContainer();
    const live = mountSceneSvg(container, sceneA);
    const svg = container.querySelector("svg")!;
    live.update(sceneB);
    expect(svg.isEqualNode(freshSvg(sceneB))).toBe(true);
    live.destroy();
    container.remove();
  });

  test("row-count change: remount fallback replaces root with fresh render", () => {
    const a = scatter(100);
    const b = scatter(150);
    const sceneA = runScene(scatterSpec(a), { width: W, height: H });
    const sceneB = runScene(scatterSpec(b), { width: W, height: H });
    const container = freshContainer();
    const live = mountSceneSvg(container, sceneA);
    const rootBefore = container.querySelector("svg")!;
    live.update(sceneB);
    const rootAfter = container.querySelector("svg")!;
    expect(rootAfter).not.toBe(rootBefore);
    expect(rootAfter.isEqualNode(freshSvg(sceneB))).toBe(true);
    expect(rootAfter.querySelectorAll(".gg-marks circle").length).toBe(150);
    live.destroy();
    container.remove();
  });

  test("data-mapped shape mode change per mark: parity via exact diff fallback", () => {
    // circle (fill mode) vs circle-open (stroke mode): same <circle> tag, but
    // the fill/stroke attr sets differ — exercises the per-mark exact-diff
    // fallback without a tag change (a tag change correctly remounts). Both
    // scenes carry the same two-value domain (a single-value domain would
    // elide the legend, changing the skeleton).
    const base = scatter(60);
    const a = {
      ...base,
      shape: Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? "circle" : "circle-open")),
    };
    const b = {
      ...perturbScatter(base, 0.5),
      shape: Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? "circle-open" : "circle")),
    };
    const specShape = (d: ScatterData & { shape: string[] }): SpecInput => ({
      data: { columns: d },
      aes: { x: "x", y: "y", color: "cls", shape: "shape" },
      layers: [{ geom: "point" }],
    });
    const sceneA = runScene(specShape(a), { width: W, height: H });
    const sceneB = runScene(specShape(b), { width: W, height: H });
    const container = freshContainer();
    const live = mountSceneSvg(container, sceneA);
    const svg = container.querySelector("svg")!;
    const rootBefore = svg;
    live.update(sceneB);
    expect(container.querySelector("svg")).toBe(rootBefore);
    expect(svg.isEqualNode(freshSvg(sceneB))).toBe(true);
    live.destroy();
    container.remove();
  });

  test("point alpha toggle: opacity attr appears and is removed at 1", () => {
    // Same spec throughout (aes.alpha mapped); values toggle across the
    // omission boundary. Domain [0.5, 1] is held stable in both scenes (a
    // degenerate single-value domain maps mid-range and never reaches 1):
    // solid maps 1→range-max (attr omitted) and 0.5→mid (attr present);
    // faded swaps the assignment per row parity.
    const a = scatter(40);
    const specA = (d: ScatterData & { alpha: number[] }): SpecInput => ({
      data: { columns: d },
      aes: { x: "x", y: "y", color: "cls", alpha: "alpha" },
      layers: [{ geom: "point" }],
    });
    const solid = { ...a, alpha: a.x.map((_, i) => (i % 2 === 0 ? 1 : 0.5)) };
    const faded = { ...a, alpha: a.x.map((_, i) => (i % 2 === 0 ? 0.5 : 1)) };
    const sceneA = runScene(specA(solid), { width: W, height: H });
    const sceneB = runScene(specA(faded), { width: W, height: H });
    const container = freshContainer();
    const live = mountSceneSvg(container, sceneA);
    const svg = container.querySelector("svg")!;
    const circles = svg.querySelectorAll(".gg-marks circle");
    const even = circles[0];
    const odd = circles[1];
    expect(even.getAttribute("opacity")).toBeNull();
    expect(odd.getAttribute("opacity")).not.toBeNull();
    live.update(sceneB);
    expect(even.getAttribute("opacity")).not.toBeNull();
    expect(odd.getAttribute("opacity")).toBeNull();
    expect(svg.isEqualNode(freshSvg(sceneB))).toBe(true);
    const sceneC = runScene(specA(solid), { width: W, height: H });
    live.update(sceneC);
    expect(even.getAttribute("opacity")).toBeNull();
    expect(odd.getAttribute("opacity")).not.toBeNull();
    expect(svg.isEqualNode(freshSvg(sceneC))).toBe(true);
    live.destroy();
    container.remove();
  });

  test("destroy clears the container", () => {
    const sceneA = runScene(scatterSpec(scatter(10)), { width: W, height: H });
    const container = freshContainer();
    const live = mountSceneSvg(container, sceneA);
    expect(container.querySelector("svg")).not.toBeNull();
    live.destroy();
    expect(container.querySelector("svg")).toBeNull();
    container.remove();
  });
});

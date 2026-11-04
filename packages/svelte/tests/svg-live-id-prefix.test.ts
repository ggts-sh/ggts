/**
 * #1902 — two live plots in one document must not share SVG ids. Ids are
 * document-scoped, so an unprefixed `url(#gg-clip-0)` in the second plot
 * resolves to the first plot's clip path and silently cuts marks. `idPrefix`
 * namespaces the mount and every patched reference.
 */
import { beforeAll, describe, expect, test } from "vitest";

import { runScene, type Scene } from "@ggts-sh/core/headless";
import { registerBasicAreas } from "@ggts-sh/core/headless/register";
import { mountSceneSvg } from "@ggts-sh/core/svg-live";
import { aes, fillPaintLinear, gg, glow } from "@ggts-sh/spec";

beforeAll(() => {
  registerBasicAreas();
});

function ribbonScene(bump = 0): Scene {
  return runScene(
    gg(
      {
        x: [1, 2, 3, 4],
        lo: [1 + bump, 2 + bump, 1.5 + bump, 2 + bump],
        hi: [3 + bump, 4 + bump, 3.5 + bump, 4 + bump],
      },
      aes({ x: "x", ymin: "lo", ymax: "hi" }),
    )
      .geomRibbon({
        fillPaint: fillPaintLinear({
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 1,
          stops: [
            { offset: 0, color: "#1f77b4" },
            { offset: 1, color: "#ff7f0e" },
          ],
          fallback: "#1f77b4",
        }),
        glow: glow({ color: "#00aaff", radius: 6, opacity: 0.4 }),
      })
      .spec(),
    { width: 400, height: 300 },
  );
}

function idsIn(root: Element): string[] {
  return Array.from(root.querySelectorAll("[id]")).map((el) => el.id);
}

function refsIn(root: Element): string[] {
  const refs: string[] = [];
  for (const el of root.querySelectorAll("*")) {
    for (const attr of Array.from(el.attributes)) {
      for (const match of attr.value.matchAll(/url\(#([^)]+)\)/g)) refs.push(match[1]);
    }
  }
  return refs;
}

function expectNamespaced(root: Element, scope: string): void {
  const ids = idsIn(root);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(id.startsWith(scope)).toBe(true);
  for (const ref of refsIn(root)) expect(ids).toContain(ref);
}

describe("live svg idPrefix (#1902)", () => {
  test("two mounted plots keep separate clips and paint defs", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const ra = document.createElement("div");
    const rb = document.createElement("div");
    host.append(ra, rb);
    const a = mountSceneSvg(ra, ribbonScene(), { idPrefix: "a" });
    const b = mountSceneSvg(rb, ribbonScene(1), { idPrefix: "b" });

    expectNamespaced(a.svg, "a-");
    expectNamespaced(b.svg, "b-");
    // Same document: every id unique across both plots.
    const all = [...idsIn(a.svg), ...idsIn(b.svg)];
    expect(new Set(all).size).toBe(all.length);

    expect(a.svg.querySelector(".gg-marks")!.getAttribute("clip-path")).toBe("url(#a-gg-clip-0)");
    expect(b.svg.querySelector(".gg-marks")!.getAttribute("clip-path")).toBe("url(#b-gg-clip-0)");
    expect(Array.from(a.svg.querySelectorAll("clipPath"))[0].id).toBe("a-gg-clip-0");
    expect(Array.from(b.svg.querySelectorAll("clipPath"))[0].id).toBe("b-gg-clip-0");
    expect(a.svg.querySelector("linearGradient")!.id).toBe("a-gg-paint-l0-p0-fill");
    expect(b.svg.querySelector("filter")!.id).toBe("b-gg-paint-l0-p0-glow");

    host.remove();
  });

  test("patching keeps prefixed defs and references in sync", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const handle = mountSceneSvg(host, ribbonScene(), { idPrefix: "chart" });
    expectNamespaced(handle.svg, "chart-");

    // Same structure, new geometry: takes the patch path, not a remount.
    const before = handle.svg;
    handle.update(ribbonScene(1));
    expect(handle.svg).toBe(before);
    expectNamespaced(handle.svg, "chart-");
    expect(handle.svg.querySelector(".gg-marks")!.getAttribute("clip-path")).toBe(
      "url(#chart-gg-clip-0)",
    );
    // Patched mark attributes point at the prefixed paint defs.
    const fill = Array.from(handle.svg.querySelectorAll(".gg-marks [fill^='url(#']"))[0];
    expect(fill?.getAttribute("fill")).toBe("url(#chart-gg-paint-l0-p0-fill)");

    handle.destroy();
    host.remove();
  });
});

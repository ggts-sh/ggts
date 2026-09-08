/**
 * M2 pipeline — renderToSVGString — M2 geoms.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { renderToSVGString } from "../../src/render-svg-full.ts";
import { scatter, size } from "./fixtures.ts";

describe("renderToSVGString — M2 geoms", () => {
  it("renders every new geom deterministically (byte-identical reruns)", () => {
    const data = scatter(80);
    const spec = gg(data, aes({ x: "x", y: "y" }))
      .geomPoint({ position: "jitter", alpha: 0.5 })
      .geomSmooth({ method: "loess", span: 0.8 })
      .spec();
    const first = renderToSVGString(spec, size);
    const second = renderToSVGString(spec, size);
    expect(first).toBe(second);
    expect(first).toContain("<svg");
    expect(first).toContain("gg-paths");
  });

  it("boxplot + histogram + density + errorbar all reach SVG", () => {
    const data = scatter(60);
    for (const spec of [
      gg({ x: data.x }, aes({ x: "x" }))
        .geomHistogram({ binwidth: 1 })
        .spec(),
      gg(data, aes({ x: "g", y: "y" }))
        .geomBoxplot()
        .spec(),
      gg({ x: data.x }, aes({ x: "x" }))
        .geomDensity()
        .spec(),
      gg(data, aes({ x: "g", y: "y" }))
        .geomErrorbar({ stat: "summary" })
        .spec(),
    ]) {
      const svg = renderToSVGString(spec, size);
      expect(svg).toContain("<svg");
      expect(svg.length).toBeGreaterThan(500);
    }
  });

  it("puts overlaid density alpha on each path, not the group", () => {
    const data = scatter(80);
    const svg = renderToSVGString(
      gg(data, aes({ x: "x", fill: "g" }))
        .geomDensity({ alpha: 0.45 })
        .spec(),
      size,
    );
    const areasOpen = svg.match(/<g class="gg-batch gg-areas"[^>]*>/);
    expect(areasOpen?.[0]).toBeDefined();
    expect(areasOpen![0]).not.toContain("opacity=");
    const areaPaths = [...svg.matchAll(/<path d="[^"]+" fill="[^"]+" stroke="none"[^/]*\/>/g)].map(
      (match) => match[0],
    );
    expect(areaPaths.length).toBe(2);
    for (const path of areaPaths) {
      expect(path).toContain('opacity="0.45"');
    }
  });
});

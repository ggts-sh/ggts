/**
 * Seam C (#1420): component self-registration, isolated.
 *
 * This file lives in the SSR lane on purpose: the browser lane has a
 * lane-wide registerAll() setup (tests/setup-register-all.ts) that would
 * mask the behavior under test. Vitest's per-file isolate gives this file a
 * fresh registry — the default entry's host-init brings only basic
 * geoms/stats, GGPlot installs interaction candidates, and the GeomSmooth
 * import alone must register its stat + geom.
 *
 * DO NOT add a registerAll() setup to the SSR lane; it would silently mask
 * this seam.
 */
import { describe, expect, it } from "vitest";

import GGPlot from "../src/lib/GGPlot.svelte";
import SmoothSelfRegisterFixture from "./fixtures/SmoothSelfRegisterFixture.svelte";
import { renderSsrFixture } from "./helpers/ssr.js";

const rows = [
  { x: 1, y: 10 },
  { x: 2, y: 20 },
  { x: 3, y: 15 },
];

describe("geom component self-registration (#1420, Seam C)", () => {
  it("<GeomSmooth> renders smooth marks with no registerAll in the module graph", () => {
    const fixture = renderSsrFixture(SmoothSelfRegisterFixture, {});
    expect(fixture.body).toContain("gg-plot");
    // The smooth layer paints a fitted line + confidence band as paths.
    expect(fixture.body).toContain("<path");
  });

  it("basic charts (point) render with only the default-entry registration", () => {
    const fixture = renderSsrFixture(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      width: 480,
      height: 320,
    });
    expect(fixture.body).toContain("<circle");
  });

  it("spec-driven specialty stat without its component errors with registration guidance", () => {
    // geom density's batch is basic (area) but stat density is NOT registered
    // in this file's graph — no GeomDensity import, no registerAll.
    expect(() =>
      renderSsrFixture(GGPlot, {
        data: rows,
        aes: { x: "x" },
        layers: [{ geom: "density" }],
        width: 480,
        height: 320,
      }),
    ).toThrow(/Stat "density" is not registered.*registerAll\(\)/s);
  });
});

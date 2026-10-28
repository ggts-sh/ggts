/**
 * Lean entry (`@ggts-sh/react/lean`): GGPlot without default registration.
 *
 * This file imports only lean.ts, never index.ts or host-init.ts. Vitest's
 * per-file isolate gives it a fresh registry, so the app's own register
 * calls are the only registration in the graph.
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

import { GGPlot, registerBasicPoints, registerDefaultOrdinalColor } from "../src/lean.js";

const props = {
  data: [
    { x: 1, y: 10, g: "a" },
    { x: 2, y: 20, g: "b" },
  ],
  aes: { x: "x", y: "y", color: "g" },
  layers: [{ geom: "point" as const }],
  width: 480,
  height: 320,
};

describe("lean entry", () => {
  it("does not register basic geoms on import", () => {
    // The color kind is checked first; each error names its register call.
    expect(() => renderToString(createElement(GGPlot, props))).toThrow(
      /Color scale type "ordinal" is not registered.*registerOrdinalColor\(\)/s,
    );
    expect(() =>
      renderToString(createElement(GGPlot, { ...props, aes: { x: "x", y: "y" } })),
    ).toThrow(/Geom "point" is not registered.*registerBasicPoints\(\)/s);
  });

  it("renders once the app registers what the chart uses", () => {
    registerBasicPoints();
    registerDefaultOrdinalColor();
    const html = renderToString(createElement(GGPlot, props));
    expect(html).toContain("gg-plot-root");
    expect(html).toContain("<circle");
  });
});

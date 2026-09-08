/**
 * ggsvelte server render, line-3x1k (see ssr__ggsvelte__scatter-color for the
 * timed-path contract).
 */
import { renderToSVGString } from "@ggts-sh/core/render";
import { aes, gg } from "@ggts-sh/spec/portable";

import { makeMultiSeries, PLOT_HEIGHT, PLOT_WIDTH } from "../scenarios";

const data = makeMultiSeries(3, 1000);

export function renderOnce(): { bytes: number; marks: number } {
  const spec = gg(data, aes({ x: "x", y: "y", color: "series", group: "series" }))
    .geomLine()
    .toPortable();
  const svg = renderToSVGString(spec, { width: PLOT_WIDTH, height: PLOT_HEIGHT });
  const marks = (svg.match(/<path[\s>]/g) ?? []).length;
  return { bytes: svg.length, marks, head: svg.slice(0, 300) };
}

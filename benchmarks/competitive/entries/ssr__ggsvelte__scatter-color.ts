/**
 * ggsvelte server render, scatter-color-1k: the documented agent/headless
 * path — gg() spec -> renderToSVGString (Node-safe, no DOM, no Svelte
 * runtime). Spec construction is inside the timed call so each render is
 * data -> SVG, matching what the peer components do per SSR render.
 */
import { renderToSVGString } from "@ggts-sh/core/render";
import { aes, gg } from "@ggts-sh/spec/portable";

import { makeScatter, PLOT_HEIGHT, PLOT_WIDTH } from "../scenarios";

const data = makeScatter(1000);

export function renderOnce(): { bytes: number; marks: number } {
  const spec = gg(data, aes({ x: "x", y: "y", color: "cls" }))
    .geomPoint({ size: 1.5, alpha: 0.7 })
    .toPortable();
  const svg = renderToSVGString(spec, { width: PLOT_WIDTH, height: PLOT_HEIGHT });
  const marks = (svg.match(/<circle[\s>]/g) ?? []).length;
  return { bytes: svg.length, marks, head: svg.slice(0, 300) };
}

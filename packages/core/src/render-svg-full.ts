/**
 * renderToSVGString that injects the full named-theme catalog.
 * Headless keeps the slim default via run-scene.ts.
 */
import type { GGBuilder, SpecInput } from "@ggts-sh/spec";

import { EDITION_DEFAULTS } from "./editions.js";
import { renderToSVGString as renderToSVGStringCore, type RenderSVGOptions } from "./render-svg.js";

export function renderToSVGString(spec: SpecInput | GGBuilder, options: RenderSVGOptions): string {
  return renderToSVGStringCore(spec, {
    ...options,
    editions: options.editions ?? EDITION_DEFAULTS,
  });
}

/// <reference lib="dom" />
// @ggts-sh/core/dom — DOM entrypoint: canvas batch renderers (decision 0006
// strata recipes). Browser-only; never imported by the pure entry. The Svelte
// adapter composes these into the strata DOM;
// renderToSVGString never touches this module (always all-SVG).
//
// Lifecycle (Hadley lesson 13; meanings in CONTRIBUTING.md): tags collected
// into lifecycle.json by scripts/gen-lifecycle.ts.
// @lifecycle-default experimental
//
// Implementation split (same package surface):
//   canvas-dom.ts   — cssColorResolver / sizeCanvasForDpr / drawClippedToPanel
//   canvas-marks*.ts — mark drawers by kind + drawBatch + focus mask helpers
//   canvas.ts       — groupBatchesByPanel + drawStratum

export { cssColorResolver, drawClippedToPanel, sizeCanvasForDpr } from "./canvas-dom.js";
export type { ColorResolver } from "./canvas-dom.js";

export { drawBatch } from "./canvas-marks.js";
export type { CanvasFocusPresentation, PrimitiveFocusMask } from "./canvas-marks.js";

export { drawStratum } from "./canvas.js";

export { StaticQuadtree } from "./quadtree.js";

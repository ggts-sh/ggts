/**
 * Per-geom geometry batch dispatch for a single layer frame.
 * Implementations register via geometry-register-basic / geometry-register-all.
 */
import type { GeometryBatch } from "../scene.js";

import { getGeomBatchBuilder } from "./geometry-registry.js";
import { geomRegisterHint, isBasicRegisterHint } from "./register-hints.js";
import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import type { ResolvedStyleScales } from "./geometry-style.js";
import { PipelineError } from "./types.js";

export function dispatchGeometryBatch(
  frame: LayerFrame,
  fx: Frame,
  color: ResolvedColorScale | null,
  fill: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
): GeometryBatch[] {
  const geom = frame.binding.layer.geom;
  const build = getGeomBatchBuilder(geom);
  if (build === undefined) {
    const family = geomRegisterHint(geom);
    const fix =
      family === undefined
        ? `Call registerAll() (full grammar) or registerBasic() (identity charts) from @ggts-sh/core, render the geom's <Geom*> component (it self-registers), or call registerGeomBatch("${geom}", …).`
        : isBasicRegisterHint(family)
          ? `Call ${family}() from @ggts-sh/core/headless/register once at startup, or registerAll() from @ggts-sh/core (full grammar). Low-level: registerGeomBatch("${geom}", …).`
          : `Call ${family}() once at startup (exported from @ggts-sh/svelte and @ggts-sh/core) or registerAll() (full grammar), or render the geom's <Geom*> component (it self-registers). Low-level: registerGeomBatch("${geom}", …).`;
    throw new PipelineError(
      "unsupported-param",
      `/layers/${String(frame.binding.index)}/geom`,
      `Geom "${geom}" is not registered in this build. ${fix}`,
    );
  }
  return build(frame, fx, color, fill, styles, warnings);
}

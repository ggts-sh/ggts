/**
 * Geom → batch builder registry for scene geometry.
 *
 * The full package registers every geom; `@ggts-sh/core/render` registers the
 * common identity chart set (point/line/path/col/bar/area/rule/text/…) so
 * specialty geoms (smooth ribbon, violin, hex, sf, …) stay out of lean graphs.
 */
import type { GeometryBatch } from "../scene.js";

import type { LayerFrame, PipelineWarning, ResolvedColorScale } from "./types.js";
import type { Frame } from "./geometry-shared.js";
import type { ResolvedStyleScales } from "./geometry-style.js";

export type GeometryBatchBuilder = (
  frame: LayerFrame,
  fx: Frame,
  color: ResolvedColorScale | null,
  fill: ResolvedColorScale | null,
  styles: ResolvedStyleScales,
  warnings: PipelineWarning[],
) => GeometryBatch[];

const builders = new Map<string, GeometryBatchBuilder>();

export function registerGeomBatch(geom: string, build: GeometryBatchBuilder): void {
  builders.set(geom, build);
}

export function getGeomBatchBuilder(geom: string): GeometryBatchBuilder | undefined {
  return builders.get(geom);
}

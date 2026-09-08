/**
 * Curated gallery preview per geom for the /reference/geoms index.
 *
 * Each entry points at a gallery example id whose static PNG lives under
 * /previews/ (see GALLERY_PREVIEWS). Prefer a chart that makes the mark
 * itself obvious over multi-layer demos.
 */
import type { GeomName } from "@ggts-sh/spec";
import { KNOWN_GEOMS } from "@ggts-sh/spec";

import { GALLERY_PREVIEWS } from "./generated/gallery-previews.js";

/**
 * One representative gallery example id per geom.
 * Values must exist in GALLERY_PREVIEWS (enforced by tests).
 */
export const GEOM_THUMBNAIL_EXAMPLE = {
  point: "point/scatter-color",
  line: "line/multi-series",
  path: "path/trajectory",
  col: "col/basic",
  bar: "bar/dodged",
  histogram: "histogram/basic",
  freqpoly: "freqpoly/basic",
  area: "area/basic",
  rule: "rule/annotation",
  hline: "hline/threshold",
  vline: "vline/cutoff",
  text: "text/labels",
  label: "label/basic",
  smooth: "smooth/loess-scatter",
  quantile: "point/quantile-lines",
  boxplot: "boxplot/by-category",
  density: "density/overlay",
  // Dedicated sparse identity specimens so caps / bare stem / mid point /
  // interval box each read at the 96×96 geoms-index crop (they used to share
  // errorbar/mean-se and looked identical).
  errorbar: "errorbar/caps",
  linerange: "linerange/stems",
  pointrange: "pointrange/midpoints",
  crossbar: "crossbar/boxes",
  rect: "rect/regions",
  tile: "tile/heatmap",
  raster: "raster/grid",
  ribbon: "ribbon/bounds",
  segment: "segment/annotations",
  count: "point/count",
  violin: "boxplot/violin",
  function: "line/function",
  polygon: "polygon/regions",
  hex: "hex/basic",
  bin_2d: "bin2d/basic",
  abline: "point/abline-identity",
  curve: "curve/connectors",
  contour: "contour/basic",
  density_2d: "density/kde-2d",
  density_2d_filled: "density/kde-2d-filled",
  dotplot: "dotplot/histodot",
  map: "map/choropleth",
  sf: "sf/basic",
  sf_text: "sf/labels",
  sf_label: "sf/boxed-labels",
  blank: "blank/axes-only",
  // Dedicated sparse specimens so each mark reads at the 96×96 geoms-index
  // crop (dense menu/field/ECDF/Michelson charts collapsed into grey blobs).
  jitter: "jitter/spread",
  spoke: "spoke/rays",
  rug: "rug/ticks",
  step: "step/stairs",
  qq: "qq/cloud",
  qq_line: "qq_line/match",
} as const satisfies Record<GeomName, string>;

const previewPathById = new Map(
  GALLERY_PREVIEWS.map((preview) => [preview.id, preview.path] as const),
);

/** Static path under the site base for the geom's index thumbnail, or undefined if missing. */
export function thumbnailPathForGeom(geom: GeomName): string | undefined {
  const exampleId = GEOM_THUMBNAIL_EXAMPLE[geom];
  return previewPathById.get(exampleId);
}

/**
 * Full-frame illustration for a geom detail page: the same light-theme gallery
 * PNG the index crops, plus the example id for a live-chart link.
 */
export function illustrationForGeom(
  geom: GeomName,
): { path: string; exampleId: string } | undefined {
  const exampleId = GEOM_THUMBNAIL_EXAMPLE[geom];
  const path = previewPathById.get(exampleId);
  return path === undefined ? undefined : { path, exampleId };
}

/** Every KNOWN_GEOMS entry must have a resolvable gallery preview. */
export function missingGeomThumbnails(): readonly string[] {
  const missing: string[] = [];
  for (const geom of KNOWN_GEOMS) {
    if (thumbnailPathForGeom(geom) === undefined) {
      missing.push(`${geom} → ${GEOM_THUMBNAIL_EXAMPLE[geom]}`);
    }
  }
  return missing;
}

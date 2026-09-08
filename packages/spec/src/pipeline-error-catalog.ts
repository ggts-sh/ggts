/**
 * Pipeline error catalog — structured errors thrown as
 * `PipelineError { code, path, message }`. Pure data owned by @ggts-sh/spec
 * (#987) so docs and agents have one prose source. Re-exported from
 * @ggts-sh/core diagnostics for existing imports.
 *
 * Dual-channel codes (also emitable by validate) pull prose from
 * error-prose-shared.ts — do not inline summary/fix for those keys.
 */

import { DUAL_ERROR_PROSE } from "./error-prose-shared.js";

/** One render-time error catalog entry. */
export interface PipelineErrorCatalogEntry {
  summary: string;
  fix: string;
}

/** Structured errors thrown as `PipelineError { code, path, message }`. */
export const PIPELINE_ERROR_CATALOG = {
  "guide-aesthetic-incompatible": DUAL_ERROR_PROSE["guide-aesthetic-incompatible"],
  "guide-layout-overflow": {
    summary: "A guide configured with collision: error cannot fit its authored label.",
    fix: 'Use collision: "ellipsis" for long labels; increase the chart size, reduce categories, or suppress an oversized guide.',
  },
  "no-data": {
    summary: "A layer has neither plot-level data nor its own layer.data.",
    fix: "Set spec.data and/or layer.data ({values}, {columns}, or {name}), or pass named data via RunOptions.data.",
  },
  "dataset-collision": {
    summary: "A dataset name is defined in both spec.datasets and RunOptions.data.",
    fix: "Rename one of them, or pass allowOverride: true to let the runtime data win.",
  },
  "unknown-dataset": {
    summary: 'A {"name": ...} data ref names a dataset that is not defined anywhere.',
    fix: "Define it in spec.datasets or RunOptions.data (the message lists the available names).",
  },
  "unknown-field": DUAL_ERROR_PROSE["unknown-field"],
  "all-null-column": DUAL_ERROR_PROSE["all-null-column"],
  "missing-channel": {
    summary: "A geom is missing a required aesthetic channel at render time.",
    fix: "Map the named channel in the layer's aes or the plot-level aes.",
  },
  "unknown-stat-column": DUAL_ERROR_PROSE["unknown-stat-column"],
  "channel-type-mismatch": DUAL_ERROR_PROSE["channel-type-mismatch"],
  "computed-y-mapped": DUAL_ERROR_PROSE["computed-y-mapped"],
  "bin-center-and-boundary": DUAL_ERROR_PROSE["bin-center-and-boundary"],
  "rule-form-ambiguous": DUAL_ERROR_PROSE["rule-form-ambiguous"],
  "rule-form-missing": DUAL_ERROR_PROSE["rule-form-missing"],
  "rule-both-axes": DUAL_ERROR_PROSE["rule-both-axes"],
  "ribbon-orientation-ambiguous": DUAL_ERROR_PROSE["ribbon-orientation-ambiguous"],
  "ribbon-inverted-bounds": {
    summary: "A ribbon layer has one or more rows where the lower bound exceeds the upper bound.",
    fix: "Swap or correct ymin/ymax (or xmin/xmax) so lower ≤ upper on every finite row.",
  },
  "facet-form-ambiguous": DUAL_ERROR_PROSE["facet-form-ambiguous"],
  "facet-form-missing": DUAL_ERROR_PROSE["facet-form-missing"],
  "invalid-scale-domain": {
    summary: "An explicit scale domain is malformed for its scale type.",
    fix: "Provide a two-element [min, max] for continuous scales (values of the field's type).",
  },
  "invalid-scale-breaks": {
    summary: "One or more explicit scale breaks do not match the scale's parser.",
    fix: "Use numeric breaks for numeric scales or values matching the temporal parse option.",
  },
  "invalid-temporal-labels": {
    summary: "A temporal dateLabels string uses an unsupported or incomplete token.",
    fix: "Use only the documented closed dateLabels token grammar.",
  },
  "invalid-temporal-locale": {
    summary: "A temporal scale locale is not a valid supported BCP 47 locale.",
    fix: "Use a canonical BCP 47 locale such as en-US, en-GB, fr-FR, or ja-JP.",
  },
  "temporal-parse-failed": {
    summary: "An explicit temporal parser rejected one or more source values.",
    fix: "Correct the rejected values, choose the matching parser, or explicitly opt into censoring.",
  },
  "temporal-break-limit": {
    summary: "An explicit temporal interval would generate more bounded ticks than allowed.",
    fix: "Choose a coarser calendar interval.",
  },
  "temporal-break-progression": {
    summary: "Calendar interval progression failed to advance monotonically.",
    fix: "Choose another timezone, disambiguation policy, or interval and report the failing case.",
  },
  "invalid-scale-transform": {
    summary: "The scale transform registry was asked for an unknown transform key.",
    fix: "Use a supported transform (identity, log10, sqrt). This indicates malformed runtime input.",
  },
  "scale-transform-domain": {
    summary:
      "An explicit scale domain falls outside the transform's valid range (log10 <= 0, sqrt < 0).",
    fix: "Restrict the domain to the transform's valid range, or use the identity transform.",
  },
  "scale-type-transform-conflict": DUAL_ERROR_PROSE["scale-type-transform-conflict"],
  "scale-zero-invalid-for-transform": {
    summary:
      "zero: true was requested under a transform with no valid image for semantic zero (log10).",
    fix: "Remove zero: true; log10 positions use the transformed-space origin (semantic 1), never log10(0).",
  },
  "coord-transform-domain": {
    summary:
      "A post-stat coordinate transform cannot project its trained or explicit viewport domain.",
    fix: "Choose coordinate limits inside the transform domain, or use the identity coordinate transform.",
  },
  "coord-transform-temporal": {
    summary: "A non-identity coordinate transform was requested for a temporal axis.",
    fix: "Keep temporal coordinates on identity; use identity coordinate limits/reverse for a viewport.",
  },
  "coord-transform-continuous": {
    summary:
      "A quantitative coordinate transform or numeric limits were requested for a band axis.",
    fix: "Use identity coordinates for categories, or configure a continuous quantitative scale.",
  },
  "coord-fixed-free-scales": DUAL_ERROR_PROSE["coord-fixed-free-scales"],
  "coord-fixed-invalid-aspect": {
    summary:
      "A fixed-aspect target or fitted data rectangle is non-finite or non-positive after chrome is allocated.",
    fix: "Use a moderate finite ratio and non-degenerate positional domains, or enlarge the plot allocation.",
  },
  "binned-scale-requires-continuous": {
    summary: 'A type: "binned" scale is bound to a discrete or temporal field.',
    fix: 'Map a quantitative field, or use type: "band"/"time" instead of "binned".',
  },
  "binned-scale-break-limit": {
    summary: "A binned scale's automatic or explicit breaks would exceed MAX_BINNED_BREAKS (64).",
    fix: "Supply fewer explicit breaks, or widen them so automatic binning stays under the limit.",
  },
  "palette-exhausted": {
    summary:
      'A discrete color scale with onExhaust: "error" ran out of palette entries (the default "cycle" only warns).',
    fix: "Provide a larger range, set an explicit domain, or accept cycling by removing onExhaust.",
  },
  "color-temporal-parse": {
    summary: "A temporal color/fill scale could not parse the complete mapped column.",
    fix: "Set the exact parse order, correct the rejected values, or explicitly choose parseFailure: censor.",
  },
  "color-temporal-kind": {
    summary:
      "A temporal color/fill scale requested date or datetime precision that the data does not have.",
    fix: "Use the matching date/datetime helper or correct the source precision.",
  },
  "color-manual-domain-range": DUAL_ERROR_PROSE["color-manual-domain-range"],
  "color-binned-breaks": {
    summary: "Binned color/fill boundaries are invalid, unparseable, duplicated, or unordered.",
    fix: "Provide 2–65 strictly increasing boundaries valid for the parser and transform.",
  },
  "color-binned-empty": {
    summary: "A binned color/fill scale has no values inside its parser/transform domain.",
    fix: "Correct the mapped values, parser, or transform, or provide a valid explicit domain.",
  },
  "color-binned-domain": {
    summary: "A binned color/fill domain is degenerate or invalid for its transform.",
    fix: "Provide two distinct domain endpoints valid for identity, log10, or sqrt.",
  },
  "color-domain-invalid": {
    summary: "A sequential color/fill domain does not contain exactly two parseable values.",
    fix: "Provide a two-value semantic domain matching the mapped field and parser.",
  },
  "color-transform-empty": {
    summary: "Every mapped color/fill value is invalid for the requested transform.",
    fix: "Correct the mapped data or choose a transform whose domain contains the values.",
  },
  "color-domain-transform": {
    summary: "A sequential color/fill domain is invalid for its requested transform.",
    fix: "Use positive endpoints for log10, non-negative endpoints for sqrt, or identity.",
  },
  "unsupported-aesthetic-scale": {
    summary: "A finite shape/linetype aesthetic was configured as a continuous scale.",
    fix: "Use a binned scale for quantitative values or an ordinal scale for categories.",
  },
  "unsupported-geom-aesthetic": DUAL_ERROR_PROSE["unsupported-geom-aesthetic"],
  "unsupported-annotation-style": {
    summary:
      "A fixed-intercept annotation rule maps a style to a field or after-stat column, but it has no data rows to map.",
    fix: "Use a constant style value (optionally { value, scale: true }) on the annotation rule.",
  },
  "tile-nonpositive-size": {
    summary: "A tile layer has a non-positive or non-finite width/height.",
    fix: "Map a positive width/height or set params.width / params.height to a positive number.",
  },
  "raster-duplicate-cells": {
    summary: "A raster layer has duplicate (x, y) coordinates.",
    fix: 'Aggregate to one value per cell, or use geom "tile" for overlapping cells.',
  },
  "unsupported-param": {
    summary: "A layer param value is not supported by this runtime.",
    fix: "Use a documented supported value for the param (see the error message).",
  },
  "invalid-aesthetic-constant": {
    summary: "A literal style constant is outside the aesthetic's supported output domain.",
    fix: "Use a positive size/linewidth, alpha in [0,1], or a documented shape/linetype name.",
  },
  "style-temporal-parse": {
    summary: "A temporal numeric style scale could not parse the complete mapped column.",
    fix: "Set the exact parser, correct the rejected values, or explicitly choose censoring.",
  },
  "style-temporal-kind": {
    summary: "A temporal numeric style scale requested the wrong date/datetime precision.",
    fix: "Use the matching date/datetime helper or correct the source precision.",
  },
  "style-manual-domain-range": {
    summary: "A manual style scale has different domain and range lengths.",
    fix: "Provide exactly one output style for every domain value.",
  },
  "style-palette-exhausted": {
    summary: "A finite style scale needs more distinguishable outputs than its range provides.",
    fix: "Provide a larger range, reduce categories/bins, or deliberately opt into cycling.",
  },
  "style-domain-empty": {
    summary: "No finite values can train the requested numeric or binned style scale.",
    fix: "Correct the mapped values or provide a valid explicit domain.",
  },
  "style-domain-invalid": {
    summary: "An explicit style domain is malformed or contradicts its binned boundaries.",
    fix: "Provide two finite semantic endpoints matching the first and last boundaries.",
  },
  "style-range-invalid": {
    summary: "A numeric sequential/binned style range has fewer than two endpoints.",
    fix: "Provide at least two valid output values in the aesthetic's supported bounds.",
  },
  "style-binned-breaks": {
    summary: "Binned style boundaries are missing, non-finite, duplicated, or unordered.",
    fix: "Provide 2–65 strictly increasing numeric boundaries.",
  },
  "stat-channel-unsupported": {
    summary: "A { stat } style mapping names an output the selected stat does not publish.",
    fix: "Use a generated output listed for that stat or map the original field instead.",
  },
  "manual-fun-required": DUAL_ERROR_PROSE["manual-fun-required"],
  "manual-fun-unknown": {
    summary:
      "A layer uses stat manual with an unregistered params.fun (defense for unvalidated specs).",
    fix: "Use a registered name: first, last, mean, median, min, max, sum.",
  },
  "unknown-theme": {
    summary: "spec.theme names a theme that is not registered.",
    fix: "Use a registered name (default, light, dark, minimal) or a theme object.",
  },
  "renderer-failure": {
    summary: "The SVG renderer threw while drawing a scene (never blank output — failure policy).",
    fix: "This is a ggts bug; the message carries the underlying error. Please report it.",
  },
  "max-marks-exceeded": {
    summary: "renderToSVGString refused to render more marks than its maxMarks safety limit.",
    fix: "Raise options.maxMarks deliberately, reduce the data, or render interactively (canvas).",
  },
  "sf-geometry-missing": {
    summary: "geom_sf data is missing the geometry column.",
    fix: 'Provide a column of GeoJSON Geometry JSON strings (default field "geometry", or params.geometry).',
  },
  "sf-geometry-invalid": {
    summary: "A geom_sf geometry cell could not be parsed as drawable GeoJSON Geometry.",
    fix: "Use valid GeoJSON Geometry JSON strings with finite coordinates.",
  },
  "sf-geometry-unsupported": {
    summary: "geom_sf received a GeoJSON type outside the v1 point/line/polygon families.",
    fix: "Use Point/MultiPoint, LineString/MultiLineString, Polygon/MultiPolygon, or GeometryCollection of those families (no CRS).",
  },
  "sf-geometry-mixed": {
    summary: "One geom_sf layer mixes geometry families (point vs line vs polygon).",
    fix: "Split mixed types into separate geom_sf layers (v1 is single-family per layer).",
  },
  "map-data-required": {
    summary: "geom_map was used without params.map.",
    fix: "Pass params.map as { values }, { columns }, or { name } against spec.datasets.",
  },
  "map-coords-missing": {
    summary: "Map data is missing long/lat or x/y coordinate columns.",
    fix: 'Provide "long"+"lat" or "x"+"y" columns in the fortified map table.',
  },
  "map-id-column-missing": {
    summary: "Map data is missing a region join column.",
    fix: 'Set params.mapId or include a "region" / "id" column in the map table.',
  },
} as const satisfies Record<string, PipelineErrorCatalogEntry>;

export type PipelineErrorCode = keyof typeof PIPELINE_ERROR_CATALOG;

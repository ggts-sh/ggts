/**
 * Pipeline warning catalog — degraded-but-rendered conditions on
 * `RenderModel.warnings`. Pure data; re-exported from diagnostics.ts.
 */

/** Warnings (`RenderModel.warnings`): degraded-but-rendered conditions. */
export const PIPELINE_WARNING_CATALOG = {
  "facet-levels-missing": {
    summary:
      "An explicit facet levels list includes values absent from the data; empty panels are kept.",
  },
  "facet-levels-unknown": {
    summary:
      "Data values for a facet field were omitted from the closed levels list and are excluded from every panel.",
  },
  "empty-data": {
    summary: "The data has no rows; the frame and axes render as a placeholder.",
  },
  "empty-layer": {
    summary: "A layer produced no drawable marks after stats/positions; it was skipped.",
  },
  "empty-domain": {
    summary: "A positional scale found no finite values; a placeholder domain is used.",
  },
  "removed-missing": {
    summary:
      "Rows with missing/non-finite values in required channels were dropped (count in message).",
  },
  "raster-irregular-spacing": {
    summary:
      "Raster cell centers are not on a regular grid; the minimum spacing is used (prefer geom tile).",
  },
  "scale-transform-domain": {
    summary:
      "A pre-stat transform dropped values outside its domain (log10 <= 0, sqrt < 0); count in message.",
  },
  "scale-oob-censored": {
    summary: "Values outside explicit source limits were censored to missing before stats.",
  },
  "scale-oob-squished": {
    summary:
      "Values outside explicit source limits were squished to the nearest limit before stats.",
  },
  "scale-break-outside-domain": {
    summary:
      "One or more explicit continuous breaks were outside the trained display domain and omitted.",
  },
  "sequential-discrete-field": {
    summary: "A sequential color scale is fed a discrete field; unparseable values render unknown.",
  },
  "color-temporal-censored": {
    summary:
      "A temporal color/fill parser censored invalid source values by explicit author request.",
  },
  "color-transform-invalid": {
    summary:
      "Some color/fill values are outside the requested transform domain and render unknown.",
  },
  "color-na-values": {
    summary: "Missing color/fill values render with the configured NA color (count in message).",
  },
  "color-unknown-values": {
    summary:
      "Invalid, unmapped, transformed, or censored color/fill values render with the configured unknown color (count in message).",
  },
  "style-temporal-censored": {
    summary: "A temporal numeric style parser censored invalid source values by explicit request.",
  },
  "style-na-values": {
    summary: "Missing mapped style values use the configured NA output.",
  },
  "style-unknown-values": {
    summary: "Invalid or out-of-domain mapped style values use the configured unknown output.",
  },
  "style-palette-exhausted": {
    summary: "A finite style range cycled after explicit author opt-in.",
  },
  "style-fingerprint-mismatch": {
    summary: "Restored style state used a different output range; assignments start fresh.",
  },
  "style-version-mismatch": {
    summary: "Restored style state has an unknown schema version; assignments start fresh.",
  },
  "style-out-of-domain": {
    summary: "Values outside an explicit style domain use the unknown output.",
  },
  "invalid-label-format": {
    summary: "A labels format string was not recognized; the default format is used.",
  },
  "unknown-edition": {
    summary:
      "The spec targets a defaults edition this build does not know; the latest known edition's defaults are used.",
  },
  "color-on-fill-geom": {
    summary:
      "The color channel is mapped on a fill-styled geom (bar/col/area); fill is what varies.",
  },
  "weight-unsupported": {
    summary: "aes.weight is mapped on a stat that does not consume weights.",
  },
  "density-group-dropped": {
    summary: "A density group had too few finite values and was dropped.",
  },
  "contour-group-dropped": {
    summary: "A contour group lacked a usable 2D grid or levels and was dropped.",
  },
  "density-2d-group-dropped": {
    summary: "A density_2d group had too few points or produced no contours and was dropped.",
  },
  "density-2d-filled-open-dropped": {
    summary: "density_2d_filled dropped open isoline rings; v1 fills closed rings only.",
  },
  "sf-coordinates-dropped": {
    summary: "stat_sf_coordinates dropped features with no finite representative point.",
  },
  "map-region-missing": {
    summary: "One or more value rows had no matching map region and were dropped.",
  },
  "group-single-observation": {
    summary:
      "Connected path/area marks derived one observation per group (often a discrete x joining default grouping), so each stroke or ribbon degenerates; map aes.group to join rows into series.",
  },
  "stack-align-skipped": {
    summary:
      "Sparse stacked-area groups were left unaligned because the shared-grid expansion exceeds the auto-rescue budget; bands with interior gaps may render as floating polygons.",
  },
  "smooth-group-dropped": {
    summary: "A smooth group had too few points for the fit and was dropped.",
  },
  "quantile-empty": {
    summary: "No valid quantiles in (0,1) after filtering; nothing drawn.",
  },
  "quantile-group-dropped": {
    summary: "A quantile group was too small or had constant x and was dropped.",
  },
  "manual-group-dropped": {
    summary: "A manual-stat group had no finite x or y under an aggregate fun and was dropped.",
  },
  "ellipse-group-dropped": {
    summary:
      "An ellipse group had fewer than two finite (x,y) points or zero variance and was dropped.",
  },
  "stat-channel-unsupported": {
    summary:
      "A color/fill after-stat mapping names an output the selected stat does not publish; the mapping is ignored (style channels throw the same code as an error).",
  },
  "palette-exhausted": {
    summary:
      "A discrete color scale ran out of palette entries and cycled (the default onExhaust).",
  },
  "fingerprint-mismatch": {
    summary: "Restored scale state was trained on a different palette; assignments start fresh.",
  },
  "version-mismatch": {
    summary: "Restored scale state has an unknown schema version; assignments start fresh.",
  },
  "out-of-domain": {
    summary: "Values outside an explicit scale domain render the unknown color (deduplicated).",
  },
  "temporal-values-censored": {
    summary: "An explicit temporal parser censored invalid source values by author request.",
  },
  "guide-auto-bottom": {
    summary: "An auto-positioned guide moved below the panel to preserve readable width.",
  },
  "unused-scale-option": {
    summary: "A lower-precedence scale option was ignored in favor of an explicit winner.",
  },
  "temporal-label-overlap": {
    summary: "Authored or exhausted automatic temporal labels overlap at the available extent.",
  },
  "temporal-label-margin-overflow": {
    summary: "A complete temporal label exceeds the bounded axis margin.",
  },
  "temporal-break-outside-domain": {
    summary: "One or more explicit temporal breaks were outside the trained domain and omitted.",
  },
  "band-label-overlap": {
    summary:
      "Categorical (band) axis labels cannot all be separated at the available axis extent; layout may thin them or leave overlap.",
  },
  "band-label-margin-overflow": {
    summary:
      "A band label exceeds a bounded axis margin — single-line end truncation, forced-wrap height/side overflow, or a rotated label past the bottom/side cap.",
  },
  "coord-tessellation-cap": {
    summary:
      "Adaptive coordinate tessellation reached a deterministic depth/vertex cap and retained a bounded approximation.",
  },
  "coord-invalid-geometry": {
    summary:
      "Path vertices outside a coordinate transform's domain were removed without bridging the remaining finite runs.",
  },
  "coord-fixed-degraded": {
    summary:
      "A fixed-aspect data rectangle is below the documented readable minimum; the ratio remains exact and minor furniture is removed.",
  },
  "abline-scale-unsupported": {
    summary:
      "geom_abline needs continuous x and y scales to clip y = intercept + slope · x; the layer is skipped on band axes.",
  },
  "function-domain-missing": {
    summary:
      "geom/stat function could not resolve an x evaluation domain (no xlim, mapped x, or peer layer domain).",
  },
  "function-fun-missing": {
    summary: "geom/stat function is missing the required params.fun registry function name.",
  },
  "function-fun-unknown": {
    summary: "geom/stat function named an unknown params.fun registry function.",
  },
  "hex-band-scale": {
    summary:
      "geom_hex needs continuous x and y scales for hexagonal binning; the layer is skipped on band axes.",
  },
  "hex-missing-size": {
    summary:
      "geom_hex is missing per-cell width/height from bin_hex (identity or incomplete frame); the layer is skipped.",
  },
  "ydensity-group-dropped": {
    summary:
      "geom_violin needs at least two data points per group to estimate a density; smaller groups are dropped.",
  },
} as const satisfies Record<string, { summary: string }>;

export type PipelineWarningCode = keyof typeof PIPELINE_WARNING_CATALOG;

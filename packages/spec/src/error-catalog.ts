/**
 * Validation error catalog — stable codes for agent diagnostics and docs.
 * Dual-channel codes (also emitable by the pipeline) pull summary/fix from
 * error-prose-shared.ts (#987). SpecError instance types and didYouMean live
 * in errors.ts. Pipeline-only codes live in pipeline-error-catalog.ts.
 */

import { DUAL_ERROR_PROSE } from "./error-prose-shared.js";

/** One entry of the validation error catalog (docs render straight from it). */
export interface ErrorCatalogEntry {
  /** 1 = schema shape / structural (no data needed); 2 = data-aware (opt-in). */
  tier: 1 | 2;
  /** What went wrong, in one sentence. */
  summary: string;
  /** How to fix it, prescriptively (instances carry a concrete fix.example). */
  fix: string;
}

/**
 * The stable catalog of validation error codes — THE single source for the
 * docs error-reference page and llms-full.txt for validation. Dual-channel
 * prose is shared with PIPELINE_ERROR_CATALOG via DUAL_ERROR_PROSE.
 * Audited M3: every code has a prescriptive summary + fix; a coverage test
 * asserts every code is exercised by a snapshot test.
 */
export const ERROR_CATALOG = {
  // --- tier 1 (schema shape, no data needed) -------------------------------
  "invalid-spec-root": {
    tier: 1,
    summary: "The spec is not a JSON object.",
    fix: 'Provide an object with at least one layer: {"layers": [{"geom": "point", ...}]}.',
  },
  "missing-layers": {
    tier: 1,
    summary: "`layers` is missing or not an array.",
    fix: "Add a layers array with at least one layer object.",
  },
  "empty-layers": {
    tier: 1,
    summary: "`layers` is present but empty (a plot needs at least one layer).",
    fix: 'Add a layer, e.g. {"geom": "point"}.',
  },
  "invalid-layer": {
    tier: 1,
    summary: "A layer is not an object.",
    fix: 'Replace the entry with a layer object carrying a "geom".',
  },
  "missing-geom": {
    tier: 1,
    summary: 'A layer has no "geom" discriminator.',
    fix: 'Add a geom name to the layer, e.g. {"geom": "point"}.',
  },
  "unknown-geom": {
    tier: 1,
    summary: 'A layer\'s "geom" is not a known geom name.',
    fix: "Use one of the allowed geoms (the error lists them, with a did-you-mean).",
  },
  "invalid-channel-value": {
    tier: 1,
    summary:
      "A channel value is not one of the canonical forms {field}/{value}/{stat}/null (bare strings are builder-only shorthand).",
    fix: 'Wrap field mappings as {"field": "column_name"} and constants as {"value": ...}.',
  },
  "unexpected-property": {
    tier: 1,
    summary: "An object carries a property the schema does not allow.",
    fix: "Remove or rename the property (the error suggests the closest allowed name).",
  },
  "missing-property": {
    tier: 1,
    summary: "A required property is missing.",
    fix: "Add the named property.",
  },
  "invalid-enum-value": {
    tier: 1,
    summary: "A value is outside its declared enum/literal set.",
    fix: "Use one of the allowed values (the error lists them, with a did-you-mean).",
  },
  "value-out-of-range": {
    tier: 1,
    summary: "A numeric value is outside its declared bounds.",
    fix: "Set the value inside the bounds stated by the error message.",
  },
  "invalid-data": {
    tier: 1,
    summary: "`data` (or a dataset entry) matches none of the data forms.",
    fix: 'Use {"values": [...rows]}, {"columns": {...arrays}}, or {"name": "dataset"}.',
  },
  "invalid-type": {
    tier: 1,
    summary: "Fallback: a value has the wrong JSON type.",
    fix: "Give the property the JSON type the message names.",
  },
  "scale-scheme-type": {
    tier: 1,
    summary: "A named color scheme is incompatible with the configured color scale type.",
    fix: 'Use a categorical scheme with "ordinal" (or a sequential-family scheme like "viridis" for discrete viridis), or "viridis"/hex stops with "sequential". Cyclic *O schemes are sequential only.',
  },
  "scale-scheme-oob": {
    tier: 1,
    summary: "The out-of-bounds policy is incompatible with the named color scheme or scale type.",
    fix: 'Use oob "wrap" with a cyclic *O scheme. Do not set wrap on a binned color scale.',
  },
  "scale-cyclic-domain": {
    tier: 1,
    summary: "A cyclic color scheme is missing the explicit two-value domain period.",
    fix: "Set domain to one period, for example [0, 360] for angles in degrees.",
  },
  "scale-range-color": {
    tier: 1,
    summary: "A custom color range contains a color outside the supported hex syntax.",
    fix: "Replace each custom color with #rgb or #rrggbb syntax.",
  },
  "scale-type-transform-conflict": {
    tier: 1,
    ...DUAL_ERROR_PROSE["scale-type-transform-conflict"],
  },
  "color-manual-domain-range": {
    tier: 1,
    ...DUAL_ERROR_PROSE["color-manual-domain-range"],
  },
  "scale-labels-breaks-length": {
    tier: 1,
    summary:
      "A position scale's labels array does not have exactly one label for each explicit break.",
    fix: "Set breaks to an explicit array and give labels the same length, in the same order.",
  },
  "facet-space-without-grid": {
    tier: 1,
    summary: "facet.space is set on the wrap form; space sizes grid columns and rows only.",
    fix: "Remove space, or use the grid form (facet.rows / facet.cols).",
  },
  "scale-binned-breaks": {
    tier: 1,
    summary:
      "A binned style scale's authored breaks are missing, non-finite after parsing, duplicated, or not strictly increasing.",
    fix: "Provide 2+ strictly increasing boundaries (numeric, or temporal strings that parse under the scale's parser).",
  },
  "scale-binned-domain": {
    tier: 1,
    summary:
      "A binned style scale's explicit domain does not match the first and last authored breaks.",
    fix: "Set domain to the first and last break values, or omit domain and let breaks define it.",
  },
  "guide-aesthetic-incompatible": {
    tier: 1,
    ...DUAL_ERROR_PROSE["guide-aesthetic-incompatible"],
  },
  "coord-fixed-free-scales": {
    tier: 1,
    ...DUAL_ERROR_PROSE["coord-fixed-free-scales"],
  },
  // --- tier 1 structural (grammar rules the schema alone cannot express) ---
  "missing-required-channel": {
    tier: 2,
    summary: "A geom is missing a required aesthetic channel (x, y, label, ...).",
    fix: "Map the named channel to a data field in the layer's aes or the plot-level aes.",
  },
  "rule-form-ambiguous": {
    tier: 2,
    ...DUAL_ERROR_PROSE["rule-form-ambiguous"],
  },
  "rule-form-missing": {
    tier: 2,
    ...DUAL_ERROR_PROSE["rule-form-missing"],
  },
  "rule-both-axes": {
    tier: 2,
    ...DUAL_ERROR_PROSE["rule-both-axes"],
  },
  "computed-y-mapped": {
    tier: 2,
    ...DUAL_ERROR_PROSE["computed-y-mapped"],
  },
  "bin-center-and-boundary": {
    tier: 2,
    ...DUAL_ERROR_PROSE["bin-center-and-boundary"],
  },
  "facet-form-ambiguous": {
    tier: 2,
    ...DUAL_ERROR_PROSE["facet-form-ambiguous"],
  },
  "facet-form-missing": {
    tier: 2,
    ...DUAL_ERROR_PROSE["facet-form-missing"],
  },
  "facet-ncol-without-wrap": {
    tier: 2,
    summary: "facet.ncol only applies to the wrap form.",
    fix: "Remove ncol, or switch to the wrap form.",
  },
  "unsupported-geom-aesthetic": {
    tier: 2,
    ...DUAL_ERROR_PROSE["unsupported-geom-aesthetic"],
  },
  "ribbon-orientation-ambiguous": {
    tier: 2,
    ...DUAL_ERROR_PROSE["ribbon-orientation-ambiguous"],
  },
  "paint-stops-unordered": {
    tier: 2,
    summary: "A gradient paint's color stops are not in non-decreasing offset order.",
    fix: "Sort stops by offset ascending (each offset between 0 and 1 inclusive).",
  },
  "paint-scale-conflict": {
    tier: 2,
    summary:
      "Within-mark fillPaint/strokePaint cannot combine with a data-mapped fill/color scale channel.",
    fix: "Remove the data-mapped fill/color aesthetic, or remove the paint and keep the scale.",
  },
  // --- tier 2 (data-aware; needs inline data or a DataProfile) -------------
  "unknown-field": {
    tier: 2,
    ...DUAL_ERROR_PROSE["unknown-field"],
  },
  "all-null-column": {
    tier: 2,
    ...DUAL_ERROR_PROSE["all-null-column"],
  },
  "scale-type-mismatch": {
    tier: 2,
    summary: "A configured scale type is incompatible with the mapped field's type.",
    fix: "Change the scale type to match the field (band for categories, time for temporal), or map a compatible field.",
  },
  "channel-type-mismatch": {
    tier: 2,
    ...DUAL_ERROR_PROSE["channel-type-mismatch"],
  },
  "unknown-stat-column": {
    tier: 2,
    ...DUAL_ERROR_PROSE["unknown-stat-column"],
  },
  "manual-fun-required": {
    // Structural grammar (layerStructuralErrors) — opt-in tier-2 only; not plain validate().
    tier: 2,
    ...DUAL_ERROR_PROSE["manual-fun-required"],
  },
  "summary-rolling-window-required": {
    // Structural grammar (layerStructuralErrors) — opt-in tier-2 only; not plain validate().
    tier: 2,
    ...DUAL_ERROR_PROSE["summary-rolling-window-required"],
  },
  "summary-fun-unsupported": {
    // Structural grammar (layerStructuralErrors) — opt-in tier-2 only; not plain validate().
    tier: 2,
    ...DUAL_ERROR_PROSE["summary-fun-unsupported"],
  },
  "invalid-data-profile": {
    tier: 2,
    summary: "The provided DataProfile is malformed.",
    fix: 'Provide { fields: [{ name, type: "quantitative"|"temporal"|"ordinal"|"nominal" }], rowCount? }.',
  },
  "validation-limit": {
    tier: 2,
    summary: "Validation input exceeded a documented limit (rows/bytes/depth/diagnostics).",
    fix: "Validate with a DataProfile instead of huge inline data, or raise the limit via options.limits.",
  },
} as const satisfies Record<string, ErrorCatalogEntry>;

export type SpecErrorCode = keyof typeof ERROR_CATALOG;

/** The stable list of validation error codes (keys of ERROR_CATALOG). */
export const ERROR_CODES = Object.keys(ERROR_CATALOG) as readonly SpecErrorCode[];

/**
 * `$defs` partial — range/rect geom params (ErrorbarParams…PositionParams).
 * Composed by schema-declarations.ts via spread; key insertion order is load-bearing.
 */

import Type from "typebox";
import { POINT_SHAPE_NAME_SCHEMAS } from "./schema-name-schemas.js";

export const ParamsErrorbarPositionDecls = {
  ErrorbarParams: Type.Object(
    {
      width: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          maximum: 1,
          description:
            "Cap width as a fraction of the band step. Must be greater than 0 and at most 1. Default 0.9.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Stroke width in px. Must be greater than 0. Default 1.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Errorbar opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      fun: Type.Optional(
        Type.Union([Type.Literal("mean"), Type.Literal("median"), Type.Literal("sum")], {
          description:
            'STAT SUMMARY ONLY: the center summary of y per x group: "mean" (default), "median", or "sum". With "mean" and no funMin/funMax, the bounds default to mean ± standard error.',
        }),
      ),
      funMin: Type.Optional(
        Type.Ref("SummaryFun", {
          description:
            "STAT SUMMARY ONLY: summary function for the lower bound (ymin). Overrides the mean_se default.",
        }),
      ),
      funMax: Type.Optional(
        Type.Ref("SummaryFun", {
          description:
            "STAT SUMMARY / SUMMARY_BIN: summary function for the upper bound (ymax). Overrides the mean_se default.",
        }),
      ),
      bins: Type.Optional(
        Type.Integer({
          minimum: 1,
          description:
            "STAT SUMMARY_BIN ONLY: number of bins (integer ≥ 1). Default 30 — advisory. Overridden by binwidth.",
        }),
      ),
      binwidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description:
            "STAT SUMMARY_BIN ONLY: bin width in data units (must be greater than 0). Takes precedence over bins.",
        }),
      ),
      boundary: Type.Optional(
        Type.Number({
          description:
            "STAT SUMMARY_BIN ONLY: align a bin EDGE with this x value. Mutually exclusive with center.",
        }),
      ),
      center: Type.Optional(
        Type.Number({
          description:
            "STAT SUMMARY_BIN ONLY: align a bin CENTER with this x value. Mutually exclusive with boundary.",
        }),
      ),
      closed: Type.Optional(
        Type.Union([Type.Literal("right"), Type.Literal("left")], {
          description:
            'STAT SUMMARY_BIN ONLY: which edge of each bin is inclusive: "right" (default) or "left".',
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Parameters for the errorbar geom: styling plus summary / summary_bin functions and summary_bin binning controls.",
    },
  ),

  /** Linerange shares errorbar params (width unused; no caps). */
  LinerangeParams: Type.Ref("ErrorbarParams"),

  PointrangeParams: Type.Object(
    {
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Stem stroke width in px. Must be greater than 0. Default 1.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Opacity for stem and point. Default 1.",
        }),
      ),
      size: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Mid-point radius in px. Default 2.5.",
        }),
      ),
      shape: Type.Optional(
        Type.Union(POINT_SHAPE_NAME_SCHEMAS, {
          description: 'Mid-point shape. Default "circle".',
        }),
      ),
      fun: Type.Optional(
        Type.Union([Type.Literal("mean"), Type.Literal("median"), Type.Literal("sum")], {
          description:
            'STAT SUMMARY ONLY: center summary of y per x group. Default "mean" (mean_se when funMin/funMax omitted).',
        }),
      ),
      funMin: Type.Optional(
        Type.Ref("SummaryFun", {
          description:
            "STAT SUMMARY ONLY: summary function for the lower bound (ymin). Overrides the mean_se default.",
        }),
      ),
      funMax: Type.Optional(
        Type.Ref("SummaryFun", {
          description:
            "STAT SUMMARY ONLY: summary function for the upper bound (ymax). Overrides the mean_se default.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description: "Parameters for geom_pointrange (stem + mid point).",
    },
  ),

  CrossbarParams: Type.Object(
    {
      width: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          maximum: 1,
          description:
            "Box width: band-step fraction (band x) or fraction of continuous resolution (same rule as errorbar caps). Default 0.9.",
        }),
      ),
      fatten: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description:
            "Multiplier for the mid-line linewidth relative to params.linewidth / aes.linewidth. Default 2.5.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Outline and base mid-line stroke width in px. Default 1.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Box and mid-line opacity. Default 1.",
        }),
      ),
      fun: Type.Optional(
        Type.Union([Type.Literal("mean"), Type.Literal("median"), Type.Literal("sum")], {
          description: 'STAT SUMMARY ONLY: center summary. Default "mean".',
        }),
      ),
      funMin: Type.Optional(
        Type.Ref("SummaryFun", {
          description:
            "STAT SUMMARY ONLY: summary function for the lower bound (ymin). Overrides the mean_se default.",
        }),
      ),
      funMax: Type.Optional(
        Type.Ref("SummaryFun", {
          description:
            "STAT SUMMARY ONLY: summary function for the upper bound (ymax). Overrides the mean_se default.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description: "Parameters for geom_crossbar (interval box + mid line).",
    },
  ),

  RectParams: Type.Object(
    {
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Outline stroke width in px when color is set. Must be greater than 0.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Rectangle opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      fillPaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description:
            "Within-mark gradient fill paint (not a data scale). Requires a solid fallback.",
        }),
      ),
      strokePaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description:
            "Within-mark gradient outline paint (not a data scale). Requires a solid fallback.",
        }),
      ),
      glow: Type.Optional(
        Type.Ref("GlowSpec", {
          description: "Bounded within-mark glow treatment (not theme decoration).",
        }),
      ),
    },
    {
      additionalProperties: false,
      description: "Styling parameters for the rect geom (arbitrary xmin/xmax/ymin/ymax regions).",
    },
  ),

  Bin2dParams: Type.Object(
    {
      bins: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Number of bins on each axis. Default 30. Applies equally to x and y in v1.",
        }),
      ),
      binwidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description:
            "Shared bin width in data units for both axes (overrides bins). Prefer when the scale units are meaningful.",
        }),
      ),
      drop: Type.Optional(
        Type.Boolean({
          description: "When true (default), omit zero-count bins from the output.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Cell opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Outline stroke width in px when color is set. Must be greater than 0.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Parameters for geom/stat bin_2d (2D rectangular binning heatmap). fill defaults to after_stat count.",
    },
  ),

  TileParams: Type.Object(
    {
      width: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description:
            "Constant tile width in data units after position transform (band axes: fraction of the band step). Default: resolution of unique x centers (continuous) or 1 (band).",
        }),
      ),
      height: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description:
            "Constant tile height in data units after position transform (band axes: fraction of the band step). Default: resolution of unique y centers (continuous) or 1 (band).",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Outline stroke width in px when color is set. Must be greater than 0.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Tile opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      fillPaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description:
            "Within-mark gradient fill paint (not a data scale). Requires a solid fallback.",
        }),
      ),
      strokePaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description:
            "Within-mark gradient outline paint (not a data scale). Requires a solid fallback.",
        }),
      ),
      glow: Type.Optional(
        Type.Ref("GlowSpec", {
          description: "Bounded within-mark glow treatment (not theme decoration).",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Parameters for the tile geom: center-sized cells (x/y + optional width/height).",
    },
  ),

  RasterParams: Type.Object(
    {
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Raster opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      hjust: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description:
            "Horizontal justification of each cell over its x center (0–1). Default 0.5.",
        }),
      ),
      vjust: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Vertical justification of each cell over its y center (0–1). Default 0.5.",
        }),
      ),
      interpolate: Type.Optional(
        Type.Literal(false, {
          description:
            "Interpolation between cells. Only false (nearest / no interpolation) is supported.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description: "Parameters for the raster geom: equal-cell dense grid (no per-cell stroke).",
    },
  ),

  HexParams: Type.Object(
    {
      bins: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Approximate number of hex bins across the x range. Default 30.",
        }),
      ),
      drop: Type.Optional(
        Type.Boolean({
          description: "When true (default), omit zero-count hexes from the output.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Hex opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          minimum: 0,
          description: "Outline stroke width in px when color is set. Default 0 (no outline).",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Parameters for geom/stat hex (hexagonal 2D binning heatmap). fill defaults to after_stat count.",
    },
  ),

  PositionParams: Type.Object(
    {
      width: Type.Optional(
        Type.Number({
          minimum: 0,
          description:
            "JITTER ONLY: maximum horizontal jitter amount — data units on continuous x, band-step fractions on discrete x. Default 40% of the data resolution.",
        }),
      ),
      height: Type.Optional(
        Type.Number({
          minimum: 0,
          description:
            "JITTER ONLY: maximum vertical jitter amount — data units on continuous y, band-step fractions on discrete y. Default 40% of the data resolution.",
        }),
      ),
      seed: Type.Optional(
        Type.Integer({
          minimum: 0,
          description:
            "JITTER ONLY: RNG seed (a non-negative integer). Default 42. ggts jitter is ALWAYS seeded so renders are reproducible (deliberate divergence from random jitter).",
        }),
      ),
      x: Type.Optional(
        Type.Number({
          description:
            "NUDGE ONLY: horizontal offset — data units on continuous x, band-step fractions on discrete x. Default 0.",
        }),
      ),
      y: Type.Optional(
        Type.Number({
          description:
            "NUDGE ONLY: vertical offset — data units on continuous y, band-step fractions on discrete y. Default 0.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Parameters for the jitter (width, height, seed) and nudge (x, y) position adjustments.",
    },
  ),
};

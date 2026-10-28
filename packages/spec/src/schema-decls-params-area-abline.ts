/**
 * `$defs` partial — area/annotation geom params (AreaParams…AblineLayer).
 * Composed by schema-declarations.ts via spread; key insertion order is load-bearing.
 */

import Type from "typebox";
import { LINETYPE_NAME_SCHEMAS } from "./schema-name-schemas.js";

export const ParamsAreaAblineDecls = {
  AreaParams: Type.Object(
    {
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Area fill opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      fillPaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description:
            "Within-mark gradient fill paint (not a data scale). Requires a solid fallback.",
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
      description: "Styling parameters for the area geom.",
    },
  ),

  RibbonParams: Type.Object(
    {
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Ribbon fill opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description:
            "Outline stroke width in px when an outline is drawn. Must be greater than 0. Default 1.",
        }),
      ),
      outline: Type.Optional(
        Type.Union(
          [
            Type.Literal("both"),
            Type.Literal("upper"),
            Type.Literal("lower"),
            Type.Literal("full"),
          ],
          {
            description:
              'Which edges receive an outline stroke: "both" (default — upper and lower), "upper", "lower", or "full" (closed outline of the band). Strokes appear when aes.color / a color constant is set, or when strokePaint is set.',
          },
        ),
      ),
      orientation: Type.Optional(
        Type.Union([Type.Literal("x"), Type.Literal("y")], {
          description:
            'Running-coordinate orientation: "x" (map x + ymin + ymax) or "y" (map y + xmin + xmax). When omitted, inferred from the complete channel contract; set explicitly if both contracts are mapped.',
        }),
      ),
      lineend: Type.Optional(
        Type.Union([Type.Literal("butt"), Type.Literal("round"), Type.Literal("square")], {
          description: 'SVG stroke-linecap for outlines. Default "butt".',
        }),
      ),
      linejoin: Type.Optional(
        Type.Union([Type.Literal("miter"), Type.Literal("round"), Type.Literal("bevel")], {
          description: 'SVG stroke-linejoin for outlines. Default "round".',
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
      description: "Styling and orientation parameters for the ribbon geom.",
    },
  ),

  RuleIntercept: Type.Union(
    [
      Type.Number(),
      Type.String(),
      Type.Array(Type.Union([Type.Number(), Type.String()]), { minItems: 1 }),
    ],
    {
      description:
        'A fixed intercept (or array of intercepts) in data units. Numbers for linear/log scales; ISO 8601 date strings (e.g. "2026-01-01") for time scales; category strings for band scales.',
    },
  ),

  RuleParams: Type.Object(
    {
      xintercept: Type.Optional(
        Type.Ref("RuleIntercept", {
          description:
            "ANNOTATION FORM ONLY: draw a vertical rule at each of these fixed x positions. Mutually exclusive with mapping aes.x/aes.y on this layer.",
        }),
      ),
      yintercept: Type.Optional(
        Type.Ref("RuleIntercept", {
          description:
            "ANNOTATION FORM ONLY: draw a horizontal rule at each of these fixed y positions. Mutually exclusive with mapping aes.x/aes.y on this layer.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Rule opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Stroke width in px. Must be greater than 0. Default 1.",
        }),
      ),
      linetype: Type.Optional(
        Type.Union(LINETYPE_NAME_SCHEMAS, {
          description:
            'Constant stroke pattern, as in geom_hline(linetype = "dashed"). One of "solid", "dashed", "dotted", "dotdash", "longdash", "twodash". Default "solid". A constant aes.linetype wins over this param.',
        }),
      ),
      strokePaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description:
            "Within-mark gradient stroke paint (not a data scale). Requires a solid fallback.",
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
        "Styling parameters for the rule geom. The annotation form sets xintercept and/or yintercept here; the data-driven form maps aes.x OR aes.y instead (never both forms at once).",
    },
  ),

  HlineParams: Type.Object(
    {
      yintercept: Type.Optional(
        Type.Ref("RuleIntercept", {
          description:
            "ANNOTATION FORM ONLY: draw a horizontal rule at each of these fixed y positions. Mutually exclusive with mapping aes.y on this layer.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Rule opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Stroke width in px. Must be greater than 0. Default 1.",
        }),
      ),
      linetype: Type.Optional(
        Type.Union(LINETYPE_NAME_SCHEMAS, {
          description:
            'Constant stroke pattern, as in geom_hline(linetype = "dashed"). One of "solid", "dashed", "dotted", "dotdash", "longdash", "twodash". Default "solid". A constant aes.linetype wins over this param.',
        }),
      ),
      strokePaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description:
            "Within-mark gradient stroke paint (not a data scale). Requires a solid fallback.",
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
        "Parameters for the hline alias. Annotation form sets yintercept; data-driven form maps aes.y. Canonicalized by normalize to a rule layer.",
    },
  ),

  VlineParams: Type.Object(
    {
      xintercept: Type.Optional(
        Type.Ref("RuleIntercept", {
          description:
            "ANNOTATION FORM ONLY: draw a vertical rule at each of these fixed x positions. Mutually exclusive with mapping aes.x on this layer.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Rule opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Stroke width in px. Must be greater than 0. Default 1.",
        }),
      ),
      linetype: Type.Optional(
        Type.Union(LINETYPE_NAME_SCHEMAS, {
          description:
            'Constant stroke pattern, as in geom_hline(linetype = "dashed"). One of "solid", "dashed", "dotted", "dotdash", "longdash", "twodash". Default "solid". A constant aes.linetype wins over this param.',
        }),
      ),
      strokePaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description:
            "Within-mark gradient stroke paint (not a data scale). Requires a solid fallback.",
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
        "Parameters for the vline alias. Annotation form sets xintercept; data-driven form maps aes.x. Canonicalized by normalize to a rule layer.",
    },
  ),

  SegmentParams: Type.Object(
    {
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Segment opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Stroke width in px. Must be greater than 0. Default 1.",
        }),
      ),
      lineend: Type.Optional(
        Type.Union([Type.Literal("butt"), Type.Literal("round"), Type.Literal("square")], {
          description: 'SVG stroke-linecap for segment ends. Default "butt".',
        }),
      ),
      strokePaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description:
            "Within-mark gradient stroke paint (not a data scale). Requires a solid fallback.",
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
        "Styling parameters for the segment geom (finite line from (x,y) to (xend,yend)).",
    },
  ),

  RugParams: Type.Object(
    {
      sides: Type.Optional(
        Type.String({
          pattern: "^[bltr]+$",
          minLength: 1,
          description:
            'Which panel edges get ticks: any non-empty combination of "b" (bottom), "l" (left), "t" (top), "r" (right). Default "bl". Duplicates are treated as a set. Sides b/t require aes.x; sides l/r require aes.y.',
        }),
      ),
      length: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          maximum: 1,
          description:
            'Tick length as a fraction of the panel size along the tick axis (panel-fraction npc analogue of unit(0.03, "npc")). Default 0.03.',
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Tick opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Stroke width in px. Must be greater than 0. Default 1.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Parameters for geom_rug: panel-edge sides, panel-fraction length, and stroke styling.",
    },
  ),

  SpokeParams: Type.Object(
    {
      angle: Type.Optional(
        Type.Number({
          description:
            "Constant spoke direction in radians when aes.angle is not mapped. 0 = +x, π/2 = +y.",
        }),
      ),
      radius: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description:
            "Constant spoke length in data units when aes.radius is not mapped. Must be greater than 0.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Spoke opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Stroke width in px. Must be greater than 0. Default 1.",
        }),
      ),
      lineend: Type.Optional(
        Type.Union([Type.Literal("butt"), Type.Literal("round"), Type.Literal("square")], {
          description: 'SVG stroke-linecap for spoke ends. Default "butt".',
        }),
      ),
      strokePaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description:
            "Within-mark gradient stroke paint (not a data scale). Requires a solid fallback.",
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
        "Parameters for geom spoke: optional constant angle/radius plus segment-like stroke styling.",
    },
  ),

  AblineParams: Type.Object(
    {
      slope: Type.Optional(
        Type.Number({
          description: "Line slope (rise/run). Default 1 (identity line when intercept is 0).",
        }),
      ),
      intercept: Type.Optional(
        Type.Number({
          description: "Y-intercept in data units. Default 0.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Line opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Stroke width in px. Must be greater than 0. Default 1.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Annotation parameters for geom abline: y = intercept + slope · x, clipped to the panel. Annotation-only in v1 (no data-mapped slope/intercept).",
    },
  ),

  AblineLayer: Type.Object(
    {
      geom: Type.Literal("abline", {
        description:
          "Abline geometry: one infinite reference line y = intercept + slope · x, clipped to the panel. Annotation form: fixed slope/intercept in params; does not inherit plot aes.",
      }),
      stat: Type.Optional(
        Type.Literal("identity", { description: "Abline layers use fixed params as-is." }),
      ),
      position: Type.Optional(
        Type.Literal("identity", { description: "Abline layers use identity positioning." }),
      ),
      render: Type.Optional(Type.Ref("RenderBackend")),
      aes: Type.Optional(Type.Ref("Aes")),
      data: Type.Optional(
        Type.Ref("DataRef", {
          description: "Optional layer-local data. Abline v1 ignores row data (annotation-only).",
        }),
      ),
      params: Type.Optional(Type.Ref("AblineParams")),
      inspect: Type.Optional(
        Type.Literal(false, {
          description:
            "Set false to exclude this layer from inspection: its marks never become tooltip, hover, or keyboard-traversal candidates. For decorative layers (background bands, reference shading) whose marks would otherwise capture the pointer — an area mark contains the pointer everywhere it is painted, so it outranks every point and stroke beneath it. Portable: it travels with the spec, so headless renders and re-imported JSON agree.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "A slope/intercept reference-line layer. Annotation-only: set params.slope and params.intercept.",
    },
  ),
};

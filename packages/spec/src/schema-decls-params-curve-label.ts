/**
 * `$defs` partial — curve/map/text geom params (CurveParams…IdentityOrUniqueStat).
 * Composed by schema-declarations.ts via spread; key insertion order is load-bearing.
 */

import Type from "typebox";

export const ParamsCurveLabelDecls = {
  CurveParams: Type.Object(
    {
      curvature: Type.Optional(
        Type.Number({
          description:
            "Amount of bend away from the straight chord. 0 is a straight line; default 0.5. Positive bows to the right of the start→end direction when angle is 90.",
        }),
      ),
      angle: Type.Optional(
        Type.Number({
          description:
            "Control-point direction relative to the chord, in degrees. default 90 (perpendicular).",
        }),
      ),
      ncp: Type.Optional(
        Type.Integer({
          minimum: 1,
          maximum: 50,
          description:
            "Smoothness density knob. Maps to tessellation sample count = max(8, ncp×8); not multi-control xspline. Default 5.",
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Curve opacity. Must be between 0 and 1 (inclusive). Default 1.",
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
          description: 'SVG stroke-linecap for curve ends. Default "butt".',
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
        "Parameters for geom curve: curvature/angle/ncp plus segment-like stroke styling.",
    },
  ),

  PolygonParams: Type.Object(
    {
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description:
            "Polygon fill/stroke opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description:
            "Outline stroke width in px. Must be greater than 0. Default matches line (1.5).",
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
        "Styling parameters for the polygon geom (closed filled path from (x,y) vertices).",
    },
  ),

  MapParams: Type.Object(
    {
      map: Type.Ref("DataRef", {
        description:
          "Fortified map coordinates ({ values }, { columns }, or { name } against spec.datasets). Must include long+lat or x+y, plus a region id column.",
      }),
      mapId: Type.Optional(
        Type.String({
          minLength: 1,
          description:
            'Join column name in the map data (matched to aes.map_id). Default: "region", then "id".',
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Region fill opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Region outline stroke width in px. Must be greater than 0. Default 1.5.",
        }),
      ),
      fillPaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description: "Within-mark gradient fill paint (not a data scale).",
        }),
      ),
      strokePaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description: "Within-mark gradient stroke paint (not a data scale).",
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
        "Parameters for geom_map: fortified map DataRef plus optional join column and polygon styling.",
    },
  ),

  SfParams: Type.Object(
    {
      geometry: Type.Optional(
        Type.String({
          minLength: 1,
          description:
            'Name of the data column holding GeoJSON Geometry JSON strings. Default "geometry". Already-projected coordinates only.',
        }),
      ),
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Mark opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Stroke width in px for lines/polygon outlines. Must be greater than 0.",
        }),
      ),
      size: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Point radius in px when geometries are Point/MultiPoint.",
        }),
      ),
      fillPaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description: "Within-mark gradient fill paint (polygon family; not a data scale).",
        }),
      ),
      strokePaint: Type.Optional(
        Type.Ref("GradientPaint", {
          description: "Within-mark gradient stroke paint (not a data scale).",
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
        "Parameters for geom_sf: portable GeoJSON Geometry column plus styling. Interior rings are even-odd holes; GeometryCollection expands. Use coord_sf for fixed-aspect maps (CRS reproject deferred).",
    },
  ),

  TextParams: Type.Object(
    {
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Text opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      size: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Font size in px. Must be greater than 0. Default 11.",
        }),
      ),
      anchor: Type.Optional(
        Type.Union([Type.Literal("start"), Type.Literal("middle"), Type.Literal("end")], {
          description:
            'Horizontal text anchor relative to the (x, y) position: "start", "middle" (default), or "end".',
        }),
      ),
      dx: Type.Optional(
        Type.Number({
          description: "Horizontal offset in px applied after positioning. Default 0.",
        }),
      ),
      dy: Type.Optional(
        Type.Number({
          description:
            "Vertical offset in px applied after positioning (positive = down). Default 0.",
        }),
      ),
      checkOverlap: Type.Optional(
        Type.Boolean({
          description:
            "Drop labels that overlap an earlier retained label in the same layer and panel (greedy, draw order). Default false: labels draw exactly where placed. Overlaps emit a text-label-overlap warning naming the layer index and overlapping mark count.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Styling parameters for the text geom (labels draw where placed; set checkOverlap to skip colliding labels).",
    },
  ),

  LabelParams: Type.Object(
    {
      alpha: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description: "Label opacity. Must be between 0 and 1 (inclusive). Default 1.",
        }),
      ),
      size: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Font size in px. Must be greater than 0. Default 11.",
        }),
      ),
      anchor: Type.Optional(
        Type.Union([Type.Literal("start"), Type.Literal("middle"), Type.Literal("end")], {
          description:
            'Horizontal text anchor relative to the (x, y) position: "start", "middle" (default), or "end".',
        }),
      ),
      dx: Type.Optional(
        Type.Number({
          description: "Horizontal offset in px applied after positioning. Default 0.",
        }),
      ),
      dy: Type.Optional(
        Type.Number({
          description:
            "Vertical offset in px applied after positioning (positive = down). Default 0.",
        }),
      ),
      checkOverlap: Type.Optional(
        Type.Boolean({
          description:
            "Drop labels that overlap an earlier retained label in the same layer and panel (greedy, draw order). Default false: labels draw exactly where placed. Overlaps emit a text-label-overlap warning naming the layer index and overlapping mark count.",
        }),
      ),
      padding: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Uniform box padding around the text in px. Default 3.",
        }),
      ),
      radius: Type.Optional(
        Type.Number({
          minimum: 0,
          description: "Corner radius of the background box in px. Default 3.",
        }),
      ),
      linewidth: Type.Optional(
        Type.Number({
          minimum: 0,
          description: "Box outline stroke width in px. Default 0.5.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Styling parameters for the label geom (text with background box; set checkOverlap to skip colliding labels).",
    },
  ),

  // --- rendering backend -------------------------------------------------------

  RenderBackend: Type.Union([Type.Literal("svg"), Type.Literal("canvas"), Type.Literal("auto")], {
    description:
      'Rendering backend for this layer: "svg" (DOM marks — accessible, copyable), "canvas" (fast raster for high mark counts), or "auto" (default — canvas above the mark-count threshold of 2000, with an advisory). Text layers always render as SVG. renderToSVGString ignores this and renders everything as SVG.',
  }),

  // --- positions ------------------------------------------------------------

  StackablePosition: Type.Union(
    [Type.Literal("stack"), Type.Literal("fill"), Type.Literal("dodge"), Type.Literal("identity")],
    {
      description:
        'Position adjustment: "stack" piles grouped values (positive up, negative down), "fill" stacks to proportions of 1, "dodge" places groups side by side, "identity" leaves positions unchanged.',
    },
  ),

  /** Identity-capable layers may also use unique (first-wins aesthetic dedupe). */
  IdentityOrUniqueStat: Type.Union(
    [
      Type.Literal("identity", {
        description: "Draw each data row as-is (no aggregation or row filter).",
      }),
      Type.Literal("unique", {
        description:
          "Drop duplicate rows on the combination of mapped aesthetic fields before drawing; first occurrence wins. Panel-local.",
      }),
    ],
    {
      description:
        'Layer stat: "identity" (default) or "unique" (dedupe mapped aesthetics, first wins).',
    },
  ),

  // --- layers (discriminated by geom) ----------------------------------------
};

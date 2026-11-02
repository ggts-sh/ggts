/**
 * `$defs` partial — text/map layer specs (TextLayer…MapLayer).
 * Composed by schema-declarations.ts via spread; key insertion order is load-bearing.
 */

import Type from "typebox";

export const LayersTextMapDecls = {
  TextLayer: Type.Object(
    {
      geom: Type.Literal("text", {
        description:
          "Text geometry: one label per data row at (x, y). Labels draw exactly where placed unless params.checkOverlap skips colliding ones. Requires x, y, and label channels.",
      }),
      stat: Type.Optional(Type.Ref("IdentityOrUniqueStat")),
      position: Type.Optional(
        Type.Union([Type.Literal("identity"), Type.Literal("nudge")], {
          description:
            'Position adjustment: "identity" (default) or "nudge" (fixed offsets from the anchor — set positionParams.x/y; useful for labels beside marks).',
        }),
      ),
      positionParams: Type.Optional(Type.Ref("PositionParams")),
      render: Type.Optional(Type.Ref("RenderBackend")),
      aes: Type.Optional(Type.Ref("Aes")),
      data: Type.Optional(
        Type.Ref("DataRef", {
          description:
            "Optional layer-local data. When omitted, the layer inherits plot-level data. When present, it may use inline rows, inline columns, or a named dataset (spec.datasets or runtime).",
        }),
      ),
      params: Type.Optional(Type.Ref("TextParams")),
      inspect: Type.Optional(
        Type.Literal(false, {
          description:
            "Set false to exclude this layer from inspection: its marks never become tooltip, hover, or keyboard-traversal candidates. For decorative layers (background bands, reference shading) whose marks would otherwise capture the pointer — an area mark contains the pointer everywhere it is painted, so it outranks every point and stroke beneath it. Portable: it travels with the spec, so headless renders and re-imported JSON agree.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description: "A text-label layer. Requires x, y, and label channels.",
    },
  ),

  LabelLayer: Type.Object(
    {
      geom: Type.Literal("label", {
        description:
          "Label geometry: text with a rounded rectangular background box. Requires x, y, and label channels. Labels draw exactly where placed unless params.checkOverlap skips colliding ones.",
      }),
      stat: Type.Optional(
        Type.Literal("identity", { description: "Label layers draw the data as-is." }),
      ),
      position: Type.Optional(
        Type.Union([Type.Literal("identity"), Type.Literal("nudge")], {
          description:
            'Position adjustment: "identity" (default) or "nudge" (fixed offsets — set positionParams.x/y).',
        }),
      ),
      positionParams: Type.Optional(Type.Ref("PositionParams")),
      render: Type.Optional(Type.Ref("RenderBackend")),
      aes: Type.Optional(Type.Ref("Aes")),
      data: Type.Optional(
        Type.Ref("DataRef", {
          description:
            "Optional layer-local data. When omitted, the layer inherits plot-level data. When present, it may use inline rows, inline columns, or a named dataset (spec.datasets or runtime).",
        }),
      ),
      params: Type.Optional(Type.Ref("LabelParams")),
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
        "A label layer (text + background box). Requires x, y, and label channels. color styles text/outline; fill styles the box.",
    },
  ),

  SegmentLayer: Type.Object(
    {
      geom: Type.Literal("segment", {
        description:
          "Segment geometry: one finite line per data row from (x, y) to (xend, yend). Unlike rule, endpoints are data-mapped and do not span the panel.",
      }),
      stat: Type.Optional(Type.Ref("IdentityOrUniqueStat")),
      position: Type.Optional(
        Type.Literal("identity", { description: "Segment layers use identity positioning." }),
      ),
      render: Type.Optional(Type.Ref("RenderBackend")),
      aes: Type.Optional(Type.Ref("Aes")),
      data: Type.Optional(
        Type.Ref("DataRef", {
          description:
            "Optional layer-local data. When omitted, the layer inherits plot-level data. When present, it may use inline rows, inline columns, or a named dataset (spec.datasets or runtime).",
        }),
      ),
      params: Type.Optional(Type.Ref("SegmentParams")),
      inspect: Type.Optional(
        Type.Literal(false, {
          description:
            "Set false to exclude this layer from inspection: its marks never become tooltip, hover, or keyboard-traversal candidates. For decorative layers (background bands, reference shading) whose marks would otherwise capture the pointer — an area mark contains the pointer everywhere it is painted, so it outranks every point and stroke beneath it. Portable: it travels with the spec, so headless renders and re-imported JSON agree.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description: "A finite segment layer. Requires x, y, xend, and yend channels.",
    },
  ),

  FunctionLayer: Type.Object(
    {
      geom: Type.Literal("function", {
        description:
          "Function geometry: evaluate a named portable function y = f(x) on a grid and draw a path. Requires params.fun; domain from params.xlim, mapped x, or peer layers.",
      }),
      stat: Type.Optional(
        Type.Literal("function", {
          description: "Function layers evaluate a named registry function on a grid.",
        }),
      ),
      position: Type.Optional(
        Type.Literal("identity", { description: "Function layers use identity positioning." }),
      ),
      render: Type.Optional(Type.Ref("RenderBackend")),
      aes: Type.Optional(Type.Ref("Aes")),
      data: Type.Optional(
        Type.Ref("DataRef", {
          description:
            "Optional layer-local data. When omitted, the layer inherits plot-level data. When present, it may use inline rows, inline columns, or a named dataset (spec.datasets or runtime).",
        }),
      ),
      params: Type.Ref("FunctionParams", {
        description: "Function parameters (fun is required).",
      }),
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
        "An analytic function layer. y is computed as { stat: y }; do not map data y. Portable fun names only (no JS closures).",
    },
  ),

  CurveLayer: Type.Object(
    {
      geom: Type.Literal("curve", {
        description:
          "Curve geometry: one curved connector per row from (x, y) to (xend, yend). Tessellated as a quadratic Bezier (curvature/angle/ncp). Requires field-mapped x, y, xend, and yend.",
      }),
      stat: Type.Optional(
        Type.Literal("identity", { description: "Curve layers draw the data as-is." }),
      ),
      position: Type.Optional(
        Type.Literal("identity", { description: "Curve layers use identity positioning." }),
      ),
      render: Type.Optional(Type.Ref("RenderBackend")),
      aes: Type.Optional(Type.Ref("Aes")),
      data: Type.Optional(
        Type.Ref("DataRef", {
          description:
            "Optional layer-local data. When omitted, the layer inherits plot-level data. When present, it may use inline rows, inline columns, or a named dataset (spec.datasets or runtime).",
        }),
      ),
      params: Type.Optional(Type.Ref("CurveParams")),
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
        "A curved-segment layer. Requires x, y, xend, and yend field channels (like geom segment).",
    },
  ),

  PolygonLayer: Type.Object(
    {
      geom: Type.Literal("polygon", {
        description:
          "Polygon geometry: closed filled paths from (x, y) vertices in data/row order within each group. Groups form separate polygons. No x-sort (unlike line/area). Holes/subgroup omitted in v1.",
      }),
      stat: Type.Optional(
        Type.Literal("identity", { description: "Polygon layers draw the data as-is." }),
      ),
      position: Type.Optional(
        Type.Literal("identity", { description: "Polygon layers use identity positioning." }),
      ),
      render: Type.Optional(Type.Ref("RenderBackend")),
      aes: Type.Optional(Type.Ref("Aes")),
      data: Type.Optional(
        Type.Ref("DataRef", {
          description:
            "Optional layer-local data. When omitted, the layer inherits plot-level data. When present, it may use inline rows, inline columns, or a named dataset (spec.datasets or runtime).",
        }),
      ),
      params: Type.Optional(Type.Ref("PolygonParams")),
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
        "A closed polygon layer. Requires x and y channels; vertices connect in data order per group and close implicitly.",
    },
  ),

  MapLayer: Type.Object(
    {
      geom: Type.Literal("map", {
        description:
          "Map geometry: join fortified region borders to value rows via aes.map_id and params.map. Renders closed filled paths per region.",
      }),
      stat: Type.Optional(
        Type.Literal("identity", { description: "Map layers expand joins then draw as-is." }),
      ),
      position: Type.Optional(
        Type.Literal("identity", { description: "Map layers use identity positioning." }),
      ),
      render: Type.Optional(Type.Ref("RenderBackend")),
      aes: Type.Optional(Type.Ref("Aes")),
      data: Type.Optional(
        Type.Ref("DataRef", {
          description:
            "Optional layer-local value data (region ids + fill aesthetics). When omitted, inherits plot data.",
        }),
      ),
      params: Type.Ref("MapParams"),
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
        "A choropleth/map layer. Requires aes.map_id and params.map. Coordinates come from the map data (long/lat or x/y).",
    },
  ),
};

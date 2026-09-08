/**
 * `$defs` partial — facet/coord/root plot schemas (FacetScales…PlotSpec).
 * Composed by schema-declarations.ts via spread; key insertion order is load-bearing.
 */

import Type from "typebox";
import { CURRENT_EDITION } from "./schema-catalog.js";

export const PlotDecls = {
  FacetScales: Type.Union(
    [Type.Literal("fixed"), Type.Literal("free"), Type.Literal("free_x"), Type.Literal("free_y")],
    {
      description:
        'How positional scales behave across facet panels: "fixed" (default — all panels share both scales, trained on the union of panel data), "free" (both positional scales train per panel), "free_x" (only x is per-panel), "free_y" (only y is per-panel). Discrete color/fill assignments are ALWAYS global (one legend), regardless of this setting.',
    },
  ),

  FacetFieldRef: Type.Object(
    {
      field: Type.String({
        description: "Name of the data column that partitions facet panels.",
      }),
      levels: Type.Optional(
        Type.Array(Type.Ref("DomainValue"), {
          minItems: 1,
          description:
            "Closed explicit panel order for this facet field. When set, panels appear in this order (including empty panels for levels absent from data). Values observed in data but omitted from levels are dropped from all panels and diagnosed. Omit for the default ascending sort of observed values.",
        }),
      ),
      labels: Type.Optional(
        Type.Record(Type.String(), Type.String(), {
          description:
            'Display-label map for authored facet values (JSON object). Keys are string forms of the semantic values ("west", "1", "true", "null"); values are human-readable strip/accessibility text. Labels never change panel IDs or semantic facet identity. Omit to use bandKey(value) as the strip text.',
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        'Facet field reference with optional closed order and display labels. Example: {"field": "region", "levels": ["west", "east"], "labels": {"west": "West Coast"}}. Bare strings are NOT valid here — normalize() expands "region" to {"field": "region"}.',
    },
  ),

  FacetStripSpec: Type.Object(
    {
      position: Type.Optional(
        Type.Union(
          [
            Type.Literal("top"),
            Type.Literal("bottom"),
            Type.Literal("left"),
            Type.Literal("right"),
          ],
          {
            description:
              'Where facet strip bands are reserved and drawn: "top" (default), "bottom", "left", or "right". Left/right strips participate in layout measurement rather than overlaying the panel.',
          },
        ),
      ),
      show: Type.Optional(
        Type.Boolean({
          description:
            "Whether to reserve and draw strip bands (default true). Set false when direct labels are authored elsewhere; panel identity and authored display labels remain available to accessibility and interaction consumers.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        'Facet strip chrome: position and visibility. Defaults: position "top", show true. Example: {"position": "left"} or {"show": false}.',
    },
  ),

  FacetSpec: Type.Object(
    {
      wrap: Type.Optional(
        Type.Ref("FacetFieldRef", {
          description:
            "Facet WRAP form: partition rows by this data field's distinct values, one panel per value, wrapped into a grid ncol wide. Mutually exclusive with rows/cols. Optional levels/labels control order and strip text.",
        }),
      ),
      rows: Type.Optional(
        Type.Ref("FacetFieldRef", {
          description:
            "Facet GRID form: the field whose distinct values become grid rows. Combine with cols; mutually exclusive with wrap. Optional levels/labels control order and strip text.",
        }),
      ),
      cols: Type.Optional(
        Type.Ref("FacetFieldRef", {
          description:
            "Facet GRID form: the field whose distinct values become grid columns. Combine with rows; mutually exclusive with wrap. Optional levels/labels control order and strip text.",
        }),
      ),
      ncol: Type.Optional(
        Type.Integer({
          minimum: 1,
          description:
            "WRAP ONLY: number of panel columns (an integer of at least 1). Omit for an automatic near-square layout (ceil(sqrt(panels))).",
        }),
      ),
      scales: Type.Optional(Type.Ref("FacetScales")),
      strip: Type.Optional(Type.Ref("FacetStripSpec")),
    },
    {
      additionalProperties: false,
      description:
        "Facet the plot into small-multiple panels. Wrap form: set `wrap` (+ optional ncol). Grid form: set `rows` and/or `cols`. Panels partition the data BEFORE stats and positions run (each panel computes its own counts, bins, stacks). By default panel values sort ascending and strips sit on top; set field `levels`/`labels` and `strip.position`/`strip.show` for authored order, display text, and strip placement. Null values form their own panel when observed (or when listed in levels).",
    },
  ),

  CoordTransformAxisSpec: Type.Object(
    {
      transform: Type.Union(
        [Type.Literal("identity"), Type.Literal("log10"), Type.Literal("sqrt")],
        {
          description:
            "Post-stat coordinate transform for this axis: identity, base-10 logarithm, or square root.",
        },
      ),
      limits: Type.Optional(
        Type.Array(Type.Number(), {
          minItems: 2,
          maxItems: 2,
          description:
            "Optional coordinate viewport [min, max] in semantic/source units. Exactly two numbers. Unlike scale limits, coordinate limits do not remove rows or recompute statistics.",
        }),
      ),
      reverse: Type.Optional(
        Type.Boolean({
          description:
            "Reverse this coordinate axis after its transform without changing stat inputs or the trained semantic scale domain.",
        }),
      ),
      expand: Type.Optional(
        Type.Boolean({
          description:
            "Whether explicit coordinate limits receive the default 5% transformed-space display expansion (default true). Set false for exact viewport limits.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "One continuous coordinate axis projected after statistics and scale training. Non-identity transforms require a continuous, non-temporal position scale.",
    },
  ),

  CoordCartesianSpec: Type.Object(
    {
      type: Type.Union([Type.Literal("cartesian"), Type.Literal("flip")], {
        description:
          'Coordinate system: "cartesian" (default) or "flip" (swap the axes: x renders vertically, y horizontally — THE mechanism for horizontal bar charts; positions, stacking, dodging, and hit-testing all follow).',
      }),
    },
    {
      additionalProperties: false,
      description:
        'The plot\'s Cartesian coordinate system. {"type": "flip"} turns any vertical composition into its horizontal counterpart.',
    },
  ),

  CoordTransformSpec: Type.Object(
    {
      type: Type.Literal("transform", {
        description: "Project positions after stats/positions and scale training.",
      }),
      x: Type.Optional(Type.Ref("CoordTransformAxisSpec")),
      y: Type.Optional(Type.Ref("CoordTransformAxisSpec")),
      clip: Type.Optional(
        Type.Boolean({
          description:
            "Clip marks to the panel rectangle (default true). Set false only when intentional overflow should remain visible.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "A post-stat Cartesian coordinate transform with independent x/y projectors. It is intentionally distinct from pre-stat scale transforms.",
    },
  ),

  CoordFixedSpec: Type.Object(
    {
      type: Type.Literal("fixed", {
        description: "Cartesian coordinates with a fixed physical data-unit ratio.",
      }),
      ratio: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description:
            "Physical y-unit length divided by physical x-unit length (default 1, equal units).",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "A fixed-aspect Cartesian coordinate system. Layout fits the largest centered data rectangle after chart chrome is allocated.",
    },
  ),

  CoordSfSpec: Type.Object(
    {
      type: Type.Literal("sf", {
        description:
          "Simple-features coordinates for already-projected map data. Fixed-aspect layout; no CRS transform in v1.",
      }),
      ratio: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description:
            "Physical y-unit length divided by physical x-unit length (default 1, equal projected units).",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Fixed-aspect coordinates for portable geom_sf maps. Data must already be projected; CRS reproject / graticules are deferred.",
    },
  ),

  CoordRadialSpec: Type.Object(
    {
      type: Type.Literal("radial", {
        description:
          "Polar/radial coordinates (ggplot2 coord_radial / superseded coord_polar). Maps one axis to angle and the other to radius.",
      }),
      theta: Type.Optional(
        Type.Union([Type.Literal("x"), Type.Literal("y")], {
          description:
            'Which aesthetic maps to angle: "x" (default) or "y". The other aesthetic maps to radius. Pie charts use theta: "y".',
        }),
      ),
      start: Type.Optional(
        Type.Number({
          description:
            "Offset of the starting angle from 12 o'clock, in radians (default 0). Positive angles proceed clockwise when reverse does not flip theta.",
        }),
      ),
      end: Type.Optional(
        Type.Number({
          description:
            "Angle where the plot ends, in radians measured from 12 o'clock. Default is start + 2π (full circle). Use with start for partial polar plots.",
        }),
      ),
      innerRadius: Type.Optional(
        Type.Number({
          minimum: 0,
          maximum: 1,
          description:
            "Size of the inner radius hole as a fraction of the outer radius (0–1, default 0). Values above 0 produce a donut.",
        }),
      ),
      expand: Type.Optional(
        Type.Boolean({
          description:
            "When true (default), add a small expansion so data does not sit on the axes. When false, limits come directly from the scale (typical for pie/coxcomb).",
        }),
      ),
      clip: Type.Optional(
        Type.Boolean({
          description:
            'Clip marks to the panel. ggplot2 coord_radial defaults to clip off; coord_polar defaults to clip on. ggts stores the effective boolean (default false for type "radial").',
        }),
      ),
      reverse: Type.Optional(
        Type.Union(
          [Type.Literal("none"), Type.Literal("theta"), Type.Literal("r"), Type.Literal("thetar")],
          {
            description:
              'Which directions to reverse: "none" (default), "theta", "r", or "thetar" (both). coord_polar(direction = -1) maps to reverse: "theta".',
          },
        ),
      ),
      thetaLimits: Type.Optional(
        Type.Array(Type.Number(), {
          minItems: 2,
          maxItems: 2,
          description:
            "Optional [min, max] limits for the theta (angle) aesthetic in semantic units. Exactly two numbers.",
        }),
      ),
      rLimits: Type.Optional(
        Type.Array(Type.Number(), {
          minItems: 2,
          maxItems: 2,
          description:
            "Optional [min, max] limits for the radius aesthetic in semantic units. Exactly two numbers.",
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "Polar/radial coordinates for pie charts, coxcombs, wind roses, and partial polar scatter. Portable form of ggplot2 coord_radial (coord_polar is a helper alias).",
    },
  ),

  CoordSpec: Type.Union(
    [
      Type.Ref("CoordCartesianSpec"),
      Type.Ref("CoordTransformSpec"),
      Type.Ref("CoordFixedSpec"),
      Type.Ref("CoordSfSpec"),
      Type.Ref("CoordRadialSpec"),
    ],
    {
      description:
        "The plot coordinate system: ordinary Cartesian, flipped Cartesian, post-stat transformed, fixed-aspect, simple-features fixed-aspect, or radial/polar.",
    },
  ),

  PlotSpec: Type.Object(
    {
      $schema: Type.Optional(
        Type.String({
          description: "URL of the ggts spec JSON Schema version this spec targets.",
        }),
      ),
      edition: Type.Optional(
        Type.Integer({
          minimum: 1,
          description: `Defaults edition this spec was authored against (currently ${CURRENT_EDITION}). normalize() stamps the current edition when absent, so a spec keeps ITS edition's default look (theme roles, categorical palette) even after ggts's defaults improve in a later edition. Explicit theme/scale settings always win over edition defaults.`,
        }),
      ),
      data: Type.Optional(
        Type.Ref("DataRef", {
          description: "Default data for all layers.",
        }),
      ),
      datasets: Type.Optional(
        Type.Record(Type.String(), Type.Ref("InlineData"), {
          description: 'Named inline datasets referenced by {"name": ...} data refs.',
        }),
      ),
      aes: Type.Optional(
        Type.Ref("Aes", {
          description: "Plot-level aesthetic mapping, inherited by every layer.",
        }),
      ),
      layers: Type.Array(Type.Ref("LayerSpec"), {
        minItems: 1,
        description:
          "The plot's layers, drawn in array order (first = bottom). At least one layer.",
      }),
      facet: Type.Optional(Type.Ref("FacetSpec")),
      coord: Type.Optional(Type.Ref("CoordSpec")),
      scales: Type.Optional(Type.Ref("Scales")),
      guides: Type.Optional(Type.Ref("GuidesSpec")),
      legend: Type.Optional(Type.Ref("LegendSpec")),
      labs: Type.Optional(Type.Ref("Labs")),
      theme: Type.Optional(
        Type.Union([Type.Ref("ThemeName"), Type.Ref("ThemeSpec")], {
          description:
            "A registered theme name, or a theme object (named base + role overrides). Omit for the default theme.",
        }),
      ),
      width: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Preferred plot width in px (greater than 0). The host may override.",
        }),
      ),
      height: Type.Optional(
        Type.Number({
          exclusiveMinimum: 0,
          description: "Preferred plot height in px (greater than 0). The host may override.",
        }),
      ),
      a11y: Type.Optional(
        Type.Union([Type.Literal("auto"), Type.Literal("force-svg")], {
          description:
            'Accessibility mode: "auto" (default — layers may render to canvas per their `render` hint, paired with an off-screen description block) or "force-svg" (every layer renders as SVG DOM marks — use for assistive-technology-critical charts; canvas layers do not expose per-mark accessibility).',
        }),
      ),
    },
    {
      additionalProperties: false,
      description:
        "A complete ggts plot specification: data + aesthetic mapping + one or more layers, in layered grammar. Strictly JSON (PortableSpec).",
    },
  ),
};

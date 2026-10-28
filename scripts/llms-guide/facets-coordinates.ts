/**
 * Facets-and-coordinates guide section (docs pages + llms surfaces).
 */

export const FACETS_COORDINATES_MD = `# Facets and coordinates

Facets partition rows into panels before panel stats. Coordinates present
trained scales (flip, etc.) without rewriting aesthetic mappings.

## Facet a comparison

\`\`\`svelte fragment
<GGPlot data={cars} aes={{ x: "weight", y: "economy" }}>
  <GeomPoint />
  <FacetWrap field="vehicleClass" ncol={2} />
</GGPlot>
\`\`\`

[facet wrap](/examples/facet/wrap), [free-y](/examples/facet/wrap-free-y).

## Size grid panels by scale length

By default every panel has the same size. In the grid form, \`space\` sizes
panels by the length of their scales, as in \`facet_grid(space = ...)\`:

- \`"free_x"\` makes each column width proportional to its x scale;
- \`"free_y"\` makes each row height proportional to its y scale;
- \`"free"\` does both; \`"fixed"\` (the default) keeps equal sizes.

A band scale's length is its category count, so each category gets the same
width in every column. A continuous scale's length is its expanded range, so
one data unit gets the same width. Use \`space\` with the matching free
\`scales\`. With fixed scales, all panels share one scale and the sizes stay
equal. If a column holds more than one panel, the longest scale in that column
sets its width.

\`\`\`svelte fragment
<GGPlot data={mpg} aes={{ x: "class", y: "hwy" }}>
  <GeomPoint />
  <GeomHline yintercept={23.4} linetype="dashed" />
  <FacetGrid cols="drv" scales="free_x" space="free_x" />
</GGPlot>
\`\`\`

The PortableSpec form is
\`"facet": {"cols": {"field": "drv"}, "scales": "free_x", "space": "free_x"}\`.
The wrap form has no columns or rows to size, so \`space\` on \`facet.wrap\`
fails with [facet-space-without-grid](/guide/errors#facet-space-without-grid).
See the runnable [grid space example](/examples/facet/grid-space).

## Coordinates

Prefer \`coord flip\` for horizontal bars over swapping x/y semantics.
[Horizontal bar](/examples/bar/horizontal).

## Scale transforms versus coordinate transforms

A scale transform changes the values consumed by statistics and positions. A
coordinate transform leaves those computations alone and projects the final
geometry:

\`\`\`ts fragment
// The linear fit consumes log10(exposure).
gg(rows, aes({ x: "exposure", y: "response" }))
  .geomSmooth({ method: "lm" })
  .scaleXLog10();

// The fit consumes exposure; only its rendered geometry is curved.
gg(rows, aes({ x: "exposure", y: "response" }))
  .geomSmooth({ method: "lm" })
  .coordTransform({ x: "log10" });
\`\`\`

The portable JSON form is strict and callback-free:

\`\`\`json complete
{
  "type": "transform",
  "x": {
    "transform": "log10",
    "limits": [1, 1000],
    "reverse": false,
    "expand": false
  },
  "clip": true
}
\`\`\`

Use \`coordTransform\` or its identical ggplot2-style alias
\`coord_transform\`. In Svelte it is a \`<CoordTransform>\` child, which takes
the same options (\`<Coord value={coordTransform({ … })} />\` is the escape
hatch for a coordinate computed elsewhere):

\`\`\`svelte fragment
<GGPlot data={rows} aes={{ x: "exposure", y: "response" }}>
  <GeomPoint />
  <GeomSmooth method="lm" />
  <CoordTransform x="log10" y="sqrt" />
</GGPlot>
\`\`\`

Coordinate limits create a post-stat viewport: they do not censor rows or
recompute a fit. Coordinate inversion runs before scale inversion, so tooltip,
interval, and brush-zoom values remain semantic. Nonlinear lines, smooths,
areas, smooth confidence bands, and segments use bounded adaptive tessellation;
synthetic render vertices never become inspectable data. Set \`clip: false\`
only for intentional panel overflow.

## Preserve physical data-unit ratios

Use \`coordFixed()\` when equal data units must have equal physical lengths. The
layout reserves titles, axes, and responsive guides first, then centers the
largest exact-ratio data rectangle in the remaining allocation. Panel fill,
grids, marks, clipping, axes, and facet strips occupy only that rectangle;
letterbox gutters use the theme paper role by default.

\`\`\`ts fragment
gg(rows, aes({ x: "x", y: "y" }))
  .geomLine()
  .coordFixed({ ratio: 1 });
\`\`\`

\`ratio\` is physical y-unit length divided by physical x-unit length. The
camelCase helper, builder \`.coordFixed()\`, \`coord_fixed\`, \`coordEqual\`, and
\`coord_equal\` all emit the same strict JSON. Free positional facet scales are
rejected with \`coord-fixed-free-scales\`; use fixed facet scales when panels must
share one physical comparison. On an unusually constrained container the ratio
is never stretched: minor furniture is removed, the SVG declares
\`data-gg-layout="degraded"\`, and authors receive one \`coord-fixed-degraded\`
warning. See the runnable [fixed-aspect example](/examples/point/fixed-aspect).

Non-identity coordinate transforms reject band and temporal axes with
\`coord-transform-continuous\` or \`coord-transform-temporal\`. Domains that
cross log10/sqrt boundaries fail with \`coord-transform-domain\` and exact
recovery guidance.
`;

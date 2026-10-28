/**
 * Portable transforms and positions: the second half of the guide.
 */

export const STATISTICS_TRANSFORMS_MD = `## Convenience geoms (jitter, hline, vline)

Name aliases that normalize to existing marks — no new paint paths:

| Sugar | Normalizes to |
|-------|----------------|
| \`jitter\` | \`point\` + \`position: "jitter"\` |
| \`hline\` | \`rule\` (horizontal) |
| \`vline\` | \`rule\` (vertical) |

\`geomJitter\` / \`<GeomJitter>\` accept flat \`width\` / \`height\` / \`seed\` and
assemble them into \`positionParams\` at the builder/component boundary.

\`hline\` / \`vline\` annotation intercepts (\`yintercept\` / \`xintercept\`)
suppress plot-aes inheritance (ggplot2 \`inherit.aes = FALSE\`). Data-driven
forms drop the orthogonal axis so the one-axis rule contract holds.

\`rule\`, \`hline\`, and \`vline\` take a constant \`linetype\` param, as in
\`geom_hline(linetype = "dashed")\`: \`"solid"\` (default), \`"dashed"\`,
\`"dotted"\`, \`"dotdash"\`, \`"longdash"\`, or \`"twodash"\`. A constant
\`aes.linetype\` wins over the param.

\`\`\`svelte fragment
<GeomJitter width={0.2} height={0.2} />
<GeomHline yintercept={0} linetype="dashed" />
<GeomVline xintercept={10} />
\`\`\`

\`\`\`ts fragment
gg(data, aes({ x: "x", y: "y" }))
  .geomJitter({ width: 0.2, height: 0.2 })
  .geomHline({ yintercept: 0, linetype: "dashed" })
  .geomVline({ xintercept: 10 })
  .spec();
\`\`\`

[Jitter sugar](/examples/jitter/basic): overplotted points with position jitter.
[Hline threshold](/examples/hline/threshold) and
[Vline cutoff](/examples/vline/cutoff): annotation intercepts as rule aliases.

## Manual (portable named per-group transforms)

\`stat: "manual"\` (ggplot2 \`stat_manual\`, portable v1) applies a **named**
per-group transform — no JS callbacks (PortableSpec only). Required
\`params.fun\`:

| fun | Behavior |
|-----|----------|
| \`first\` / \`last\` | Keep one source row per aesthetic group |
| \`mean\` / \`median\` / \`min\` / \`max\` / \`sum\` | One synthetic row; x and y aggregated independently |

Surfaces: **point**, **line**, **path**. Missing \`fun\` fails with
\`manual-fun-required\`; unknown names are schema \`invalid-enum-value\`.

\`\`\`svelte fragment
<GeomPoint stat="manual" fun="mean" />
\`\`\`

\`\`\`ts fragment
gg(data, aes({ x: "x", y: "y", color: "g" }))
  .geomPoint({ stat: "manual", fun: "mean" })
  .spec();
\`\`\`

[stat manual mean centroids](/examples/point/stat-manual-mean): identity
scatter under large mean points per series.

## Align (shared continuous-x grid for stack)

\`stat: "align"\` (ggplot2 \`stat_align\`) is for continuous-x \`area\` / \`line\`
when series sample different x values. It unions finite x across groups,
linearly interpolates each series onto that shared grid, and sets y to 0
outside a group's observed x range so \`position: "stack"\` / \`"fill"\` can
compose without jagged seams.

\`\`\`ts fragment
gg(data, aes({ x: "t", y: "v", fill: "series" }))
  .geomArea({ stat: "align", position: "stack" })
  .spec();
\`\`\`

\`\`\`svelte fragment
<GeomArea stat="align" position="stack" />
\`\`\`

Available on **area** and **line** only (not point or shared identity-only
geoms). Outside a group's x span y is 0 (stack-friendly).

Discrete x joins the default grouping interaction (ggplot2 parity), so a
band-x area/line with a discrete series field derives one group per
(category, series) cell — every ribbon degenerates and a
\`group-single-observation\` warning fires. Map \`aes.group\` to the
series field to join categories into ribbons.

Stacked **area** rescues sparse groups on its own: when a group's continuous x
samples skip an interior grid point (a shape that would render as a floating
band chorded over the stack below), the default identity stat auto-applies
this align transform and emits a \`stack-align-applied\` advisory. The rescue
stands down when the x scale may train discrete, or when a group repeats an x
value (identity stacking sums repeats; align keeps the last). Pre-fill the
data to control every cell exactly.

## Connect (named path joins)

\`stat: "connect"\` (ggplot2 \`stat_connect\`) expands successive finite points
into intermediate vertices so stepped joins are real path geometry — not only
a stroke curve flag. \`params.connection\`: \`hv\` (default), \`vh\`, \`mid\`,
\`linear\`. On **path** expansion is in data order; on **line** points are sorted
by x first, and geometry skips a second x-sort so tied-x elbows stay intact.

\`\`\`svelte fragment
<GeomPath stat="connect" connection="hv" />
\`\`\`

\`\`\`ts fragment
gg(data, aes({ x: "x", y: "y" }))
  .geomPath({ stat: "connect", connection: "hv" })
  .spec();
\`\`\`

[Connect hv path](/examples/path/connect-hv): three data points expand to a
horizontal-then-vertical polyline.

## Curve connectors

Curved connectors (ggplot2 \`geom_curve\`): one quadratic Bezier per row from
\`(x,y)\` to \`(xend,yend)\`, tessellated in **panel px** so curvature is not
aspect-skewed. Params: \`curvature\` (default 0.5), \`angle\` (degrees, default
90), \`ncp\` (control-point density). Same required channels as segment;
\`lineend\` maps to SVG stroke-linecap (default butt).

\`\`\`svelte fragment
<GeomCurve curvature={0.4} lineend="round" />
\`\`\`

\`\`\`ts fragment
gg(data, aes({ x: "x", y: "y", xend: "xend", yend: "yend" }))
  .geomCurve({ curvature: 0.5, angle: 90, ncp: 5 })
  .spec();
\`\`\`

Intentional subset: quadratic approximation, not full grid xspline.
[Curve connectors](/examples/curve/connectors): Darwin maize pairs as arcs.

## Spoke (origin + angle + radius)

\`geom: "spoke"\` (ggplot2 \`geom_spoke\`) draws one finite segment per row from
\`(x, y)\` in direction \`angle\` (radians; 0 = +x, π/2 = +y) with length
\`radius\` in **data units**. Endpoints are
\`xend = x + radius·cos(angle)\`, \`yend = y + radius·sin(angle)\`, then the same
position transform as x/y. Tips train domains; paint reuses segment strokes.
\`angle\` and \`radius\` come from aes and/or constant \`params\`. Continuous x
and y required.

\`\`\`svelte fragment
<GeomSpoke />
\`\`\`

\`\`\`ts fragment
gg(data, aes({ x: "x", y: "y", angle: "theta", radius: "r" }))
  .geomSpoke({ linewidth: 1.5, lineend: "round" })
  .spec();
// constants: .geomSpoke({ angle: 0, radius: 1 })
\`\`\`

[Spoke vector field](/examples/spoke/vector-field): synthetic 5×5 field with
mapped angle and radius.

## Map (fortified choropleth)

\`geom: "map"\` (ggplot2 \`geom_map\`) joins a **fortified map table** to value
rows. Map coordinates come from \`long\`+\`lat\` or \`x\`+\`y\`; the join key is
\`aes.map_id\` on the value table matched to \`params.mapId\` on the map
(default \`"region"\`, then \`"id"\`). Optional map \`group\` splits multipoly
rings. Missing regions drop with a \`map-region-missing\` warning.

\`\`\`svelte fragment
<GeomMap map={{ values: fortified }} linewidth={1.2} />
\`\`\`

\`\`\`ts fragment
gg(rates, aes({ map_id: "region", fill: "rate" }))
  .geomMap({ map: { values: fortified }, mapId: "region" })
  .spec();
\`\`\`

Intentional subset: no network map fetches, no sf/CRS, no public
\`geom_polygon\` (map ships the closed-path renderer only).
[Map choropleth](/examples/map/choropleth): three toy regions filled by rate.

## Positions

Stack sums, dodge side-by-side groups, fill normalizes each stack to one, jitter
separates overlaps with a deterministic seed. [Bar examples](/examples?category=bar).
`;

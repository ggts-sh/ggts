# React example hosts

The gallery shows a React tab only when `examples/<id>/Example.tsx` exists.
That file is the proof that the example runs as a React host. A generic
`GGPlot spec={normalize(chart.json)}` stub is not enough.

Regenerate with `bun run manifest:gen`.

## Verified (11)

- `bar/horizontal` — Category totals, flipped so labels read across
- `col/basic` — Counts across ordered chest sizes
- `histogram/basic` — Histogram of a hundred experimental runs
- `hline/threshold` — One horizontal threshold
- `interaction/brush-zoom` — Interval selection and zoom
- `interaction/legend-filter` — Filter series from the legend
- `interaction/linked-views` — Link plots, controls, and a table
- `interaction/tooltip` — Inspect and pin data
- `jitter/basic` — Menu calories, spread so items do not stack
- `point/scatter-color` — Two measures coloured by region
- `smooth/loess-scatter` — Cocoa percent against bar rating

## Remaining (83)

Write and check `Example.tsx` before the React tab can appear.

- `area/basic` — Survivors from a cohort of one thousand
- `area/stacked` — Stacked deaths by cause over time
- `bar/dodged` — US beer production by package type
- `bar/proportions` — Parts of a whole within each group
- `bar/stacked` — Stacked counts inside each bag
- `bin2d/basic` — Two-dimensional bins for a dense cloud
- `blank/axes-only` — Axes without marks
- `blank/domain-expand` — Expanded domain with no marks
- `boxplot/by-category` — Boxplots for five runs of the same experiment
- `boxplot/violin` — Violin plots for the same five runs
- `col/long-labels` — Long category labels at a narrow width
- `col/mixed-outlier-labels` — One long label among short ones
- `col/theme-linedraw` — Linedraw theme on chest-size columns
- `col/value-labels` — Columns with the rate printed on each bar
- `color/binned` — How many items you can tell apart at once
- `contour/basic` — Contours of height on a grid
- `crossbar/boxes` — Interval boxes with mid line
- `curve/connectors` — Paired points joined by a curve
- `density/kde-2d` — 2D density isolines
- `density/kde-2d-filled` — Filled 2D density bands
- `density/overlay` — Two densities on one axis
- `dotplot/histodot` — One dot per measurement, stacked in bins
- `errorbar/caps` — Capped error bars
- `errorbar/mean-se` — Mean and standard error by group
- `errorbar/summary-bin` — Mean and standard error in each x class
- `facet/ordered-side-strips` — Facets with ordered side strips
- `facet/wrap` — One panel per parent–child pair type
- `facet/wrap-free-y` — Facets with free y scales
- `freqpoly/basic` — Frequency polygon through bin centres
- `hex/basic` — Hex bins for a dense cloud
- `interaction/facet-intervals` — One interval, applied in every panel
- `interaction/legend-focus` — Focus a legend group without changing the data
- `jitter/spread` — Jittered points by group
- `label/basic` — Boxed labels
- `line/ecdf` — Empirical distribution of event sizes
- `line/function` — Observed counts against a fitted curve
- `line/labor-cost-of-wheat` — Weeks of work for a quarter of wheat
- `line/multi-series` — Wheat price and a mechanic's weekly wage
- `line/time-axis` — Years inferred from raw four-digit strings
- `linerange/stems` — Bare vertical stems
- `map/choropleth` — Snow's outbreak by nearest pump
- `path/connect-hv` — Minard's retreat thermometer
- `path/ellipse-rings` — Confidence ellipses around groups
- `path/trajectory` — Napoleon's march on Moscow, by Minard
- `point/abline-identity` — Points against the identity line
- `point/count` — Overlapping points sized by how many share a cell
- `point/fixed-aspect` — Equal data units on both axes
- `point/gradient-continuous` — Many years folded onto one seasonal axis
- `point/hue-discrete` — Scatter coloured by discrete group
- `point/jitter` — Calories by restaurant, with jitter
- `point/layer-data-bands` — What the wars did to the national debt
- `point/log-scale` — Cholera, crowding and water in London, 1849
- `point/quantile-lines` — Flavor against aroma in cupping scores
- `point/stat-manual-mean` — Raw points with a manual mean per group
- `point/stat-unique` — Collapse duplicate coordinates to unique marks
- `point/steps-binned` — Cholera against height above the Thames
- `point/void-chrome` — A sparkline without axes or grid
- `pointrange/midpoints` — Stem plus mid point
- `polygon/regions` — Which pump was nearest
- `qq/cloud` — Sparse Q–Q cloud
- `qq/normal` — Sample quantiles against the normal
- `qq_line/match` — Q–Q reference line
- `raster/grid` — Where chocolate reviews cluster
- `rect/regions` — Background rectangles for eras
- `ribbon/bounds` — A ribbon for year-to-year range
- `ribbon/paint` — A ribbon with gradient fill, stroke and glow
- `rug/ticks` — Bottom-edge rug ticks
- `rule/annotation` — A crosshair of two fixed intercepts
- `rule/data-driven` — A rug of every cupping score
- `segment/annotations` — Segments from start to end of each pair
- `sf/basic` — Simple features as filled polygons
- `sf/boxed-labels` — Pump names on measured boxes
- `sf/geometry-collection` — One feature with two separate polygons
- `sf/holes` — Polygons with holes
- `sf/labels` — Snow's pumps, named in place
- `showcase/kyoto-sakura` — Kyoto cherry blossoms, 812–2026
- `spoke/rays` — Eight rays from one origin
- `spoke/vector-field` — Direction and length from each point
- `step/ecdf` — Step ECDF of paired differences
- `step/stairs` — Thick staircase
- `text/labels` — Bare text labels
- `tile/heatmap` — Cholera in England and Wales, 1849
- `vline/cutoff` — One vertical cutoff

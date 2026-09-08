# Grammar and chart recipes

Read this before choosing geoms, scales, themes, or a chart recipe.

## Which geom for which data

| x type           | y type                                | extra              | recommend                                                    |
| ---------------- | ------------------------------------- | ------------------ | ------------------------------------------------------------ |
| quantitative     | quantitative                          | ≤ ~2k rows         | `point` (+ `smooth` layer for trend)                         |
| quantitative     | quantitative                          | many rows          | `point` with `"render": "canvas"`, or `hex`/`bin_2d` density |
| temporal         | quantitative                          | —                  | `line` (multi-series: map `color` to the series field)       |
| nominal/ordinal  | quantitative (pre-aggregated)         | —                  | `col`; many/long labels → add a `flip` coord                 |
| nominal/ordinal  | (none — count rows)                   | —                  | `bar` (count stat; do NOT map y)                             |
| quantitative     | (none — distribution)                 | —                  | `histogram` (or `density` for smooth overlay)                |
| nominal          | quantitative (distribution per group) | —                  | `boxplot` (or `violin` for shape)                            |
| nominal          | nominal                               | —                  | `point` + `"position": "jitter"`, or counts via `count`      |
| quantitative     | quantitative                          | uncertainty bounds | `errorbar` (map ymin/ymax) or `smooth` (se ribbon)           |
| any of the above | + one more nominal field              | few values         | same geom + facet wrap on that field                         |

Only the everyday geoms appear above. All 49 geoms (violin, hex, contour, qq,
step, segment, sf/maps, text/label annotation, …), all 28 stats with their
computed columns, and the position rules live in
[references/geoms-and-stats.md](geoms-and-stats.md) — read it
whenever the user wants a geom, stat, or annotation not shown here.

Two rules worth keeping in working memory:

- **Positions are scoped per geom** (a disallowed position is a schema error):
  stack/fill only on bar, col, histogram, area; dodge on those plus boxplot
  and violin; jitter on point, count, jitter; nudge on point, count, text,
  label; identity everywhere.
- **A stat that computes y forbids mapping `aes.y` to a field**
  (bar/histogram/density/…) — the `computed-y-mapped` error. Read stat outputs
  with `{"stat": "count"}` aes.

## Scales, palettes, themes

- x/y families: `{"type": "linear"|"binned"|"time"|"band"}` with
  `"transform": "identity"|"log10"|"sqrt"`, `domain`/`limits`,
  `oob: "censor"|"squish"`, `expand`, `nice`, breaks, `reverse`. Authored
  `type:"log"` canonicalizes to linear+log10. Scale transforms run before
  stats and positions; coord transforms run after stats.
- color/fill families: `ordinal`, `sequential`, `binned`, `manual`,
  `identity`. 107 named schemes — 47 categorical (`observable10`, `colorblind`,
  `Dark2`, Crameri `batlowS`…) and 60 sequential/diverging (`viridis`, `magma`,
  `Blues`, `RdBu`, Crameri `batlow`, cyclic `romaO`…).
  Size/linewidth/alpha and shape/linetype have their own scale families.
- Three equivalent skins:
  JSON `"scales": {"x": {"type": "linear", "transform": "log10"}}` ≡ helper
  functions `scaleXLog10()` / `scale_x_log10()` (binding-identical camelCase,
  snake_case, and Colour spellings, from `@ggts-sh/spec`) ≡ components
  `<ScaleXLog10/>`. The `gg()` builder chains the same names:
  `gg(rows, aes({ x: "flipper", y: "mass" })).geomPoint({ alpha: 0.7 }).scaleXLog10().spec()`.
- Temporal: ISO dates/date-times, four-digit-year strings, year-months, and
  year-quarters infer time automatically. Ambiguous ordered dates need
  `"parse": "dmy"` or `"mdy"`; force `{"type": "band"}` for year-like
  identifiers; never preprocess dates into indexes. Spec-driven time scales
  also need `installTemporal()` or `registerAll()` — see Registration.
- Themes: 32 names (`default`, `light`, `dark`, `minimal`, `ggplot2`,
  `classic`, `bw`, `hrbr`, `few`, `clean`, `fivethirtyeight`, `economist`,
  `tufte`, `linedraw`, `void`, `stata`, `stata_s1color`, `solarized`,
  `solarizeddark`, `economist_white`, `solarized_2`, `solarized_2dark`,
  `wsj`, `hc`, `hcdark`, `pander`, `base`, `igray`, `map`, `solid`, plus
  `grey`/`gray` aliasing `ggplot2`) as `<ThemeTufte/>`-style children or
  `"theme": "tufte"` in JSON. Looks, shells, and role overrides:
  [references/themes.md](themes.md).

Full option surfaces — every scale option, the `Scale*` component matrix, all
scheme tables, the whole temporal/parser system:
[references/scales-and-palettes.md](scales-and-palettes.md).
Theme roster and shells:
[references/themes.md](themes.md). Coords, facets, guides, legend
order, and `Labs`:
[references/composition-surfaces.md](composition-surfaces.md).

## Recipes (spec JSON — the everyday twelve)

All specs assume inline `"data": {"values": [...]}` or a named dataset.

1. **Scatter** — `{"layers":[{"geom":"point","aes":{"x":{"field":"displ"},"y":{"field":"hwy"}}}]}`; color by category: add `"color":{"field":"class"}`.
2. **Scatter + trend** — `{"aes":{"x":{"field":"x"},"y":{"field":"y"}},"layers":[{"geom":"point"},{"geom":"smooth","params":{"method":"loess"}}]}` (plot-level aes inherits into both layers).
3. **Line (time series)** — `{"layers":[{"geom":"line","aes":{"x":{"field":"date"},"y":{"field":"value"}}}]}`; multi-series: map `"color":{"field":"series"}`.
4. **Column chart (pre-computed heights)** — `{"layers":[{"geom":"col","aes":{"x":{"field":"category"},"y":{"field":"amount"}}}]}`
5. **Bar chart (count rows)** — `{"layers":[{"geom":"bar","aes":{"x":{"field":"category"}}}]}` — never map y on bar.
6. **Horizontal bars** — recipe 4 or 5 + `"coord":{"type":"flip"}`.
7. **Stacked / dodged / proportion bars** — recipe 5 + `"fill":{"field":"subgroup"}` in aes (stack is the default); `"position":"dodge"` for side-by-side, `"position":"fill"` for 100% stacked.
8. **Histogram** — `{"layers":[{"geom":"histogram","aes":{"x":{"field":"measure"}},"params":{"bins":30}}]}` (or `"binwidth"`; never both `center` and `boundary`).
9. **Boxplot by category** — `{"layers":[{"geom":"boxplot","aes":{"x":{"field":"group"},"y":{"field":"value"}}}]}` (x must be discrete).
10. **Facets (small multiples)** — any recipe + `"facet":{"wrap":{"field":"panel"},"ncol":3}` (add `"scales":"free_y"` for per-panel y).
11. **Reference line annotation** — add layer `{"geom":"rule","params":{"yintercept":0}}`.
12. **Finishing** — `"labs":{"title":...,"x":...,"y":...}`, `"width"`/`"height"` in px, `"theme":"minimal"`.

The same charts as Svelte children, twice over:

```svelte fragment
<GGPlot data={sales} aes={{ x: "quarter", y: "amount", fill: "region" }}>
  <GeomCol position="dodge" />
</GGPlot>
```

```svelte fragment
<GGPlot data={measurements} aes={{ x: "value" }}>
  <GeomHistogram bins={20} />
  <FacetWrap field="site" ncol={2} />
</GGPlot>
```

Long-tail recipes — errorbar, value labels, canvas big-scatter, log axis,
violin, tile heatmap, hex density, ECDF step, ribbon, flipped boxplot,
per-layer aes override, sf/map — each as validated JSON plus a Svelte twin:
[references/recipes.md](recipes.md).

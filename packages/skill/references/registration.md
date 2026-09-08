# Registration reference

## Registration (call these)

The `@ggts-sh/core` barrel is side-effect-free. A missing opt-in throws
`not registered in this build` and names the fix. **Default for agents:**
call `registerAll()` once at startup for every spec-driven, `layers`,
`<GGPlot spec>`, `runPipeline`, or `renderToSVGString` path. Do not invent
a lean register list unless the user asked for a small bundle.

`ggts render` already registers the full grammar. Svelte **children**
self-register only the piece they are.

| Surface                                                             | What is already registered                                                                                                    | What you must still call                                                                                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `<Geom*>` child                                                     | that geom + its **default** stat                                                                                              | `register<Family>()` for a `stat="…"` override (from `@ggts-sh/svelte`) — e.g. `<GeomErrorbar stat="summary" />` → `registerSummary()` |
| `<ScaleXDate>` / `<ScaleYDatetime>` / other Temporal scale children | `installTemporal()`                                                                                                           | nothing                                                                                                                                |
| `<GGPlot>` construction                                             | `registerBasic()` + `installCandidates()` (identity geoms/stats, every color/style kind, band-axis planner, host hit-testing) | `registerAll()` for specialty geoms/stats; `installTemporal()` for spec/`layers` temporal charts that have no Temporal child           |
| `@ggts-sh/core/render` import                                       | same basic tier as `registerBasic()`                                                                                          | specialty families + Temporal                                                                                                          |
| `@ggts-sh/core/temporal` import                                     | Temporal polyfill + guides                                                                                                    | the rest of the grammar                                                                                                                |
| CLI `ggts render`                                                   | full grammar                                                                                                                  | nothing                                                                                                                                |

**Spec-driven Temporal:** ISO strings with no explicit temporal options keep
the lean UTC path. Charts driven through `spec` or `layers` have no Temporal
child. Call `installTemporal()` (from `@ggts-sh/svelte` or `@ggts-sh/core`)
or `registerAll()` when those charts set `type: "time"`, a named parser,
timezone, date interval, or full Temporal guide planning.

**Lean headless** (`@ggts-sh/core/headless` + `@ggts-sh/core/headless/register`)
is opt-in per family. One forgotten call fails at render:

- Basic geoms: `registerBasicPoints()`, `registerBasicLines()`,
  `registerBasicAreas()`, `registerBasicBars()`, `registerBasicRects()`,
  `registerBasicGlyphs()`, `registerBasicSegments()`.
- Specialty geoms/stats (same names from `@ggts-sh/core` /
  `@ggts-sh/svelte`): `registerAbline()`, `registerAlign()`, `registerBin()`,
  `registerBin2d()`, `registerBoxplot()`, `registerConnect()`,
  `registerContour()`, `registerCrossbar()`, `registerCurve()`,
  `registerDensity()`, `registerDensity2d()`, `registerDensity2dFilled()`,
  `registerDotplot()`, `registerEcdf()`, `registerEllipse()`,
  `registerErrorbar()`, `registerFunction()`, `registerHex()`,
  `registerLinerange()`, `registerManual()`, `registerMap()`,
  `registerPointrange()`, `registerPolygon()`, `registerQq()`,
  `registerQqLine()`, `registerQuantile()`, `registerRaster()`,
  `registerRug()`, `registerSf()`, `registerSfLabel()`, `registerSfText()`,
  `registerSmooth()`, `registerSpoke()`, `registerSummary()`,
  `registerSummaryBin()`, `registerSummaryRolling()`, `registerTile()`,
  `registerUnique()`, `registerViolin()`.
- Color: `registerDefaultOrdinalColor()` for the built-in palette or an
  explicit `range`. A named **categorical** scheme (`observable10`,
  `colorblind`, `Dark2`, …) needs `registerOrdinalColor()`. A named
  **sequential or diverging** scheme (`viridis`, `magma`, `Blues`, `RdBu`,
  Crameri `batlow`, cyclic `romaO`, …) needs `registerSequentialColor()`
  — a sequential name with no `type` infers sequential, so
  `registerOrdinalColor()` is not enough. Cyclic `*O` names are sequential
  only. Explicit `type: "ordinal"` (including discrete sampling of a
  non-cyclic sequential name) still needs `registerOrdinalColor()`. Other kinds:
  `registerBinnedColor()`, `registerManualColor()`,
  `registerIdentityColor()`.
- Style: `registerNumericStyle()` (size / linewidth / alpha),
  `registerFiniteStyle()` (shape / linetype).
- Band axes: `registerBandGuide()` for categorical x/y.
- Legends: `registerDiscreteLegend()` / `registerContinuousLegend()` (the
  matching color register also pulls these).
- Named themes: `@ggts-sh/core/headless` resolves only `default` and `void`.
  `dark`, `minimal`, and the rest need `@ggts-sh/core` or
  `@ggts-sh/core/render` — not a `register*()` call.

`registerAll()` covers every stat frame, every geom batch, every color kind
(with catalogs), every style kind, the band-axis planner, Temporal, and
interaction candidates. `registerBasic()` covers identity charts only; it
does not install Temporal or specialty geoms/stats.

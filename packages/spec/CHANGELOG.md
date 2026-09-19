# @ggts-sh/spec

## 0.43.1

No changes in this release.

## 0.43.0

### Minor Changes

- b68b75c: Share interaction behavior between React and Svelte, render React charts during SSR, and qualify both adapters as installed packages. Add typed React grammar children and complete framework examples.

  Add `ggts check` and `ggts render`, move teaching datasets to `@ggts-sh/core/data` with the Svelte compatibility export, and document the shared agent sandbox workflow in one skill package.

  Rename all seven packages from `@ggsvelte/*` to `@ggts-sh/*`, rename the Svelte migration executable to `ggts-codemod`, and serve documentation at `https://ggts.sh`. Existing old-scope installations remain available.

  Migration: https://ggts.sh/guide/upgrading#0-42-to-0-43

## 0.42.0

## 0.41.0

## 0.40.0

### Minor Changes

- d798f17: Add Crameri v8.0.1 categorical `*S` palettes and cyclic `*O` ramps. Cyclic schemes need an explicit domain period and wrap out-of-bounds.

  Migration: none — additive

## 0.39.0

## 0.38.2

## 0.38.1

## 0.38.0

### Minor Changes

- eded7a2: Export `temporalGuideTypeMismatchError` so render and validate share one temporal-guide type check.

  Migration: none — additive

### Patch Changes

- b3280eb: Reject temporal break and label options on an explicit band scale during render, matching validate().

## 0.37.1

## 0.37.0

## 0.36.0

### Minor Changes

- fa6f795: <!-- markdownlint-disable MD041 -->

  # Drop Tableau gradient ramps (`tableau_seq_*` / `tableau_div_*`)

  Remove all 30 ggthemes `tableau_gradient_pal` ordered-sequential and
  ordered-diverging ramps from the named scheme registry, scale engine, docs
  ramps index, and agent skill inventory.

  Migration: <https://ggsvelte.sh/guide/scales-guides>

  If you set `scheme: "tableau_seq_*"` or `scheme: "tableau_div_*"`, switch to
  another sequential ramp (`viridis`, ColorBrewer, Crameri `batlow`/`vik`, …)
  or pass an explicit `range`. Categorical Tableau schemes (`tableau10`,
  `tableau20`, `tableau_colorblind`, …) are unchanged.

## 0.35.0

### Minor Changes

- 5dea633: # Add Crameri Scientific colour maps (continuous suite)

  Ship Fabio Crameri’s Scientific colour maps v8.0.1 as named sequential schemes
  (`batlow`, `vik`, `oleron`, … — 35 continuous maps). Use them like any other
  ramp:

  ```ts
  scaleFillContinuous({ scheme: "batlow" });
  ```

  ```svelte
  <ScaleFillContinuous scheme="batlow" />
  ```

  Migration: none — additive. Cyclic (`*O`) and categorical (`*S`) maps are not
  included yet.

## 0.34.4

### Patch Changes

- 8e07451: Fix y-axis title placement: position relative to the panel grid (`gridLeft - titleOffset`) instead of a hardcoded SVG `x=12`, so the title tracks the left margin and clears wide tick labels.

## 0.34.3

### Patch Changes

- df6cb6a: Fix position-fill tooltips that printed absurd percentages (e.g. "87300%") by publishing post-position proportions as candidate y values, and emit a `percent-labels-out-of-range` advisory when scale labels are percent formats on non-proportion domains.

## 0.34.2

### Patch Changes

- b1e675b: Drop Minard ring-anchor / false linked-selection guidance; teach independent dual panels when series cardinalities differ.

  Migration: none — skill reference only.

## 0.34.1

### Patch Changes

- f93cc00: Document Minard-class ring-anchor points in multi-layer hit hygiene guidance.

  Migration: none — skill reference only.

## 0.34.0

## 0.33.0

## 0.32.1

## 0.32.0

### Minor Changes

- 9f9fafd: Detect year+month/12 linear coordinates as a lint advisory

  `lintSpec` and `ggsvelte-render` (stderr, source `spec-lint`) emit
  `fractional-calendar-years` when a position channel holds year-like numbers
  with month fractions on a linear scale — the pitfall that labels axes and
  Inspect pins as decimals like 1855.9. Prefer ISO month/date strings and a
  time scale. Theme specimens for the Crimean stacked area now use that encoding.

  Migration: none — additive

## 0.31.2

## 0.31.1

## 0.31.0

### Minor Changes

- 890a462: <!-- markdownlint-disable MD041 -->

  feat: coord_radial / coord_polar polar coordinates

  Port ggplot2 `coord_radial` (and the superseded `coord_polar` alias) for pie charts, coxcombs, and polar scatter.

  - PortableSpec `{ type: "radial", theta?, start?, end?, innerRadius?, expand?, clip?, reverse?, thetaLimits?, rLimits? }`
  - Helpers `coordRadial` / `coord_radial` and `coordPolar` / `coord_polar` (polar maps to radial with clip on)
  - Builder `.coordRadial()` / `.coordPolar()` and Svelte `<CoordRadial>` / `<CoordPolar>`
  - Core joint polar projector: points, filled sector paths from rects/cols/bars, path/segment tessellation
  - Square full-circle data rectangle; clip defaults off for radial and on for the polar alias

  Migration: none — additive. Prefer `coord_radial` for new work; `coord_polar` remains for ggplot2 spelling parity.

- 493e941: Add experimental `COORD_REFERENCE` / `coordReferenceList()` catalog for Coord* docs pages.

  Migration: none — additive

## 0.30.2

## 0.30.1

## 0.30.0

### Minor Changes

- 70971d9: <!-- markdownlint-disable MD041 -->

  feat: accept `inspect` on builder layers and geom sugar

  The schema and `normalize` have always admitted `inspect: false` (#1068)
  and the runtime honors it, but the builder's `LayerInput` types and
  `layerFrom` had no key for it — so builder-form specs (gallery examples,
  agent-generated charts) could not opt decorative layers out of inspection
  without dropping to raw spec objects. `geomRule({ inspect: false })`,
  `.layer({ geom, inspect: false, … })`, and every other geom sugar now
  carry it into the spec.

  Migration: none — additive

- 796cb50: <!-- markdownlint-disable MD041 -->

  feat: circle-open point shape (unfilled ring)

  Add `"circle-open"` to the point shape registry (ggplot2 shape 1): an
  unfilled ring stroked in the mark's color channel, stroke width
  max(1, size/3). Available as a scalar `params.shape`, as a shape-scale
  range value, and through the shared `pointShapeGeometry` table, so SVG,
  canvas, and both legend renderers draw it consistently. Interaction hit-
  testing treats it as a circle of the same size.

  Appended to `POINT_SHAPE_NAMES` (not inserted), so default discrete shape
  assignments for domains of ≤ 6 levels are unchanged; a 7th level now assigns
  circle-open instead of throwing/cycling one level earlier.

  Migration: none — additive

- 796cb50: <!-- markdownlint-disable MD041 -->

  feat: stat_summary_rolling centered rolling-window summaries

  Add `stat: "summary_rolling"` on line and point layers: one output row per
  (group, unique x), summarizing y over the centered window
  |x − center| ≤ params.window/2. `params.window` (x data units, > 0) is
  required — the spec validator raises `summary-rolling-window-required` with a
  named fix and the core stat throws as the pipeline backstop. `params.fun`
  defaults to mean; pass "median" for a running median line. Partial windows
  at the series ends are kept (divergence from zoo's default NA padding), so a
  running line reaches both ends of the data. Windows never cross groups.

  Component-form registration follows the #1420 contract: a `GeomLine` /
  `GeomPoint` shell self-registers only its default stat, so a
  `stat="summary_rolling"` override needs one `registerSummaryRolling()` call
  at app startup (exported from `@ggsvelte/svelte` / `@ggsvelte/core`); spec-
  driven surfaces call `registerAll()` as before. Missing registration fails
  loudly with the register hint.

  Migration: none — additive

### Patch Changes

- 5249477: # Speed lean column parse, grouping, and canvas mark paint

  Migration: none — same scene geometry, group ids, and portable cell values for non-Date columns (still snapshot-isolated from caller mutation).

  Cut per-mount cost on competitive multi-series / scatter paths: lean `parsed()` no longer double-coerces nominal columns; pure number and pure non-ISO string columns take monomorphic fast paths; `isoEpochMs` rejects short labels before the regex; group id materialization avoids `Array.from` on 30k typed arrays; explicit `aes.group` skips unused discreteness probes; builder column snapshots use `slice` and share non-Date portable arrays; canvas points bucket interleaved categorical colors; solid path strokes skip unused `subpathBounds` scans.

- 70971d9: <!-- markdownlint-disable MD041 -->

  fix: tier-2 validation accepts bare month-day values on monthDay scales

  The runtime parses an unset `parse` on a `temporalKind: "monthDay"` scale
  with the `md` parser (temporal-position.ts), but the validator fell back to
  plain `auto` — so annotation fields holding exactly the values the scale is
  for ("03-18", "05-08") failed `scale-type-mismatch` while rendering fine.
  Any spec with month-day annotation rows on a monthDay axis (the sakura
  lesson chart's epoch bands, record callouts, ring layers) now validates
  clean; the error message names the effective parser.

  Migration: none — validation-only false positive removed

- 796cb50: <!-- markdownlint-disable MD041 -->

  fix: close three summary_rolling contract gaps found in review

  - `params.fun` "first"/"last" on summary stats silently plotted the window
    **maximum** (the point/line params union admits manual's keep transforms;
    `applySummaryFun`'s default branch aliased max). Tier-2 validation now
    rejects them with a named `summary-fun-unsupported` error, and the core
    summary registry throws on any out-of-registry fun as a backstop.
  - Tooltips on rolling-summary charts advertised only x; `summary_rolling`
    now publishes its summarized y to inspection like `summary_bin`.
  - Spec validation accepted `{ stat: "y" }` channels the renderer rejects:
    the style after-stat map now publishes `summary_rolling: ["y"]` (mirroring
    `summary_bin`), and the validator checks the y channel against the
    y-mappable column table (also closing the identical pre-existing
    `summary_bin` y-channel gap).

  Migration: none — invalid specs now fail validation instead of rendering
  wrong (or crashing); valid specs are unaffected

## 0.29.1

### Patch Changes

- 44124a6: # Elevate tooltip cards on dark, hcdark, 538, economist

  Raise default tooltip surfaces so tips read as floating cards on `dark`,
  `hcdark`, `fivethirtyeight`, and `economist`. Edition-2 dark elevates fill only;
  LEGACY dark elevates `tooltipPaper` only (border stays rgba grid-derived).
  hcdark also brightens tip ink. VR smoke golden `interaction-tooltip-dark.png`
  updates with the dark tip change.

- c851682: # Solarized tooltip surfaces for contrast

  Elevate tooltip cards on `solarized`, `solarizeddark`, `solarized_2`, and
  `solarized_2dark` using adjacent Schoonover base steps so tips no longer match
  the chart panel. Tip ink steps stronger than axis ink (base01/base1) for short
  reading chrome. Light solarized tip text is palette-native near-AA (4.39∶1).

- 5105cdc: # Tooltip overrides in themed() and sticky-when-elevated resolveTheme tips

  `themed()` accepts optional `tooltipPaper` / `tooltipInk` / `tooltipBorder` so
  complete themes can elevate the tip package above pure foundation derivation.

  `resolveTheme` object path uses sticky-when-elevated tip inheritance: named bases
  that store non-derived tip roles keep them when authors only tweak
  typography/accent/etc.; pure themes still re-derive tip from paper/panel/grid.
  Explicit ThemeSpec tip roles still win.

  No built-in problem-theme hex changes in this release slice — those follow in
  separate token PRs.

## 0.29.0

### Minor Changes

- 576fdbf: # Drop Tableau 10, Summer, Winter, and stone schemes

  Migration: <https://ggsvelte.sh/guide/upgrading#removed-tableau-10-summer-winter-and-stone-schemes>

  Remove six categorical schemes (and public `*_PALETTE` constants):
  `tableau10`, `tableau_summer`, `tableau_winter`, `tableau_miller_stone`,
  `tableau_superfishel_stone`, `tableau_nuriel_stone`.

  Prefer `observable10`, `colorblind`, `Dark2`, `pander`, or another remaining
  Tableau scheme (`tableau20`, `tableau_colorblind`, `tableau_jewel_bright`, …),
  or pass an explicit `range`.

  Skill inventory (`SKILL.md`, `references/scales-and-palettes.md`) drops the
  same schemes so agents no longer list them.

## 0.28.0

### Minor Changes

- 3217502: # Drop Accent, Paired, Grey, Google Docs, and Tableau multi-hue schemes

  Migration: <https://ggsvelte.sh/guide/upgrading#removed-accent-paired-grey-google-docs-and-tableau-multi-hue-schemes>

  Remove eight categorical schemes (and public `*_PALETTE` constants where they
  existed): `Accent`, `Paired`, `grey`, `gray`, `gdocs`,
  `tableau_green_orange_teal`, `tableau_red_blue_brown`,
  `tableau_purple_pink_gray`.

  Also remove chart theme `gdocs` and its Svelte shell `ThemeGdocs`.

  `scaleColorGrey()` / `<ScaleColorGrey />` still work by baking an explicit
  greyscale `range` (optional `start`/`end`). They no longer emit
  `scheme: "grey"`. Prefer `Dark2`, `tableau10`, `colorblind`, or `pander` for
  named categorical color; prefer `minimal`, `classic`, or `bw` for themes.

  Skill inventory (`SKILL.md`, `references/scales-and-palettes.md`,
  `references/themes.md`) drops the same schemes and theme so agents no longer
  list them.

- 5531a8d: # Drop spreadsheet/Stata-extra schemes and Excel/Calc/Stata Mono themes

  Migration: <https://ggsvelte.sh/guide/upgrading#removed-spreadsheet-highcharts-and-extra-stata-schemes-and-themes>

  Remove nine categorical schemes and their public `*_PALETTE` constants:
  `stata_s1color`, `stata_s1rcolor`, `stata_mono`, `hc`, `hc_dark`, `calc`,
  `excel`, `excel_fill`, `excel_new`.

  Also remove four chart themes (and their Svelte shells): `stata_mono`
  (`ThemeStatamono`), `calc` (`ThemeCalc`), `excel` (`ThemeExcel`), `excel_new`
  (`ThemeExcelnew`). Nothing with "Excel" remains in the product surface.

  Skill inventory drops the same schemes and themes.

  Switch removed schemes to `stata`, `tableau10`, `Dark2`, or `pander`.
  Switch removed themes to `stata`, `stata_s1color`, `bw`, `classic`, or
  `minimal`.

## 0.27.0

### Patch Changes

- 0daf0ba: # Startup: precompiled spec validator

  Migration: none. `validate()` semantics are unchanged — pinned by a
  differential test against a runtime-compiled TypeBox validator (17-spec
  corpus + 500 fuzzed mutations, including exactOptionalPropertyTypes edge
  cases).

  The spec barrel no longer pays `Compile(PlotSpecSchema)` — seconds on a
  loaded machine — at module load. The validator is a standalone module
  precompiled at build time (`bun run validator:gen`, drift-gated by
  `bun run validator:check`), checked into `packages/spec/src/generated/`.

  Measured (loaded x86_64 box, dist builds):

  - spec barrel import: **~2550 → ~250 ms**
  - first `validate()` call: **~2765 → ~117 ms**
  - `runPipeline` first call: unchanged (never typeboxed)
  - every `ggsvelte-render` CLI invocation validates, so CLI startup drops
    by the same margin

  Contributor note: after changing `PlotSpecSchema` or upgrading TypeBox,
  run `bun run validator:gen` and commit the regenerated artifact.

## 0.26.2

## 0.26.1

## 0.26.0

## 0.25.0

### Minor Changes

- 1fbbf45: # Drop Temporal polyfill from lean render bundles

  Migration: none — additive public `ensureTemporalPolyfill` and lean-render size win.

  Identity / numeric charts on `@ggsvelte/core/render` need no call-site change. Apps that parse non-UTC values from `@ggsvelte/spec` alone still get the polyfill via the public temporal facade (`parseTemporal`, column helpers) or `ensureTemporalPolyfill()`. Full `@ggsvelte/core` / `@ggsvelte/core/temporal` and agent `validate()` also register it.

  The polyfill is no longer a static import on the shared parse foundation. Lean client graphs keep ISO/UTC calendar helpers without shipping Temporal + jsbi (~50KB+ gzip).

### Patch Changes

- d731a33: # Builder geom sugar deep-copies layer data once, not twice

  Migration: none — same `.spec()` output and mutation isolation; one less
  O(rows×cols) snapshot on `geom*({ data })`.

  `layerFrom` no longer calls `toAuthoringDataRef`. Every geom sugar path is
  `this.layer(layerFrom(...))`, and `layer()` remains the single defensive copy.

- b6b8a61: # Hoist timezone validation off the per-row parse path

  Migration: none — same parse results and failure messages; fewer allocations
  when a column shares one timezone option.

  `timezoneValidationFailure` uses a module-level UTC-alias Set and caches the
  full `TemporalParseResult` (or null) so repeated checks for the same zone do
  not rebuild the alias array or re-allocate invalid-zone failures.

## 0.24.3

## 0.24.2

## 0.24.1

### Patch Changes

- 45c6cc9: # Refresh package README front doors

  Migration: none — package README + skill docs only

  Rewrite the npm package READMEs for current APIs; treat them as shipped
  surfaces for changesets and CI; execute TypeScript fences in unit tests. Fix
  skill prose that still called 0.13.0 grammar-prop removal “planned.”

- 06afe2c: # Share frozen band domain across facet guide plans

  Migration: none — internal memory hygiene; guide plan domain contents and freeze contract unchanged.

  Under fixed facet scales, band axis guide plans reused to copy `scale.rawDomain`
  once per panel. Reuse the already-frozen array when present so panels share one
  object. Free scales still get distinct domains because each panel trains its own
  `rawDomain`.

- ea0c0b3: <!-- markdownlint-disable MD041 -->

  # Temporal decision cache keys by dataset evidence

  Migration: none — internal

  Multi-layer validation reused the first temporal decision for a field name across
  layers that read different datasets. The memo now keys by FieldEvidenceEntry
  identity so same-named fields keep independent temporal decisions.

## 0.24.0

### Patch Changes

- f8e379c: # Resolve a shared named dataset once, not once per layer

  Migration: none — internal

  Data-aware validation resolved each layer's data independently. A layer naming a
  dataset paid a full pivot of `{values}` rows into columns plus type inference
  over every column — so L layers naming one dataset did that work L times on one
  unchanged table.

  Resolve each name once and reuse it, for both the pivot and the type inference,
  seeded from the plot's own dataset so a layer naming the plot's table shares it
  rather than rebuilding. That matches the row accounting, which already counts a
  shared name once.

  Row and byte limits are unchanged: a shared name still counts once, and inline
  layer data still gets its own table, since equal content is not the same table.

## 0.23.0

### Minor Changes

- e57bdbf: # Lean render path

  Migration: none — additive

  Add lean chart import paths that drop TypeBox validation and the Temporal polyfill from identity-chart client bundles.

  - `@ggsvelte/core/render` — pipeline + SVG with basic geoms only (no heavy stats).
  - `@ggsvelte/core/temporal` — optional install for time scales / Temporal polyfill.
  - `@ggsvelte/spec/portable` — fluent builder that finishes with normalize only.
  - `GGBuilder.toPortable()` on the full package; `.spec()` still TypeBox-validates.

  Measured lean scatter path: ~327 KB → ~140 KB gzip (−57%). Full package default entry stays complete.

### Patch Changes

- 58356ea: <!-- markdownlint-disable MD041 -->

  perf(spec): scan stacked-area-negative y column once per field, not per layer

- 1a9ec15: <!-- markdownlint-disable MD041 -->

  perf(spec): skip interpreted per-layer schema re-check on valid specs

## 0.22.0

### Patch Changes

- bd1a10e: <!-- markdownlint-disable MD041 -->

  fix(core): auto-align sparse stacked-area groups instead of rendering floating polygons

  Stacked area groups whose continuous x samples skip an interior grid point
  used to chord straight across the hole while the stack below varied,
  rendering disembodied polygons — silently. The default identity path now
  auto-applies the align stat (interpolate between a group's observed samples,
  zero outside its range) and emits a new `stack-align-applied` advisory.

  The rescue stands down — keeping today's geometry — when the x scale may
  train discrete, when a group repeats an x value, or when the expansion would
  exceed its budget (the new `stack-align-skipped` warning discloses that
  case). Aligned frames keep source-row lineage for grid points that coincide
  with observed samples, so hover/tooltip/keyboard inspection still reach real
  data (this also lights up inspection on explicit `stat: "align"` layers).

  Migration: none — additive (new diagnostic names; no existing surface changed).

## 0.21.0

## 0.20.0

## 0.19.0

### Minor Changes

- 2054672: <!-- markdownlint-disable MD041 -->

  Remove ColorBrewer Set1/Set2/Set3 categorical schemes

  Migration: <https://ggsvelte.sh/guide/scales-guides>

  Drop the poorly named Set1/Set2/Set3 palettes from the scheme registry,
  runtime tables, docs catalog, and agent skill. Dark2, Paired, and Accent
  remain. Specs that used `scheme: "Set1"|"Set2"|"Set3"` (or brewer
  `palette` of those names) no longer validate — switch to another ordinal
  scheme (e.g. `Dark2`, `tableau10`, `colorblind`) or an explicit `range`.

### Patch Changes

- 31bdf1c: <!-- markdownlint-disable MD041 -->

  perf(spec): precompute reference catalogs off TypeBox

  Ship GEOM_REFERENCE, SCALE_REFERENCE, STAT/POSITION/GUIDE catalogs and
  GEOM_PARAM_KEYS as generated plain data so docs SSR and createGeomLayer
  never load SpecDeclarations. Rebuild with `bun run reference:catalogs:gen`.

## 0.18.0

### Minor Changes

- 68cc5ec: <!-- markdownlint-disable MD041 -->

  fix(docs): capacity-matched palette specimens; drop tableau_traffic

  /palettes always plotted the 8-squadron Armada tonnage bars. Short palettes
  cycled colours and long palettes left most swatches unused. Specimens now pick
  a real HistData series with exactly as many categories as the palette has
  colours (polio 2–3, Armada men 4–10, Langren 11–12, chest sizes 13–16, cholera
  districts 17–24).

  Also remove the Tableau Traffic categorical scheme (`tableau_traffic` /
  `TABLEAU_TRAFFIC_PALETTE`) — the red/yellow/green KPI triples were a weak
  showcase ramp and are not kept in the docs or skill tables.

  Migration: <https://ggsvelte.sh/guide/scales-guides>

  If you set `scheme: "tableau_traffic"`, switch to another ordinal scheme
  (e.g. `tableau10`, `Set1`, or an explicit `range`).

- 5627ff9: <!-- markdownlint-disable MD041 -->

  perf(spec): split render path off TypeBox schema validation

  Browser chart bundles no longer load `schema-declarations` / `typebox/compile`
  by default. `runPipeline` / `assemblePortableSpec` still run `normalize()` plus
  TypeBox-free structural gates. Full schema `validate()` remains on the agent
  path (`validate()`, builder `.spec()`, CLI).

  Migration: none — additive for new structural-gate exports; CLI still validates
  with TypeBox while browser render uses normalize + structural gates only

### Patch Changes

- 4b059b0: <!-- markdownlint-disable MD041 -->

  perf(spec): one field-evidence pass for validate + dataChecks

  `validate(spec, options)` now builds plot and layer field evidence once via
  `resolveLayerFieldEvidence` and shares it with data-aware checks and lint,
  instead of pivoting/type-scanning plot tables twice.

  When aggregate plot+layer tables exceed maxRows/maxBytes, data-backed lint
  advisories are skipped (no plot-only evidence handoff on that error path).

  Migration: none for valid under-limit specs

## 0.17.0

### Minor Changes

- 9cce304: <!-- markdownlint-disable MD041 -->

  feat(spec): export schema-derived `GUIDE_REFERENCE` for every guide type

  `GUIDE_REFERENCE` / `guideReferenceList()` publish each public guide variant
  (`legend`, `colorbar`, `colorsteps`, `axis`, `none`) with channels, props from
  the matching `*GuideSpec`, and Svelte/helper names. The docs site uses this for
  `/reference/guides`.

  Migration: none — additive

- 3f72e4c: <!-- markdownlint-disable MD041 -->

  feat(theme): base + igray + map + solid chart themes (ggthemes minimalist family)

  Clean-room port of ggthemes `theme_base()`, `theme_igray()`, `theme_map()`,
  and `theme_solid()`. (This family ships no palettes in ggthemes.)

  - Theme `base`: base-R graphics defaults — white panel with a black frame
    (panel.border; axis.line is blank in the theme_grey lineage), black ticks,
    no grid, black text, bold rel(1.2) title on base 16.
  - Theme `igray`: the theme_gray inverse — white panel over a gray90
    (`#e5e5e5`) surround with a matching gray90 major grid.
  - Theme `map`: every axis/panel/grid element blank — marks only, for maps.
    Converges with `void` in this token model (both keep the title).
  - Theme `solid`: removes every non-geom element. This model has no
    suppress-title role, so R's blanked title flattens into the shared
    void-like surface (documented on the token block).
  - Svelte shells `ThemeBase`, `ThemeIgray`, `ThemeMap`, `ThemeSolid`; docs
    `/themes` gains the four portraits.

  Migration: none — additive

- e9e40b3: <!-- markdownlint-disable MD041 -->

  feat(spec): export schema-derived `SCALE_REFERENCE` for every Scale* surface

  `SCALE_REFERENCE` / `scaleReferenceList()` publish each public scale helper
  from `SCALE_CAPABILITIES` (plus Colour/Ordinal aliases) with family, aesthetics,
  params from position/color/style schemas, and guide notes. The docs site uses
  this for `/reference/scales`.

  Migration: none — additive

- 92a9a6c: <!-- markdownlint-disable MD041 -->

  feat(theme): calc + excel + excel_new chart themes and palettes (ggthemes spreadsheet family)

  Clean-room port of the ggthemes spreadsheet family: `theme_calc()` +
  `calc_pal()`, `theme_excel()` + `excel_pal()`, `theme_excel_new()` +
  `excel_new_pal()`.

  - Theme `calc`: LibreOffice Calc defaults — white panel, gray70 (`#b3b3b3`)
    border and y-major grid, no axis lines, black text, 13px title.
  - Theme `excel`: the Excel 97 classic look — `#c0c0c0` gray panel, black
    y-major grid and panel border (theme_bw chrome per this port's lineage).
  - Theme `excel_new`: current Excel defaults — `#595959` text, hairline
    `#bfbfbf` y-grid, no ticks, no border, plain 14px title. R's blank axis
    titles flatten into the shared roles (documented on the token block).
  - Palettes for ordinal color/fill scales: `calc` (12 chart colors), `excel`
    (Excel 97 line/point set, `scale_colour_excel`), `excel_fill` (Excel 97
    area set, `scale_fill_excel`), `excel_new` (the default "Office Theme"
    accents — ggthemes ships 50 named Office themes; only the default is
    registered, documented subset).
  - Svelte shells `ThemeCalc`, `ThemeExcel`, `ThemeExcelnew`; docs `/themes`
    gains the three portraits (each paired with its own scheme) and
    `/palettes` gains the four cards.

  Migration: none — additive

- cafc230: <!-- markdownlint-disable MD041 -->

  feat(theme): stata chart themes and palettes (ggthemes Stata schemes)

  Clean-room port of ggthemes `theme_stata()` + `stata_pal()` with
  `scale_colour_stata()` / `scale_fill_stata()`.

  - Theme `stata` (s2color): the default Stata look — ltbluishgray (`#eaf2f3`)
    plot region around a white panel, matching y-major grid, black axis lines
    and ticks, no panel border. Sizes from the stata_gsize ratios (base 11,
    axis 10, title 14, axis title 10). R's dknavy title colour folds into the
    single ink role; the bottom legend position is not expressible
    (documented on the token block).
  - Theme `stata_s1color`: the older s1 look — white plot/panel, gs14 y-grid,
    black panel border.
  - Theme `stata_mono` (s2mono): gs15 plot region, dimgray y-grid, no border.
  - Palettes for ordinal color/fill scales, one scheme per `stata_pal()`
    variant: `stata` (s2color, the ggthemes default), `stata_s1color`,
    `stata_s1rcolor`, `stata_mono` — 15 colors each, resolved from Stata's
    named color table in source order.
  - Svelte shells `ThemeStata`, `ThemeStatas1color`, `ThemeStatamono`; docs
    `/themes` gains the three portraits (each paired with its own scheme) and
    `/palettes` gains the four cards.

  Migration: none — additive

- 8bcf87c: <!-- markdownlint-disable MD041 -->

  feat(scale): thirty tableau gradient ramps (ggthemes tableau_gradient_pal set)

  Clean-room port of every `tableau_color_pal` ordered-sequential (15) and
  ordered-diverging (15) ramp — the `scale_*_gradient_tableau` /
  `scale_*_gradient2_tableau` family — completing the Tableau palette set.

  - 15 `tableau_seq_*` ramps: blue-green, blue-light, orange-light (7 stops
    each) and the single-hue blue, orange, green, red, purple, brown, gray,
    gray-warm, blue-teal, orange-gold, green-gold, red-gold ramps (20–21
    stops each).
  - 15 `tableau_div_*` ramps: orange-blue, red-green, green-blue, red-blue,
    red-black, gold-purple, red-green-gold, sunset-sunrise, the four
    *-white variants, orange-blue-light, and temperature (7 stops each).
  - Values are verbatim copies of the upstream YAML tables in source order.
    Stop counts exceed `MAX_PAINT_STOPS` safely: ramps are interpolation
    tables for continuous/binned scales and are re-sampled by the colorbar,
    never emitted as raw paint stops (documented in the module header).
  - Resolution follows the ColorBrewer pattern: a new
    `packages/core/src/scales/tableau-ramps.ts` family module consulted as
    the fallthrough in `resolveSequentialPipelineRange` and
    `resolveOrdinalPaletteStops` (Tableau ramps also work ordinally, like the
    brewer sequential tables).

  Migration: none — additive scheme names only.

## 0.16.0

### Minor Changes

- 8e3b64b: <!-- markdownlint-disable MD041 -->

  feat(scale): economist categorical palette (ggthemes scale_colour/fill_economist)

  Registers the `economist` scheme for ordinal color/fill scales: the nine
  ggthemes Economist fg colors in the fill palette's full-capacity order
  (blue-gray, dark blue, blue, light blue, dark green, light green, dark red,
  pink, gray). ggthemes re-selects hues per n; this port flattens to the fixed
  n = 9 order, so prefix subsets approximate the smaller-n picks. The docs
  themes page now demos the Economist theme with its own palette, and the
  palettes page gains the Economist card.

  Migration: none — additive

- b4a58c1: <!-- markdownlint-disable MD041 -->

  feat(theme): economist_white + solarized_2 themes, few + fivethirtyeight palettes (ggthemes completions)

  Clean-room ports completing four already-shipped ggthemes families.

  - Theme `economist_white`: ggthemes `theme_economist_white(gray_bg = TRUE)` —
    the Graphic Detail blog variant of `theme_economist`: white panel on
    light-gray (`#ebebeb`) paper, dark-gray (`#c9c9c9`) major grid, economist
    chrome otherwise unchanged.
  - Themes `solarized_2` / `solarized_2dark`: ggthemes `theme_solarized_2()`
    light/dark — the theme_grey-flavored Solarized variant (base2 panel, base3
    grid, no frame; R's misspelled `reabase01` axis-line key resolves to NA,
    so no axis line — documented on the token block).
  - Palettes for ordinal color/fill scales: `few` (Few "Medium", the
    `scale_colour_few` default), `few_light` (the `scale_fill_few` default),
    `few_dark`, and `fivethirtyeight` (blue/red/green). ggthemes reserves
    Few's first value (Gray) for non-data parts at n = 1; the fixed lists are
    the eight data colors in source order, matching ggthemes' prefix picks.
  - Svelte shells `ThemeEconomistwhite`, `ThemeSolarized2`,
    `ThemeSolarized2dark`; docs `/themes` gains the three portraits (the Few
    and FiveThirtyEight themes now demo with their own palettes) and
    `/palettes` gains the four cards.

  Migration: none — additive

- 1256265: <!-- markdownlint-disable MD041 -->

  feat(scale): ptol and canva categorical palettes (ggthemes ptol_pal / canva_pal)

  Clean-room port of ggthemes `ptol_pal()` and `canva_pal()`.

  - `ptol`: Paul Tol's qualitative palette (SRON/EPS/TN/09-002) at full
    capacity — the n = 12 selection. ggthemes re-selects the set per n; this
    port flattens to the fixed full-capacity order (prefix subsets
    approximate the smaller-n picks, documented on the constant), matching
    the economist palette's precedent.
  - `canva`: the `scale_*_canva` default "Fresh and bright" (4 colors,
    extracted from `data/canva_palettes.rda`). ggthemes ships 150 named
    four-color Canva palettes; only the default is registered (documented
    subset, same call as excel_new's Office themes).
  - Docs `/palettes` gains the two cards (21 total).

  Migration: none — additive

- 65bce1d: <!-- markdownlint-disable MD041 -->

  feat(theme): solarized + solarizeddark chart themes and solarized palette

  Clean-room port of ggthemes `theme_solarized()` (light and `light = FALSE`)
  and `scale_colour_solarized()` / `scale_fill_solarized()`.

  - Themes `solarized` and `solarizeddark`: theme_bw geometry on Schoonover's
    rebased tones — base3/base03 panels, base2/base02 grids, base1/base01
    chrome and text, transparent plot background, framed panel, blue `#268bd2`
    accent. As with the other ports, R's darker title step (rebase0) flattens
    into the single ink role.
  - Palette `solarized` for ordinal color/fill scales: the eight Solarized
    accents with ggthemes' default blue first, then source order — ggthemes'
    max-L*a*b-distance selection is order-degenerate at n = 8. The same accent
    ramp serves both themes; only the base tones flip (Schoonover's design),
    so no separate dark scheme is registered.
  - Svelte shells `ThemeSolarized` / `ThemeSolarizeddark`; docs `/themes` gains
    both portraits (paired with the solarized scheme) and `/palettes` gains
    the Solarized card.

  Migration: none — additive

- 537f6ae: <!-- markdownlint-disable MD041 -->

  feat(scale): fourteen tableau categorical palette variants (ggthemes tableau_color_pal regular set)

  Clean-room port of every remaining `tableau_color_pal(type = "regular")`
  variant, completing the regular Tableau set alongside the existing
  `tableau10`. Values are verbatim copies of the upstream YAML tables in
  source order (ggthemes' n picks are prefix walks, so the fixed lists match
  exactly).

  - `tableau20` — the classic paired Tableau 20.
  - `tableau_colorblind` — Tableau's colorblind-safe 10.
  - `tableau_seattle_grays` (5), `tableau_traffic` (9),
    `tableau_miller_stone` (11), `tableau_superfishel_stone` (10),
    `tableau_nuriel_stone` (9), `tableau_jewel_bright` (9),
    `tableau_summer` (8), `tableau_winter` (10),
    `tableau_green_orange_teal` (12), `tableau_red_blue_brown` (12),
    `tableau_purple_pink_gray` (12), `tableau_hue_circle` (19).
  - Docs `/palettes` gains the fourteen cards (29 total).

  The ordered-sequential and ordered-diverging Tableau ramps are a separate
  follow-up (they feed the sequential scheme registry, not the categorical
  one).

  Migration: none — additive

- 1ba87f8: <!-- markdownlint-disable MD041 -->

  feat(theme): gdocs + hc + hcdark + pander chart themes and palettes (ggthemes web/tech family)

  Clean-room port of the ggthemes web/tech family: `theme_gdocs()` +
  `gdocs_pal()`, `theme_hc()` default/darkunica + `hc_pal()`, and
  `theme_pander()` + `palette_pander()`.

  - Theme `gdocs`: Google Docs defaults — white panel, `#cccccc` major grid,
    black x-only axis line, no ticks, `#757575` text, plain 20px title.
  - Themes `hc` / `hcdark`: Highcharts default and darkunica — y-only major
    grid (`#D8D8D8` / `#707073`), no border. `hcdark` documents one deviation:
    R leaves axis text at theme_grey's dark grey (dark-on-dark); this port
    uses the style's `#A0A0A3` text colour for axis text and ticks.
  - Theme `pander`: pander defaults — dashed `#bebebe` grid (R "grey"),
    grey ticks, bold 14.4px title, no visible border.
  - Palettes for ordinal color/fill scales: `gdocs` (6 hues × 4 strengths,
    copied verbatim including the upstream teal-2 duplicate), `hc` (10),
    `hc_dark` (11, verbatim with trailing repeats), `pander` (Okabe-Ito hues
    in pander's order, `#999999` for black).
  - Svelte shells `ThemeGdocs`, `ThemeHc`, `ThemeHcdark`, `ThemePander`; docs
    `/themes` gains the four portraits (each paired with its own scheme) and
    `/palettes` gains the four cards.

  Migration: none — additive

- 6d4352a: <!-- markdownlint-disable MD041 -->

  feat(theme): wsj chart theme and five wsj palettes (ggthemes theme_wsj / scale_*_wsj)

  Clean-room port of ggthemes `theme_wsj()` and `wsj_pal()` with
  `scale_colour_wsj()` / `scale_fill_wsj()`.

  - Theme `wsj`: Wall Street Journal chrome — "brown" paper `#f8f2e4`, dotted
    black y-grid only, x axis line and ticks, no y line/ticks, big bold title
    (rel(2) of base 12). R's `title_family = "mono"`, bold axis text, and blank
    axis titles flatten into the shared font/weight roles (documented on the
    token block); the colors6 red `#c72e29` accent pairs unmapped marks with
    the wsj palette.
  - Palettes for ordinal color/fill scales, one scheme per `wsj_pal()`
    variant: `wsj` (colors6, the ggthemes default), `wsj_rgby`,
    `wsj_red_green`, `wsj_black_green`, `wsj_dem_rep`.
  - Svelte shell `ThemeWsj`; docs `/themes` gains the WSJ portrait (paired
    with the wsj scheme) and `/palettes` gains the five WSJ cards.

  Migration: none — additive

## 0.15.2

### Patch Changes

- 3fe70c3: <!-- markdownlint-disable MD041 -->

  perf(svelte): cache candidate semantic keys by lineage membership

  Interval, selection, and mask projection walk every candidate. Marks that
  share a lineage (smooth eval grids) now expand membership once and reuse
  the key bag. Single-candidate paths stay O(L) on first hit.

  Migration: none — internal speedup only

- aeac77b: <!-- markdownlint-disable MD041 -->

  perf(svelte): expand legend lineages once per lineage id

  buildLegendEntryKeyIndex shared membership Sets across candidates with the
  same lineage id (smooth eval grids). Lineage is no longer re-walked once
  per mark. Candidate-local rowIndex still attaches without mutating the
  shared bag.

  Migration: none — internal speedup only

- b08d256: <!-- markdownlint-disable MD041 -->

  perf(core): O(log B) style bin lookup for binned size/shape/group

  Binned style scales and style-driven grouping used linear findIndex over
  break edges on every mapped row. styleBinIndex binary-searches the same
  left-closed contract (B ≤ 64). Color binned scales already did this.

  Migration: none — internal speedup only

## 0.15.1

### Patch Changes

- 4883364: <!-- markdownlint-disable MD041 -->

  refactor(core): collapse the finalize pipeline chain into one module

  The finalize phase had hop-only modules that only redeclared and
  forwarded the same run-state blob. One entry, `finalize(PipelineRunState)`,
  now owns layout → geometry → contracts → candidates → RenderModel.
  Layout and geometry stay in their own files. Public `RenderModel` shape
  is unchanged.

  Migration: none — internal collapse only

- 3607ef1: <!-- markdownlint-disable MD041 -->

  perf(core): density_2d KDE uses a sorted-x sliding window

  Product-Gaussian grid evaluation sorts samples by x once and slides an
  x-window across each grid row, so far-away points are not examined when
  bandwidth is local. Same ±8σ product kernel and isoline path as before.

  Migration: none — internal speedup only

- c0d1e63: <!-- markdownlint-disable MD041 -->

  perf(svelte): expand each lineage id once for key and interval resolve

  Smooth and other aggregate eval-grid marks share one lineage membership
  across many candidates. resolveSemanticKeys and
  lineageRowIndexesFromCandidates now walk each lineage id once instead of
  re-spreading O(C·L) times. Diagnostics for empty lineages still fire per
  candidate.

  Migration: none — internal speedup only

## 0.15.0

### Minor Changes

- 8541dc6: <!-- markdownlint-disable MD041 -->

  feat(spec): generate builder scale mixins from SCALE_CAPABILITIES (#1081)

  `builder-scales.ts` is now produced by `bun run builder:scales:gen` so every
  camelCase ledger helper (plus size/alpha/linewidth/shape ordinal aliases) is a
  `GGBuilder` method. Adds the 24 palette constructors that were free-helper-only
  (`scaleColorBrewer`, gradients, steps, hue/grey, ordinal, fill twins).

  Migration: none — additive

- 3e9d5fa: <!-- markdownlint-disable MD041 -->

  feat(spec): export scale helper inventory from SCALE_CAPABILITIES (#1081)

  Public inventory helpers for the capability ledger: `scaleCapabilityCamelHelpers`,
  `STYLE_ORDINAL_SCALE_HELPERS`, and `builderScaleHelperNames`. Generator scripts
  (`builder:scales`, `scale:children`) now share this package surface so helper
  name sets are not re-derived by hand.

  Migration: none — additive

- cd09bd8: <!-- markdownlint-disable MD041 -->

  feat(spec): export schema-derived `GEOM_REFERENCE` for every geom

  `GEOM_REFERENCE` / `geomReferenceList()` walk SpecDeclarations and publish
  each geom's summary, defaults, allowed stats and positions, and param docs.
  The docs site uses this for `/reference/geoms` so Svelte props stay in step
  with `schema/v0.json`. Also documents five previously undescribed params
  (`pointrange`/`crossbar` `funMin`/`funMax`, `function.args`).

  Migration: none — additive

- d4c969b: <!-- markdownlint-disable MD041 -->

  feat(inspect): let a layer opt out of inspection

  An area mark reports distance 0 everywhere it is painted, so a full-panel
  background band outranks every point and stroke beneath it: the tooltip binds to
  the band and the reader can never reach the data. Set `inspect={false}` on that
  layer (or `"inspect": false` in the spec) and its marks never become tooltip,
  hover, or keyboard-traversal candidates.

  It travels with the spec, so a JSON round trip and a headless render agree with
  the browser. Rect hit maths is unchanged, so layers that want an area tooltip —
  bars, tiles, heatmaps — keep one.

  Migration: none — additive

- b80a3b1: <!-- markdownlint-disable MD041 -->

  feat(core): month-day axes read "Apr 1", and refuse labels they cannot fill

  A month-day axis carried its values correctly but formatted them through the
  datetime path, so ticks read `2000-04-01 00:00:00 UTC` — the reference year
  exposed in the one place a reader was guaranteed to look. Axis ticks, the
  crosshair, and the tooltip header now read `Apr 1`.

  `fullLabel` is fixed too. It is not the visible tick, which is exactly why the
  leak was quiet, and it reaches the guide plan.

  The automatic interval ladder drops week and year for this kind. A year tick on
  a one-year axis is the same tick twice, and a week tick implies a weekday that
  belongs to the reference year rather than to the data. Day, month, and quarter
  remain; an authored `dateBreaks` is still honoured as given.

  `dateLabels` now rejects tokens a month-day axis cannot fill honestly. The rule
  is that a token is legal if and only if the month and the day determine it, so
  `%m %b %B %d %e %q` are accepted and year, clock, zone, and weekday tokens are
  refused with a message naming the offending token. `%a` is refused for the same
  reason as `%Y`: 1 April fell on a different weekday in 812 than in 2001, so
  printing one would invent a fact.

  Migration: none — additive

- 6c44565: <!-- markdownlint-disable MD041 -->

  feat(spec): month-day scale surface — the `md` parser and `temporalKind: "monthDay"`

  Plotting observations from many years against the calendar day they fell on
  had no representation. Authors faked it by projecting every value onto an
  invented reference year and carrying that year in their data — which is how
  the Kyoto cherry-blossom lesson ended up shipping a `bloomRefDate` column
  whose only job was to be thrown away by the axis.

  `temporalKind: "monthDay"` says it directly: the year collapses inside the
  scale, so the same calendar day from any year shares one position.

  ```svelte
  <ScaleYMonthDay
    reverse
    domain={["05-10", "03-18"]}
    breaks={["04-05", "04-15"]}
  />
  ```

  Values, `domain`, and `breaks` all drop the year. They resolve through a new
  `md` parser, which takes `MM-DD`, the ISO recurring form `--MM-DD`, or a full
  date whose year it discards. It joins the partial-date family beside `ym`,
  `my`, and `yq`, and — like them — is never chosen by automatic inference.

  **Month and day survive; day-of-year does not.** Those differ for every leap
  year, which is exactly the bug the reference-year trick used to introduce.

  This ships the authoring surface: helpers, builder methods, generated
  components, schema, and validation. Rendering follows.

  Colour scales keep `date | datetime`. Month-day is a position idea and
  nothing asked for it there.

  Internally `TemporalScaleKind` is a new type, deliberately not a widening of
  `TemporalKind`. `TemporalKind` is also what parsing a value _returns_, and no
  value parses to `monthDay` — it is a projection applied afterwards. Splitting
  them keeps `decision.kind === conversion.requestedKind` comparisons honest at
  compile time.

  Migration: none — additive

- cd3ee72: <!-- markdownlint-disable MD041 -->

  feat(spec): export schema-derived `POSITION_REFERENCE` for every position

  `POSITION_REFERENCE` / `positionReferenceList()` publish each position
  adjustment's summary, `positionParams` (from the PositionParams schema for
  jitter/nudge), and compatible geoms. The docs site uses this for
  `/reference/positions`.

  Migration: none — additive

- e969b35: <!-- markdownlint-disable MD041 -->

  feat(spec): export schema-derived `STAT_REFERENCE` for every stat

  `STAT_REFERENCE` / `statReferenceList()` publish each statistical transform's
  summary, after_stat columns (`STAT_COLUMNS`), and compatible geoms (inverted
  from `GEOM_REFERENCE`). The docs site uses this for `/reference/stats`.

  Migration: none — additive

### Patch Changes

- 06fc8e9: <!-- markdownlint-disable MD041 -->

  fix(spec): require channels for label, hex, bin_2d, qq, and qq_line

  Tier-2 validation listed only 43 of 49 geoms in `REQUIRED_CHANNELS`, so
  `label` (unlike `text`) accepted a missing `label` channel, and `hex`,
  `bin_2d`, `qq`, and `qq_line` required nothing. The table is now total over
  `GeomName`; `AES_CHANNEL_KEYS` is derived from `CHANNELS` so path mapping
  cannot lag the catalog.

  Migration: specs that omit required channels for those geoms will start
  failing `validate(spec, {})` with `missing-required-channel` — map the
  channels (or fix the geom). Annotation-only `abline` is unchanged.

- 95f2c1d: <!-- markdownlint-disable MD041 -->

  refactor(spec): generate builder geom mixins from KNOWN_GEOMS (#1081)

  `builder-geoms.ts` is produced by `bun run builder:geoms:gen` so every catalog
  geom is a `GGBuilder` method. `geomJitter` keeps its special width/height/seed
  assembly. Composition is `WithBuilderScales(WithBuilderGeoms(GGBuilderCore))`.

  Migration: none — additive tooling / internal layout; public methods unchanged.

- e39ea45: <!-- markdownlint-disable MD041 -->

  docs(reference): clean geom prose and minimal code samples

  Schema layer descriptions no longer cite ggplot2 or GitHub issue numbers on
  user-facing geom and param docs. Reference pages use minimal required-only
  snippets, a single breadcrumb trail (Reference → Geoms/Stats/Positions → name),
  and short section labels.

## 0.14.1

## 0.14.0

### Minor Changes

- 6ca5c5d: <!-- markdownlint-disable MD041 -->

  spec/core: give the post-normalize geom a type the compiler can check (#1042)

  `normalize()` rewrites five convenience geoms away — `histogram` to `bar`,
  `freqpoly` to `line`, `jitter` to `point`, `hline` and `vline` to `rule` — so
  only 44 of the 49 names reach the render pipeline. Its return type still named
  all 49, which is why every per-geom switch in core needed a `default:` arm. A
  geom missing from one of them rendered nothing, or got the wrong inspect mode,
  in silence.

  The alias rewrite is now data: `ALIAS_GEOMS` and `GEOM_ALIASES` in
  `@ggsvelte/spec`, with `NormalizedGeomName`, `NormalizedLayerSpec` and
  `NormalizedSpec` derived from them. `normalize()` returns `NormalizedSpec` and
  core carries that type through binding, so the two big switches and the
  path-projection table are exhaustive: a new geom is a compile error until every
  one of them names it.

  `PortableSpec` and the emitted JSON Schema are unchanged — `histogram` and the
  rest are still legal input. `STAT_Y_COLUMNS` is now keyed by `StatName` and
  total, which names the ten stats that publish no y-mappable column instead of
  hiding them behind a `?? []`.

  Also fixes a geom lookup that walked the prototype chain. A layer named after
  an inherited `Object` property — `geom: "constructor"`, `"toString"`,
  `"valueOf"` — lost its `stat` and `position` in `normalize()` and then failed
  validation with a shape error instead of the `unknown-geom` did-you-mean the
  error contract promises. Every geom name is now an own-key lookup.

  Migration: <https://ggsvelte.sh/guide/upgrading#0-12-to-0-13>

### Patch Changes

- 28ffaf0: <!-- markdownlint-disable MD041 -->

  Generate Geom* shells from the spec schema (`GEOM_PARAM_KEYS`) so param lists are no longer hand-copied. Schema param keys such as `fillPaint`, `strokePaint`, and `glow` now forward into layer params when set on the corresponding shells.

## 0.13.0

### Minor Changes

- dfa1ba0: <!-- markdownlint-disable MD041 -->

  Remove the seven deprecated grammar props from `<GGPlot>` (`theme`, `scales`,
  `coord`, `facet`, `labs`, `guides`, `legend`) and the `LayerDescriptor` type
  alias. Compose grammar as declaration-only children; use
  `MarkLayerDescriptor`. Run `npx ggsvelte-codemod --write` on old source.

  Migration: <https://ggsvelte.sh/guide/upgrading#0-12-to-0-13>

- cce4f5a: # One diagnostic prose source (#987)

  - Move `PIPELINE_ERROR_CATALOG` into `@ggsvelte/spec` (re-exported from core)
  - Dual-channel codes share `DUAL_ERROR_PROSE` so summary/fix cannot drift
  - Rename validation code `scale-manual-domain-range` → `color-manual-domain-range`
  - Docs error-reference imports pipeline error prose from `@ggsvelte/spec`

  Migration: <https://ggsvelte.sh/guide/upgrading#0-11-to-0-12>

### Patch Changes

- 5b54dcb: # Extract dataChecks layer walk; per-layer style/color evidence (#844)

  Move geom/stat type rules, field existence, and channel collection into
  `validate-data-checks-layer.ts` so `dataChecks` is a thin orchestrator
  (evidence → walk → style/position/color checkers).

  Style and color scale checks now take the same per-use `evidenceForUse`
  path as position (#609): multi-table layers that share a field name keep
  their own type view, so a later quantitative layer no longer last-wins-hides
  an earlier sequential/finite-style mismatch.

  Migration: none — validation is stricter only for multi-table same-name
  field cases that previously under-reported scale-type-mismatch.

## 0.12.0

### Minor Changes

- 3ec23b0: # Add geom_path — data-order polylines (#788)

  ggplot2 `geom_path` connects observations in row/data order within each group (no x-sort). `geom_line` continues to sort by x.

  - PortableSpec: `geom: "path"` (PathLayer, same params as line)
  - Builder: `.geomPath()`; Svelte: `<GeomPath />`
  - Core: reuses line path batch builder with `sortByX: false`

  Migration: none — additive

- c2e3856: <!-- markdownlint-disable MD041 -->

  feat(#789): first-class geom_step (hv / vh / mid)

  Add `geom: "step"` with `params.direction` matching ggplot2 geom_step:
  default `"hv"`, plus `"vh"` and `"mid"`. Surfaces: JSON/schema, builder
  `.geomStep()`, and `<GeomStep />`. Step corner emission is shared across SVG,
  canvas, and coord projection (`path-step.ts`). Existing `line` +
  `curve: "step"` mid-style remains.

  Migration: none — additive

- f2c0997: <!-- markdownlint-disable MD041 -->

  feat: geom_blank for scale training without marks (#791)

  Add ggplot2-style `blank` geom that trains scales from mapped aesthetics and
  emits no geometry batches or interaction candidates. Surfaces: PortableSpec,
  `geomBlank()`, and `<GeomBlank>`.

  Migration: none — additive

- e90a228: <!-- markdownlint-disable MD041 -->

  feat(geom): linerange, pointrange, and crossbar interval family (#793)

  ggplot2-compatible range geoms beyond errorbar: stem-only linerange, stem +
  mid point pointrange, and box + mid line crossbar (width/fatten). Builder and
  `<Geom*>` sugar included.

  Migration: none — additive

- 38af6a8: <!-- markdownlint-disable MD041 -->

  feat: geom_curve curved connectors (#794)

  Add ggplot2-style `curve` geom: curved connectors from (x,y) to (xend,yend)
  tessellated as a quadratic Bezier in panel px (aspect-safe curvature). Params:
  curvature (default 0.5), angle (degrees, default 90), ncp (density knob).
  One path subpath per row; one semantic candidate per curve.

  Intentional subset: quadratic Bezier approximation, not full grid xspline.
  Migration: none — additive

- cac7d43: <!-- markdownlint-disable MD041 -->

  feat(#795): geom_count + stat_sum overplotting counts

  Add `stat: "sum"` (after_stat `n` and `prop` within group) and `geom: "count"`
  sugar (point marks; size defaults to `{ stat: "n" }`). Also
  `.geomPoint({ stat: "sum" })` / `<GeomCount />`.

  Migration: none — additive

- a89cc93: <!-- markdownlint-disable MD041 -->

  feat: geom_freqpoly frequency polygon (#796)

  Add ggplot2-style `freqpoly` alias that normalize() rewrites to `line` +
  `stat: "bin"` + position identity. Bin centers are drawn as a path; y defaults
  to count (or density). LineParams gains optional STAT BIN ONLY knobs;
  PathParams stays style-only so path never accepts bin params.

  Surfaces: PortableSpec, `.geomFreqpoly()`, `<GeomFreqpoly>`.

  Migration: none — additive

- f0f379c: <!-- markdownlint-disable MD041 -->

  feat(#797): geom_function + stat_function named analytic curves

  Portable registry (`identity`, `dnorm`, `pnorm`, `linear`) evaluated on a
  grid — domain from `params.xlim`, own continuous `aes.x`, or peer-layer x.
  Surfaces: `.geomFunction()`, `<GeomFunction />`, example `line/function`.

  Migration: none — additive

- 40a43f9: # Add geom_bin_2d + stat_bin_2d heatmap (#799)

  2D rectangular binning with after_stat `fill=count` by default (ggplot2
  `geom_bin2d` / `stat_bin_2d`). Reuses edge-rect geometry and 1D break helpers.

  - PortableSpec: `geom: "bin_2d"` / `stat: "bin_2d"` with `params.bins`,
    `binwidth`, and `drop`
  - Builder: `.geomBin2d()`; Svelte: `<GeomBin2d />`
  - Color binding accepts after_stat columns (`count`, `density`, `ncount`,
    `ndensity`) for fill

  Migration: none — additive

- 158576b: # Add geom_hex / stat_bin_hex — hexagonal bin heatmap (#800)

  ggplot2-compatible 2D hexagonal binning heatmap:

  - Stat `bin_hex`: pointy-top axial lattice; fill defaults to after_stat count
  - Geometry: one closed path subpath per occupied hex
  - Surfaces: PortableSpec, `.geomHex()`, `<GeomHex />`
  - Params (v1): `bins` (default 30), `drop` (default true), `alpha`, `linewidth`

  Migration: none — additive

- a832c75: <!-- markdownlint-disable MD041 -->

  feat: geom_contour + stat_contour isolines (#801)

  Add `geom: "contour"` (default `stat: "contour"`) for open isoline polylines
  over a regular continuous x×y×z grid. Levels from `params.breaks`,
  `binwidth`, or `bins` (default 10, min..max inclusive). Clean-room marching
  squares (no R/C++). Builder `.geomContour()` and Svelte `<GeomContour />`.

  v1: open path polylines only; no contour_filled / irregular triangulation /
  default color-by-level. Incomplete grid cells are skipped; groups without a
  usable grid or levels are dropped with a warning.

  Migration: none — additive

- c11861d: <!-- markdownlint-disable MD041 -->

  # feat: geom_density_2d_filled closed KDE rings (#802 phase 2)

  Add `geom: "density_2d_filled"` / `stat: "density_2d_filled"` with builder
  `.geomDensity2dFilled()` and Svelte `<GeomDensity2dFilled />`. Same product
  Gaussian KDE as density_2d; closed isoline rings become filled paths. Open
  rings are dropped with a warning. Fill defaults to `after_stat(level)` via
  `ColorBinding.statColumn`.

  Migration: none — additive

- b90e651: <!-- markdownlint-disable MD041 -->

  feat: geom_density_2d + stat_density_2d KDE isolines (#802)

  Add `geom: "density_2d"` (default `stat: "density_2d"`) for bivariate product
  Gaussian KDE isolines. Bandwidth MASS bandwidth.nrd then kde2d h/4 (or
  `params.h`); grid `n`×`n` (default 100) over a 5%-expanded data range;
  levels via breaks / binwidth / bins. Clean-room MS via shared contour
  helpers. Builder `.geomDensity2d()` and Svelte `<GeomDensity2d />`.

  v1: open polylines only — no density_2d_filled, no weights, no contour_var
  other than density. Groups with fewer than two points are dropped with a
  warning.

  Migration: none — additive

- ccbb798: <!-- markdownlint-disable MD041 -->

  feat: geom_dotplot + stat_bindot histodot stacked dots (#803)

  Add `geom: "dotplot"` (default `stat: "bindot"`) for histodot stacked points:
  fixed bins via shared bin-breaks, one point per observation, stackdir
  up|down|center|centerwhole, stackratio, and diameter from binwidth × x-scale
  (dotsize; size px override). y is after_stat `stackpos` only. Builder
  `.geomDotplot()` and Svelte `<GeomDotplot />`.

  v1: histodot only — no Wilkinson dotdensity, no binaxis=y, no weights.

  Migration: none — additive

- 7f89e9c: <!-- markdownlint-disable MD041 -->

  feat(geom): geom_qq + geom_qq_line normal Q–Q plots (#804)

  ggplot2-compatible Q–Q scatter and reference line: `aes.sample`, `stat_qq` /
  `stat_qq_line` (normal theory quantiles + quartile line), builder
  `.geomQq()` / `.geomQqLine()`, and `<GeomQq />` / `<GeomQqLine />`.

  Migration: none — additive

- 78fef28: <!-- markdownlint-disable MD041 -->

  feat: geom_quantile + stat_quantile linear RQ lines (#805)

  Add `geom: "quantile"` (default `stat: "quantile"`) with linear y~x
  quantile regression at `params.quantiles` (default 0.25/0.5/0.75).
  Builder `.geomQuantile()` and Svelte `<GeomQuantile />`.

  v1: linear rq only (no rqss / formula / weights). Pinball-minimizing
  order-statistic intercept; pairwise-slope exact search for small n.
  Migration: none — additive

- 0ab78a4: <!-- markdownlint-disable MD041 -->

  feat(geom): add geom_rug marginal edge ticks (#806)

  ggplot2-compatible rug layer: short ticks along panel edges with `sides`
  (`bltr`) and panel-fraction `length`. Builder `.geomRug()` and `<GeomRug />`.

  Migration: none — additive

- a120bed: <!-- markdownlint-disable MD041 -->

  feat: geom_map fortified region join for choropleths (#808)

  Add ggplot2-style `map` geom: join a fortified map table to value rows via
  `aes.map_id` and `params.map` / `params.mapId`. Coordinates from map
  `long`+`lat` or `x`+`y`; optional multipoly `group`. Renders closed filled
  paths per region; missing regions drop with `map-region-missing` warning.

  Intentional subset: no network fetches, no sf/CRS, no public geom_polygon.

  Migration: none — additive

- 3fb062a: <!-- markdownlint-disable MD041 -->

  feat: coord_sf fixed-aspect maps for already-projected data (#809 phase 8)

  Add PortableSpec `{ type: "sf", ratio? }` reusing coord_fixed layout for geom_sf
  maps. Public helpers `coordSf` / `coord_sf`, builder `.coordSf()`, and
  `<CoordSf>`. No CRS reproject or graticules in v1.

  Migration: none — additive

- da5825e: <!-- markdownlint-disable MD041 -->

  # feat: geom_sf_label boxed SF labels (#809 phase 3)

  Add `geom_sf_label`: labels at `stat_sf_coordinates` representative points with
  a measured rounded background box. `color` is ink + box stroke; `fill` is the
  box background. Params: padding, radius, linewidth, size, anchor, dx/dy.

  Builder `.geomSfLabel()` and Svelte `<GeomSfLabel />`. GlyphsBatch optional box
  fields; SVG draws rect then text; hit uses box AABB. Shared path for future
  `geom_label` (#792).

  Migration: none — additive

- 962bf83: <!-- markdownlint-disable MD041 -->

  # feat: geom_sf_text + stat_sf_coordinates labels (#809 phase 2)

  Add `stat_sf_coordinates` (one representative (x,y) per GeoJSON feature) and
  `geom_sf_text` which defaults to that stat and draws `aes.label` at the point.
  Point as-is; MultiPoint/LineString vertex mean; Polygon exterior shoelace
  centroid; Multi* uses the first component only in v1.

  Builder `.geomSfText()` and Svelte `<GeomSfText />`. Requires `aes.label`;
  geometry still as JSON strings in a data column.

  Migration: none — additive

- 2154fe1: <!-- markdownlint-disable MD041 -->

  # feat: geom_sf portable GeoJSON geometries phase 1 (#809)

  Add `geom: "sf"` for already-projected GeoJSON Geometry values stored as JSON
  strings in a data column (default `geometry`). Point/LineString/Polygon and
  their Multi* variants expand to points, open paths, or closed filled rings.
  Interior rings emit a warning; GeometryCollection and mixed families error.

  Builder `.geomSf()` and Svelte `<GeomSf />`. No CRS / `coord_sf` in this phase.

  Migration: none — additive

- 26cfa45: <!-- markdownlint-disable MD041 -->

  feat: public stat_sf as geom_sf default (#809 phase 7)

  Add `KNOWN_STATS` value `"sf"` (ggplot2 `stat_sf` geometry expand) as the
  default for `geom_sf`, and route expand through the normal non-identity stat
  path instead of a geom-only special case.

  `normalize()` rewrites legacy portable `stat: "identity"` on `geom_sf` to
  `stat: "sf"`; draw/hit behavior is unchanged. Canonical stamps use `"sf"`.

  Migration: none — additive

- 1bc9988: <!-- markdownlint-disable MD041 -->

  feat: geom_spoke origin + angle + radius segments (#810)

  Add ggplot2-style `spoke` geom: endpoints derived as
  `xend = x + radius·cos(angle)`, `yend = y + radius·sin(angle)` in data space
  (then the same position transform as x/y). Angle is radians. Reuses segment
  rendering. CHANNELS gain `angle` and `radius`; constants via `params.angle` /
  `params.radius` when not mapped. Continuous x/y required.

  Migration: none — additive

- f08091b: <!-- markdownlint-disable MD041 -->

  feat(#811): stat_ecdf empirical CDF + line curve step-hv

  Add `stat: "ecdf"` on line layers (y defaults to `{ stat: "ecdf" }`) with
  `params.pad` / `params.n`. Prefer `curve: "step-hv"` for right-continuous
  stairs (mid `step` is wrong for ECDFs). Finite-clamp pad (prepend xmin,0;
  ggplot2 uses ±Inf). Shared path-step helper for step-hv / step-vh / mid.

  Migration: none — additive

- dbb883b: <!-- markdownlint-disable MD041 -->

  feat: stat_ellipse bivariate normal confidence rings (#812)

  Add `stat: "ellipse"` on path layers (ggplot2 stat_ellipse, type "norm" only).
  Per-group mean + sample covariance → χ²-scaled ellipse perimeter; segments
  samples + closing duplicate for a closed path ring. Params: level (0.95),
  type ("norm"), segments (51 before close).

  Intentional subset: path-only; type norm only (not t/euclid).

  Migration: none — additive

- 985ae06: <!-- markdownlint-disable MD041 -->

  # feat: stat_unique first-wins aesthetic dedupe (#813)

  Add `stat: "unique"` for identity-capable geoms (point, line, path, text, col,
  area, rect, ribbon, rule, segment, errorbar). Drops duplicate rows on the
  combination of mapped aesthetic fields before drawing; first occurrence wins;
  panel-local.

  Not offered on bar/histogram/density/smooth/boxplot or tile/raster in this
  release.

  Migration: none — additive

- fb9a751: <!-- markdownlint-disable MD041 -->

  # feat: stat_manual portable named per-group transforms (#814)

  Add `stat: "manual"` on point, line, and path with required `params.fun`
  from a portable named registry (`first` | `last` | `mean` | `median` |
  `min` | `max` | `sum`). first/last keep one source row per aesthetic group;
  aggregate funs collapse each group to one synthetic row (x and y aggregated
  independently). No JS callbacks (PortableSpec only).

  Missing `fun` fails loud (`manual-fun-required`); unknown `fun` is schema
  `invalid-enum-value`.

  Migration: none — additive

- c0ba287: <!-- markdownlint-disable MD041 -->

  feat: stat_align shared continuous-x grid for stack (#815)

  Add `stat: "align"` on area and line layers. Union all finite x across groups,
  linearly interpolate each series onto that grid, and set y=0 outside a group's
  range so continuous-x stack/fill aligns.

  Area/Line use own stat unions (not shared IdentityOrUniqueStat).

  Migration: none — additive

- 05b0736: <!-- markdownlint-disable MD041 -->

  # feat: stat_connect named path joins for path/line (#816)

  Add `stat: "connect"` on path and line with `params.connection`
  (`hv` default, `vh`, `mid`, `linear`). Expands successive finite
  points into intermediate vertices so stepped/path displays do not
  rely on geom curve flags alone.

  Path uses data order; line expands after x-sort and skips post-stat
  x-sort so tied-x elbows stay intact. Custom connection matrices
  deferred.

  Migration: none — additive

- 623b9c1: <!-- markdownlint-disable MD041 -->

  # feat: stat_summary_bin continuous x binned y summary (#817)

  Add `stat: "summary_bin"` on point, line, and errorbar — bin continuous x with
  the same break rules as `stat_bin`, then summarize y per non-empty
  (group × bin) with the shared summary fun registry (default mean ± se).

  Emits `x` (bin center), `xmin`/`xmax`, and `y`/`ymin`/`ymax`. Empty bins are
  omitted. No weight channel, no summary_2d/hex in v1.

  Migration: none — additive

- f9690fd: <!-- markdownlint-disable MD041 -->

  feat: convenience geoms jitter, hline, vline (#818)

  Add ggplot2-style geom aliases that normalize to existing marks:

  - `jitter` → `point` + `position: "jitter"` (`geomJitter` / `<GeomJitter>`; flat width/height/seed assemble into `positionParams` at the builder/component boundary)
  - `hline` / `vline` → `rule` (`geomHline` / `geomVline` / components); annotation intercepts suppress plot-aes inheritance; data-driven forms drop the orthogonal axis

  No new mark types.

  Migration: none — additive

- 0c4919c: <!-- markdownlint-disable MD041 -->

  feat(#820): add `bw` / `ThemeBw` complete theme

  Print-friendly white panel, grey grid, and dark rectangular border matching
  the ggplot2 `theme_bw` complete-theme role (clean-room; not R source).
  Available as PortableSpec `theme: "bw"`, builder `.theme("bw")`, and
  `<ThemeBw />`.

  Migration: none — additive

- 769bcbf: # Add theme_linedraw (`linedraw` / ThemeLinedraw)

  Add `linedraw` theme (`theme: "linedraw"`, `<ThemeLinedraw />`) — white panel with black grid, ticks, and panel border for high-contrast line-art / B&W print chrome (#821).

  Migration: none — additive

- d6c72c8: <!-- markdownlint-disable MD041 -->

  feat(#823): add `test` / `ThemeTest` snapshot theme

  Pinned high-contrast complete theme for package tests and VR (ggplot2
  `theme_test` role, clean-room). Available as PortableSpec `theme: "test"`,
  builder `.theme("test")`, and `<ThemeTest />`. Not an alias of product themes.

  Migration: none — additive

- 1a4401d: # Add theme_grey / theme_gray aliases (`grey` / `gray`)

  Register `grey` and `gray` as first-class theme names that share the existing ggplot2 grey-panel token map (`theme: "grey"`, `theme: "gray"`, `<ThemeGrey />`, `<ThemeGray />`). UK/US spellings for ggplot2 `theme_grey` / `theme_gray` muscle memory (#824).

  Migration: none — additive

- 1876fc4: # Add ColorBrewer scale helpers (#825)

  - Palette tables (public ColorBrewer max-n hex) + scheme registration
  - `scale_*_brewer` (discrete), `scale_*_distiller` (continuous), `scale_*_fermenter` (binned)
  - color/colour/fill spellings + Svelte `<ScaleColorBrewer />` etc.
  - `palette` → `scheme`, `direction: -1` → `reverse: true`

  v1 palettes: Set1/2/3, Dark2, Paired, Accent; Blues/Greens/Reds/Oranges/Purples/Greys/YlOrRd/YlGnBu/BuPu; RdYlBu/RdBu/BrBG/Spectral/PuOr.

  Migration: none — additive

- 20b4ddb: <!-- markdownlint-disable MD041 -->

  feat(#828): scale_*_viridis_c/d/b named constructors

  ggplot2-style continuous, discrete, and binned viridis-family helpers for
  color/fill (plus colour aliases and Svelte shells). Discrete scales sample
  evenly across the ramp; `option` selects viridis/magma/plasma/inferno/cividis/turbo.

  Migration: none — additive

- dfbab7c: # Add size area / radius scale family (#830)

  - `sizeUnit`: `"area"` (default continuous), `"radius"` (linear), `"area_zero"` (zero→zero area)
  - Helpers: `scaleSizeArea` / `scaleSizeBinnedArea` / `scaleRadius` / `scaleSizeOrdinal` + snake aliases; bare `scale_size`
  - `maxSize` option on area helpers (default 6) when `range` is omitted
  - Svelte: `<ScaleSizeArea />`, `<ScaleSizeBinnedArea />`, `<ScaleRadius />`, `<ScaleSizeOrdinal />`
  - Range values may be 0 so zero-area bubbles are portable

  Migration: none — additive

- 52d05ee: # Add scale_x_time / scale_y_time time-of-day position scales (#831)

  - New `temporalKind: "time"` for time-of-day (distinct from date/datetime)
  - Helpers: `scaleXTime` / `scaleYTime` / `scale_x_time` / `scale_y_time` + builder methods
  - Portable numbers are **seconds since midnight** → epoch ms on 1970-01-01Z; Date values use UTC clock portion
  - Default axis labels use `%H:%M:%S`; tick intervals prefer hour/minute/second
  - Svelte: `<ScaleXTime />` / `<ScaleYTime />`

  Migration: none — additive

- 0c12fcb: # Add bare scale_alpha / scale_linewidth and ordinal style aliases (#832)

  ggplot2 ergonomics for style scales:

  - Bare `scale_alpha` / `scale_linewidth` → continuous helpers
  - `scale_alpha_ordinal` / `scale_linewidth_ordinal` / `scale_shape_ordinal` (and camelCase peers) → existing discrete helpers (`type: "ordinal"`)
  - Svelte re-exports: `<ScaleAlphaOrdinal />`, `<ScaleLinewidthOrdinal />`, `<ScaleShapeOrdinal />` (same shells as Discrete)

  Deferred: `scale_shape_continuous` / `scale_linetype_continuous` (ggplot2 warns/errors).

  Migration: none — additive

- 4771f3e: <!-- markdownlint-disable MD041 -->

  feat(#833): multi-aes identity/manual helpers + scaleType

  Add `scale_continuous_identity`, `scale_discrete_identity`, and
  `scale_discrete_manual` that expand across aesthetics into PortableSpec
  `scales`, plus a small `scaleType()` registry for default family selection.

  Migration: none — additive

### Patch Changes

- 5ad437b: # Add geom_abline slope/intercept reference lines

  Annotation-only `geom: "abline"` with `params.slope` (default 1) and `params.intercept` (default 0). Clips y = intercept + slope·x to continuous panel domains and emits a segment batch. Builder `.geomAbline()` and `<GeomAbline />` (#790).

- cb8ba46: <!-- markdownlint-disable MD041 -->

  feat: GeometryCollection expand for geom_sf (#809 phase 6)

  Flatten GeoJSON GeometryCollection (recursively) to leaf point/line/polygon
  geometries for draw and labels. Homogeneous collections render; mixed families
  still raise sf-geometry-mixed. Compatible with even-odd holes and Multi* labels.

  Migration: none — additive

- 5584a49: <!-- markdownlint-disable MD041 -->

  feat: multi-part SF labels via stat_sf_coordinates (#809 phase 5)

  MultiPoint / MultiLineString / MultiPolygon expand to one label per geometry
  part (exterior centroid / vertex mean). Duplicates feature aesthetics onto each
  part.

  Migration: <https://ggsvelte.sh/guide/statistics-positions#sf-text-labels-geom-sf-text>

- 757b3f5: <!-- markdownlint-disable MD041 -->

  feat: geom_sf polygon holes via even-odd rings (#809 phase 4)

  Interior GeoJSON rings are drawn as even-odd holes (SVG/canvas/hit-test).
  Removes the `sf-holes-ignored` warning. No CRS/coord_sf yet.

  Migration: none — additive

- be9687f: # Add theme_void / ThemeVoid chrome-free theme

  Add `theme: "void"` / `<ThemeVoid />` (ggplot2 theme_void) — no axes, grid, or panel chrome for maps and pure-mark composition (#822).

  New theme tokens `labelsX` / `labelsY` gate axis tick labels (and layout margin) so void can suppress text without changing tick-mark behavior on existing themes.

- 6ff72f5: # Add scale_*_gradient / gradient2 / gradientn helpers

  ggplot2-shaped continuous colour constructors for color and fill: two-stop `gradient`, three-stop diverging `gradient2`, and n-stop `gradientn` (colours/colors/values). Map onto sequential scales with explicit range (#826). No asymmetric `midpoint` domain remapping in v1.

- 8114eb2: # Add scale_*_steps / steps2 / stepsn helpers

  ggplot2-shaped binned continuous colour constructors for color and fill: two-stop `steps`, three-stop diverging `steps2`, and n-stop `stepsn`. Map onto `type: "binned"` with explicit hex range (#827). No midpoint domain remapping in v1.

- 8f75eb3: # Add scale_*_hue / grey / gray / ordinal discrete colour helpers

  Register portable schemes `hue`, `grey`, and `gray`, plus ggplot2-shaped constructors for color and fill. Custom hue h/c/l or grey start/end bake a 10-stop range; defaults use named schemes. `scale_*_ordinal` aliases discrete (#829).

- 57d6688: <!-- markdownlint-disable MD041 -->

  fix: trim canvas-scatter showcase so VR smoke stays under budget (#926)

  Reduce the gallery specimen from 10k to 2.5k marks (still above
  `CANVAS_AUTO_THRESHOLD`) so Playwright VR/gallery capture finish without a
  180s timeout mask. Wall time under headless Chromium scaled roughly with mark
  count (~156s at 10k → ~42s at 2.5k).

  Migration: none — docs/example display density only; no public API change.

- 1f60f29: <!-- markdownlint-disable MD041 -->

  fix: humanize default axis and legend titles from field names (#961)

  When `labs` omits a channel, guide titles now use `humanizeFieldTitle` —
  camelCase/snake_case field names become sentence case (`bloomRefDate` →
  `Bloom ref date`). Single-token names (`year`, `Region`, `count`) stay as
  authored. Explicit `labs` values (including `""` to hide) are unchanged.

  Also exports `spaceFieldName` / `humanizeFieldTitle` from `@ggsvelte/core`;
  tooltip `<dt>` labels share the spacing helper.

  Migration: none — additive

  Default axis/legend titles for multi-word field names change from raw
  identifiers to sentence case (e.g. `bloomRefDate` → `Bloom ref date`). Set
  `labs` explicitly to keep a previous string.

- 4428488: <!-- markdownlint-disable MD041 -->

  refactor(spec): extract style scale data checks from dataChecks

  Move shape/linetype and size/linewidth/alpha scale compatibility (including
  temporal numeric styles and scaled constants) into validate-data-checks-style.ts
  so style-scale work no longer lands in the dataChecks layer-walk orchestrator.
  Public validate() behavior is unchanged.

## 0.11.1

## 0.11.0

### Patch Changes

- 846ee50: <!-- markdownlint-disable MD041 -->

  fix: boxplot default width matches ggplot2 and caps few-category slabs

  Use ggplot2's 0.75 band-step fraction (not bar's 0.9) and, when `width` is
  omitted, cap boxes at 15% of panel width so 2–3 category charts stay
  distribution-shaped (#653). Explicit `params.width` still uses the uncapped
  fraction.

  Migration: none for callers who set `width`. Default-only plots with few
  categories render narrower boxes.

## 0.10.2

## 0.10.1

## 0.10.0

### Minor Changes

- 69415d9: <!-- markdownlint-disable MD041 -->

  feat: portable within-mark gradients and bounded glow (#591)

  Add a closed JSON-serializable paint vocabulary on compatible geom params
  (`fillPaint`, `strokePaint`, `glow`) with deterministic linear/radial gradients,
  ordered hex color stops, required solid fallbacks, and bounded glow radii.

  Migration: none — additive

### Patch Changes

- 5d04e1f: <!-- markdownlint-disable MD041 -->

  fix: remaining multi-table edges after per-layer DataRef

  Binned axes and fixed histogram bin ranges read each layer filtered table;
  transform diagnostics count filtered (not unfiltered) rows; scale validation
  keeps per-layer field evidence; boxplot outlier lineage is not double-remapped
  under facets; Svelte identity epochs fingerprint geom-child data props.

  Migration: none — corrects multi-table behavior under per-layer data

- 127e3fc: <!-- markdownlint-disable MD041 -->

  fix: channel-wide censor recovery for temporal numeric styles

  parseFailure: "censor" on size/linewidth/alpha now recovers all-invalid
  fields and constants when a sibling field or scaled constant trains the
  shared scale (parity with runtime channel collection).

- 59232e8: <!-- markdownlint-disable MD041 -->

  fix: segment endpoint grouping, binned extent, auto-hit, validation

  - Exclude xend/yend from default discrete grouping
  - Gate binned-axis endpoint fields to segment layers only
  - Preserve geometry-based auto hit mode for geom segment
  - Reject non-field segment endpoint mappings at validate time

- 92e7049: <!-- markdownlint-disable MD041 -->

  fix: multi-table DataRef post-merge edges from #603

  - Seed named table cache from plot-level named data
  - Deduplicate plot+layer named refs in validation maxRows
  - Snapshot data on builder .layer()
  - Unify binned style binExtent across layers
  - Gate legend rowFilters to layers that map the scale field
  - Skip globalSourceRows retention on annotation frames

- ae74d06: <!-- markdownlint-disable MD041 -->

  fix(spec): validate binned style breaks monotonicity and domain agreement (#599)

  Reject binned size/linewidth/alpha/shape/linetype scales whose authored `breaks`
  are non-finite or not strictly increasing, and reject specs where both `domain`
  and `breaks` are authored with disagreeing endpoints — pre-empting runtime
  `style-binned-breaks` / `style-domain-invalid` with targeted validation codes
  `scale-binned-breaks` and `scale-binned-domain`.

  Migration: none — additive diagnostics for specs that already failed at render

## 0.9.0

### Minor Changes

- e45a6a5: # Facet value order, labels, and strip position

  Extend facet field configuration with JSON-serializable options for closed panel order, display labels, and strip placement (issue #590).

  - `facet.wrap|rows|cols.levels` — closed explicit panel order (empty panels for missing levels; unknown data values diagnosed and excluded)
  - `facet.wrap|rows|cols.labels` — display-label map (identity keys stay semantic)
  - `facet.strip.position` — `top` (default) | `bottom` | `left` | `right`; left/right bands are measured and reserved in layout
  - `facet.strip.show` — set `false` to hide strip chrome when labels are authored elsewhere

  Migration: none — additive

  Defaults preserve ascending sort and top strips.

- 463adcf: # Fixed-aspect coordinates

  Add strict `coordFixed`/`coord_fixed`/`coordEqual` authoring and fit exact physical data-unit ratios inside responsive chart chrome. Fixed-scale facets keep equal panels, free positional facets fail early, theme-owned letterbox gutters render consistently across Core and Svelte, and constrained layouts preserve ratio with an explicit degraded diagnostic.

  Migration: <https://ggsvelte.sh/guide/upgrading#0-8-to-0-9>

  Replace outer-wrapper CSS aspect-ratio workarounds with `coord={coordFixed()}`. Fixed coordinates now reject free positional facet scales; use fixed facets or remove the fixed coordinate.

- 6179954: <!-- markdownlint-disable MD041 -->

  feat: add geom segment for finite two-endpoint lines (x,y → xend,yend)

  Migration: none — additive

- f8723b4: <!-- markdownlint-disable MD041 -->

  feat: optional per-layer `data` (DataRef) with multi-table pipeline support

  Migration: none — additive

  Layers may supply their own `{values}` / `{columns}` / `{name}` data; when
  omitted they inherit plot-level data. Shared scales train over the union of
  layer tables, facets replicate annotation layers that omit facet fields, and
  `model.row()` resolves global multi-table source ids. Builder and declaration
  geom sugar accept layer `data` as well.

### Patch Changes

- fd28b89: <!-- markdownlint-disable MD041 -->

  fix: align temporal color censor recovery with runtime channel training

  parseFailure: "censor" on sequential/binned color now recovers from
  channel-wide training sources (sibling fields, scaled constants), parseable
  domain endpoints, and parseable binned breaks — matching collectColorChannelValues
  and sequential/binned train behavior.

## 0.8.0

### Minor Changes

- 43e05b8: # Complete mapped style aesthetics

  Add complete mapped size, linewidth, alpha, shape, and linetype scale plumbing across strict authoring helpers, grouping, stats, SVG/Canvas/SSR rendering, style-aware legends, inspection, and hit testing.

  Discrete and binned style mappings now participate in implicit grouping. Review layered path geoms and add an explicit `group` mapping where style categories are descriptive rather than structural. Mapped `alpha` is the complete opacity aesthetic rather than a value multiplied by a scalar geom `alpha`; set the scale range to bound mapped opacity.

  Migration: <https://ggsvelte.sh/guide/upgrading#0-7-to-0-8>

- afaaeeb: <!-- markdownlint-disable MD041 -->

  feat: add geom ribbon for precomputed interval bands (x+ymin+ymax or y+xmin+xmax)

  Migration: none — additive

- fcc8ad0: # Responsive guide presentation

  Add strict scale-local and top-level guide APIs, responsive right/bottom guide layout, semantically safe discrete-guide merging, guide theme roles, and merged legend interactions.

  Migration: <https://ggsvelte.sh/guide/upgrading#0-7-to-0-8>

- 737ca85: # Add geom rect, tile, and raster to PortableSpec and all renderers

  Migration: none — additive

  - `rect` maps arbitrary regions with `xmin`/`xmax`/`ymin`/`ymax`
  - `tile` draws center-sized cells (band or continuous) with optional width/height
  - `raster` draws equal-cell dense grids with fill and no per-cell stroke
  - Builder: `geomRect` / `geomTile` / `geomRaster`; Svelte: `<GeomRect>` / `<GeomTile>` / `<GeomRaster>`
  - Mapped color outlines use `strokes[]` on rect batches; tile/raster use center candidate anchors

## 0.7.1

### Patch Changes

- bbe65c7: <!-- markdownlint-disable MD041 -->

  feat: author `scales.*.guide` pins for band axis label layout

  Optional `{ mode, angle, wrap }` on position scales locks categorical label
  presentation (single / wrap / rotate / off) instead of auto-escalation.
  Advisories now point at `scales.x.guide` as the howToOverride surface.

- 4e5b875: <!-- markdownlint-disable MD041 -->

  Extract builder authoring data conversion into builder-data.ts and split the long temporal scale API tests into schema vs authoring files. Public builder exports are unchanged.

- 3f16ec8: <!-- markdownlint-disable MD041 -->

  Extract fluent builder geom option types and scale sugar into focused modules, and split position-scale schema vs helper tests. Public gg()/GGBuilder API is unchanged.

- e6d5f6f: <!-- markdownlint-disable MD041 -->

  Extract the pure LINT_CATALOG into lint-catalog.ts (error-catalog pattern) and split the long lint test suite into rules vs wiring files. Public lint imports are unchanged.

- 72b01ee: <!-- markdownlint-disable MD041 -->

  Split lintSpec into layer and scale rule modules, guard schema-invalid scale entries so lint never throws, and keep catalog source-scan coverage multi-file. Public lintSpec behavior is otherwise unchanged.

- 6afccdc: <!-- markdownlint-disable MD041 -->

  Split normalize scale and coordinate canonicalization into dedicated modules behind the existing normalize() entry. Public normalize/normalizeChannel exports and behavior are unchanged.

- c4f91d0: <!-- markdownlint-disable MD041 -->

  Split strict portability checks from lossy tooling conversion, with co-located tests. Public isPortable/toPortable/toPortableLossy surface is unchanged.

- 29f0565: <!-- markdownlint-disable MD041 -->

  Split scale authoring helpers into position and color modules with a thin facade, and split the long tier-2 validate suite by concern. Public scale-helper import paths and validation behavior are unchanged.

- 1fed2f3: <!-- markdownlint-disable MD041 -->

  Split temporal guides into interval grammar/labels and tick generation behind a stable temporal-guides facade. Public package exports and interval tick behavior are unchanged.

- 9a366cf: <!-- markdownlint-disable MD041 -->

  Split value-level temporal parsing into core, exact-format, and named-engine modules, and co-locate format plus tier-2 temporal scale tests. Public parseTemporal surface is unchanged.

- ec7f21b: <!-- markdownlint-disable MD041 -->

  Split temporal parsing into parse engines, column inference, and a thin authoring facade so domain edits do not require reading the full module. Public package exports and `./temporal.js` re-exports are unchanged.

- a54932c: <!-- markdownlint-disable MD041 -->

  Split the long temporal characterization suite into parse, column, and helpers test files co-located with the temporal production modules. No runtime behavior change.

- d1f69cb: <!-- markdownlint-disable MD041 -->

  Split tier-2 dataChecks into position, color, and shared temporal modules, and co-locate color data-aware validation tests. Public validate() behavior is unchanged.

- 9affbb6: <!-- markdownlint-disable MD041 -->

  Split tier-1 TypeBox error mapping into schema/path walk helpers and the agent SpecError mapper. Public validate() surface and error messages are unchanged.

- 571721f: <!-- markdownlint-disable MD041 -->

  Extract channel/DataRef form classification from the TypeBox error mapper and split temporal decision-reuse tier-2 tests into their own file. Public validate() behavior is unchanged.

- f5a8919: <!-- markdownlint-disable MD041 -->

  Split TypeBox path-group error mapping into union classification and keyword handlers. Public validate() agent diagnostics are unchanged.

- 09e6954: <!-- markdownlint-disable MD041 -->

  Extract tier-1 schema shape walks into a focused module with shared GEOM_BRANCHES, and co-locate temporal tier-2 tests with decision-reuse vs position-scale production modules. Public validate() behavior is unchanged.

- 3231dc7: <!-- markdownlint-disable MD041 -->

  Split data-free structural validation into layer, color-scheme, and facet modules behind a stable validate-structure barrel. Public validate() behavior is unchanged.

## 0.7.0

### Minor Changes

- ff4ad4c: # Generic color and fill scale families

  Add complete color/fill scale families with binding-identical color/colour helpers, transformed and temporal ramps, deterministic binned colorsteps, manual and identity mappings, explicit NA/unknown policies, and serializable discrete/colorbar/colorsteps GuidePlans.

  `RenderModel.guidePlans` is now a union: narrow on `plan.type === "axis"` before reading axis-only fields. Explicit continuous color domains censor out-of-domain values by default; set `oob: "squish"` to clamp. See the [0.6 to 0.7 migration guide](https://ggsvelte.sh/guide/upgrading#0-6-to-0-7).

  Migration: <https://ggsvelte.sh/guide/upgrading#0-6-to-0-7>

### Patch Changes

- c44f6bc: <!-- markdownlint-disable MD041 -->

  Measured categorical (band) x-axis label layout. Long `geom_col`/`geom_bar` category labels now wrap onto two lines, then rotate (−45°/−90°), instead of overlapping each other and the axis title — every bar keeps its label. When rotation still can't fit, labels truncate with the full text on the tick `<title>`, and a diagnostic suggests `coord_flip` for horizontal bars. The planner never auto-flips the chart and never thins a low-cardinality axis; vertical (coord_flip) categorical axes keep their existing behavior.

## 0.6.0

### Minor Changes

- 82b3a4d: # Pre-stat position transforms and positional scale families

  Add canonical identity, log10, and square-root position transforms; continuous and binned scale helpers with ggplot2 aliases; source-limit OOB policies; transformed-space stats/positions; semantic guides and interaction inversion; binned count/stack/dodge identities; and default 5% non-temporal expansion.

  Migration: <https://ggsvelte.sh/guide/upgrading#0-5-to-0-6>

  Authored `type: "log"` now canonicalizes to `{ type: "linear", transform: "log10" }` and runs before statistics. Pinned domains censor before stats by default, position and numeric-bin parameters use transformed-space units, and trained/guide/interaction contracts report family `linear` plus `transform`. Use `expand: { mult: 0, add: 0 }` for flush bounds.

- 6b8f64b: # Post-stat coordinate transforms and curved topology

  Add canonical `coordTransform`/`coord_transform` APIs for independent identity, log10, and square-root coordinate projection after statistics; semantic coordinate limits and reversal; optional panel clipping; projected axes/grids; adaptive path and segment tessellation; and coordinate-before-scale interaction inversion.

  Migration: none — additive

  Coordinate transforms are intentionally distinct from scale transforms: use `scaleXLog10()` when statistics should consume log-space values, and `coordTransform({ x: "log10" })` when statistics should remain in scale space and only final geometry should be projected.

### Patch Changes

- cd7457c: <!-- markdownlint-disable MD041 -->

  Split the TypeBox schema module into name registries, ordered `$defs` declarations, pipeline catalogs, and a thin Cyclic/Module facade. Public exports and `schema/v0.json` are unchanged.

- ed09958: <!-- markdownlint-disable MD041 -->

  Point package homepages and runtime diagnostic guidance at the canonical `https://ggsvelte.sh` documentation origin after the hosting cutover.

## 0.5.1

### Patch Changes

- 85f5b5a: <!-- markdownlint-disable MD041 -->

  Map scale-diagnostic severity onto the CLI stderr `kind` field 1:1 so error-severity diagnostics emit `kind: "error"` instead of being demoted to `warning`.

## 0.5.0

### Minor Changes

- 78c1942: # Temporal guide plans

  Add measured temporal axis plans with calendar-aligned automatic breaks, contextual and complete labels, explicit interval/minor-break controls, locale/timezone formatting, stable diagnostics, and per-panel `RenderModel.guidePlans` inspection.

  Migration: none — additive

### Patch Changes

- 087a4b1: <!-- markdownlint-disable MD041 -->

  Point published package metadata at the live documentation site and identify each package's monorepo directory.

## 0.4.0

### Minor Changes

- cfafdd1: # Temporal scale semantics

  Add strict, value-driven date and datetime scales across PortableSpec, fluent builder, and Svelte authoring. Raw four-digit year strings now infer a proportional UTC calendar axis after whole-column validation; ambiguous date orders and identifier-like values remain discrete until explicitly configured.

  Add deterministic named, exact-format, epoch, timezone, and DST-disambiguation parsers; parser-keyed immutable table views; structured scale decisions and diagnostics; ggplot2-style scale aliases; and lubridate-style authoring helpers. Preserve original source values for interactions while using semantic epoch values before stats, positions, scale training, and rendering.

  Migration: <https://ggsvelte.sh/guide/temporal-scales>

  If a four-digit string field is an identifier rather than a calendar year, set the position scale to `type: "band"`, call `scaleXDiscrete()` / `scaleYDiscrete()`, or use the equivalent snake_case alias. Ambiguous DMY/MDY input now requires an explicit parser such as `parse: "dmy"` or `parse: "mdy"`.

## 0.3.1

### Patch Changes

- 2b2f55c: # Keep RuntimeSpec aligned with PortableSpec

  Project the runtime plot and layer types from their portable counterparts so
  portable fields such as `edition`, `facet`, `coord`, `a11y`, and layer `render`
  are visible through `RuntimeSpec`. Runtime-only `{ fn }` channel accessors remain
  type-level and conversion features; the rendering pipeline does not execute
  them.

- 437ff12: # Enforce theme and palette compatibility

  Reject named color schemes that do not match their ordinal or sequential scale type, and reject unsupported custom color syntax before rendering. When `type` is omitted, a named scheme now selects its ordinal or sequential family instead of being silently ignored or misused. Custom ranges accept `#rgb` and `#rrggbb`; three-digit stops normalize to lowercase six-digit hex so sequential interpolation cannot emit malformed colors.

  Migration: replace categorical schemes on sequential scales with `viridis` or a custom hex range; replace `viridis` on ordinal scales with a categorical scheme or custom hex range. Replace named or functional CSS colors in `scales.color.range` and `scales.fill.range` with equivalent `#rgb` or `#rrggbb` values.

## 0.3.0

### Patch Changes

- f63e498: # Compile plot schema validation

  Compile and reuse the plot schema validator so large inline datasets no longer block rendering during validation.

- 378f73c: # Preserve precise TypeBox union diagnostics

  Report extra channel and data keys against the active union form, reject named
  references inside inline-only dataset entries, and preserve the generic
  `SpecModule.Import` signature used by downstream TypeScript consumers.

- 0a7b872: # Migrate schema runtime from @sinclair/typebox 0.x LTS to typebox 1.x

  Replace the LTS `@sinclair/typebox` package with the active `typebox` 1.x line
  (same author; official Latest). Regenerates `schema/v0.json` and rewires
  runtime validation/error mapping for the 1.x Value API. PortableSpec shapes
  and the public validate()/builder surface are unchanged.

## 0.2.0

### Patch Changes

- f171d83: # Honor options.limits in standalone lintSpec, plus lint performance

  Standalone `lintSpec` previously always passed the default validate limits to
  field-evidence resolution, so raising or lowering `maxRows`/`maxBytes` via
  `options.limits` had no effect; it now merges `options.limits` the same way
  `validate()` does. Linting also short-circuits `isPortable` on the first issue
  and shares field evidence between data checks and lint instead of resolving it
  twice.

## 0.1.1

### Patch Changes

- 6b3b581: # Installable registry dependencies

  Publish registry-compatible internal dependency ranges and verify release-shaped tarballs with npm, matching the actual Changesets publishing path.

## 0.1.0

### Minor Changes

- c7aecaa: # First public release

  Publish the first public ggsvelte release: a Svelte 5 grammar of graphics with strong defaults, ggplot2-inspired themes and palettes, responsive bounded rendering, agent-friendly portable specs and diagnostics, hybrid SVG/canvas output, accessible opt-in inspection and brushing, complete interaction documentation, and a release-gated compatibility and quality matrix.

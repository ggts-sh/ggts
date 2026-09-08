# @ggts-sh/core

## 0.43.0

### Minor Changes

- b68b75c: Share interaction behavior between React and Svelte, render React charts during SSR, and qualify both adapters as installed packages. Add typed React grammar children and complete framework examples.

  Add `ggts check` and `ggts render`, move teaching datasets to `@ggts-sh/core/data` with the Svelte compatibility export, and document the shared agent sandbox workflow in one skill package.

  Rename all seven packages from `@ggsvelte/*` to `@ggts-sh/*`, rename the Svelte migration executable to `ggts-codemod`, and serve documentation at `https://ggts.sh`. Existing old-scope installations remain available.

  Migration: https://ggts.sh/guide/upgrading#0-42-to-0-43

### Patch Changes

- Updated dependencies [b68b75c]
  - @ggts-sh/spec@0.43.0

## 0.42.0

### Patch Changes

- @ggsvelte/spec@0.42.0

## 0.41.0

### Minor Changes

- 4edbf48: New `@ggsvelte/core/svg-live` entry: `mountSceneSvg(root, scene)` mounts a computed scene as live, patchable SVG. `update(nextScene)` diffs the scene against the mounted one and patches attributes positionally in place — same-skeleton data updates no longer re-render the string and swap the DOM subtree; any structural change (signature mismatch) falls back to a full remount, so output is always identical to a fresh render. Intended for interactive/live-update hosts; initial mount reuses the string renderer, so mount cost and output are unchanged.

  Migration: none — additive entry point. `renderToSVGString` behavior is unchanged.

### Patch Changes

- @ggsvelte/spec@0.41.0

## 0.40.0

### Minor Changes

- d798f17: Add Crameri v8.0.1 categorical `*S` palettes and cyclic `*O` ramps. Cyclic schemes need an explicit domain period and wrap out-of-bounds.

  Migration: none — additive

### Patch Changes

- 23ac1af: Discrete colour legends on line, path, and step layers draw stroke segments instead of filled squares. A constant aes linetype appears on the matching key.

  Migration: none — internal colour-legend key style for line geoms

- 5e7dd00: Discrete colour legends on line-only plots keep stroke keys when linetype is mapped on a hidden or separate guide.

  Migration: none — internal colour-legend key style when linetype is mapped

- Updated dependencies [d798f17]
  - @ggsvelte/spec@0.40.0

## 0.39.0

### Minor Changes

- 799be44: Add `registerDefaultOrdinalColor()` for headless charts that use the built-in categorical palette or an explicit range. This registration keeps named categorical, ColorBrewer, sequential, and Crameri catalogs out of lean bundles; use `registerOrdinalColor()` when a spec selects a named scheme.

  Migration: none — additive.

### Patch Changes

- @ggsvelte/spec@0.39.0

## 0.38.2

### Patch Changes

- 18b49bd: Categorical color and fill scale training now skips redundant catalog lookups across adjacent runs, reducing pipeline time for long-form series data without changing first-seen scale domains.
- 488756c: Skip trimmed-string allocation when classifying ordinary ASCII categorical labels.
  - @ggsvelte/spec@0.38.2

## 0.38.1

### Patch Changes

- 8e99a6f: Headless charts now register the categorical axis planner only when they need a band axis. `@ggsvelte/core/render` and `registerBasic()` still install it.
- fa8f552: Headless charts now register color scale kinds the same way they register geoms. `@ggsvelte/core/render` and `registerBasic()` still install every kind.
- f6cc615: Headless charts now register continuous legend builders only with sequential or binned color. `@ggsvelte/core/render` and `registerBasic()` still install them.
- fa38a7e: Headless `runPipeline` now ships only the `default` and `void` theme tables. Named themes still resolve from `@ggsvelte/core` and `@ggsvelte/core/render` with no new caller argument.
- 7d2320b: Headless charts now register size/shape style scale families only when they map those aesthetics. `@ggsvelte/core/render` and `registerBasic()` still install both families.
  - @ggsvelte/spec@0.38.1

## 0.38.0

### Minor Changes

- eded7a2: Export `temporalGuideTypeMismatchError` so render and validate share one temporal-guide type check.

  Migration: none — additive

### Patch Changes

- fe365d1: Identity-stat stacked and filled columns now inspect the post-position height, so fill tooltips show shares and Total sums those shares.
- b3280eb: Reject temporal break and label options on an explicit band scale during render, matching validate().
- Updated dependencies [eded7a2]
- Updated dependencies [b3280eb]
  - @ggsvelte/spec@0.38.0

## 0.37.1

### Patch Changes

- 0de1c9c: # Draw constant-size canvas circles without per-point style objects

  Migration: none — internal. Same `moveTo` + `arc` + batched fill commands.

  The competitive colored scatter path allocated a geometry object per point via `resolvePointMark`. Filled circles of one size now write the path commands directly.

- f390b78: Cut high-volume categorical Canvas scatter paint time by rasterizing oversized circle batches through a cached scratch canvas.
- 9ca1d4e: # Defer identity-scatter grouping until inspect

  Migration: none — internal. Same group ids when inspect or the identity index reads them. Lines, stats, and dodge/stack still group during bind.

  Identity `geom_point` never buckets by group to draw. `buildFrame` no longer interns discrete color into a per-row id vector on that path. The first read of `groups` / `inputGroups` derives the same first-seen ids as before.

- 0d5b6f7: Skip RenderModel-only contract assembly when rendering a plot to an SVG string.
- 7a5b1a8: # Pack continuous scatter points in one pass

  Migration: none — internal. Same pixels, dropped rows, and source row indexes. Band scales and positional offsets still use the two-pass collector.

  Continuous identity scatter no longer allocates intermediate normalized x/y buffers. Normalize, drop non-finite positions, and write pixel coords in one loop — the same shape as the multi-series line hot path.

- d22be72: # Store categorical point colors as palette indexes

  Migration: none — internal. Same resolved fills. Continuous high-cardinality ramps still emit a string per mark.

  Categorical identity scatter no longer allocates a hex string per point. The batch keeps a short palette and a `Uint8Array` of indexes. Canvas fills once per palette entry.
  - @ggsvelte/spec@0.37.1

## 0.37.0

### Minor Changes

- 8cf6e4e: Add side-effect-free headless rendering and tree-shakeable basic geom registration subpaths.

  Migration: none — additive

### Patch Changes

- @ggsvelte/spec@0.37.0

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

### Patch Changes

- Updated dependencies [fa6f795]
  - @ggsvelte/spec@0.36.0

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

### Patch Changes

- Updated dependencies [5dea633]
  - @ggsvelte/spec@0.35.0

## 0.34.4

### Patch Changes

- 5b6f317: Fix geom_qq_line Inspect: mid-stroke hover no longer teleports between line ends, and tooltips show theoretical/sample quantiles instead of a blank value row.

  Migration: none — bugfix.

- 8e07451: Fix y-axis title placement: position relative to the panel grid (`gridLeft - titleOffset`) instead of a hardcoded SVG `x=12`, so the title tracks the left margin and clears wide tick labels.
- Updated dependencies [8e07451]
  - @ggsvelte/spec@0.34.4

## 0.34.3

### Patch Changes

- 3b04a07: Fix geom_dotplot Inspect tooltips: hybrid identity+after_stat candidates now expose per-dot x (bin center) and stackpos instead of printing "–" for every mark.
- df6cb6a: Fix position-fill tooltips that printed absurd percentages (e.g. "87300%") by publishing post-position proportions as candidate y values, and emit a `percent-labels-out-of-range` advisory when scale labels are percent formats on non-proportion domains.
- 86964d8: Discrete colour/fill legend keys for point-family layers now use the layer's constant shape (param, aes constant, or default circle) instead of anonymous coloured squares, so multi-layer charts like Snow cholera (grey death points + red pump crosses) stay readable without colour alone.
- Updated dependencies [df6cb6a]
  - @ggsvelte/spec@0.34.3

## 0.34.2

### Patch Changes

- b1e675b: Drop Minard ring-anchor / false linked-selection guidance; teach independent dual panels when series cardinalities differ.

  Migration: none — skill reference only.

- Updated dependencies [b1e675b]
  - @ggsvelte/spec@0.34.2

## 0.34.1

### Patch Changes

- f93cc00: Document Minard-class ring-anchor points in multi-layer hit hygiene guidance.

  Migration: none — skill reference only.

- Updated dependencies [f93cc00]
  - @ggsvelte/spec@0.34.1

## 0.34.0

### Minor Changes

- cbb25bb: # Gate axis-inspect Total to stack/fill; clarify Playfair wheat chart

  Migration: none — additive (`RenderModel.layerPositions`). Parallel multi-series
  (identity/dodge) no longer show a default tooltip **Total** row —
  `groupTotal` is `null` when the axis group has no stack/fill layer; hosts that
  read `groupTotal` for comparison series must treat `null` as “no composition
  total.” Stacked and filled compositions still sum unique series contributions.

  Why: summing non-additive series (e.g. wheat price + weekly wage) invented a
  meaningless total. The gallery multi-series Playfair example now names units
  (quarter ≈ 8 bushels vs week) and a companion labor-cost ratio chart plots
  weeks of work per quarter.

### Patch Changes

- @ggsvelte/spec@0.34.0

## 0.33.0

### Minor Changes

- f1aa36d: # CLI host inspect intent (`--inspect`) closes the agent interaction gap

  Agents that only run `ggsvelte-render` never saw inspect×geom advisories
  (`INTERACTION_INSPECT_X_ON_COL`, …) because those fired only through Svelte
  `ondiagnostic`. Inspect mode stays host-only (not PortableSpec).

  - `ggsvelte-render --inspect auto|exact|x|y|xy` declares host intent and emits
    bar/col x-guide pure-collector codes on stderr with `source: "interaction"`.
  - Pure collectors and catalog messages for those codes live in `@ggsvelte/core`
    (`collectInspectIntentDiagnostics`, `INSPECT_GEOM_DIAGNOSTIC_CATALOG`); the
    Svelte host re-exports them so host and CLI share one implementation.
  - Alias geoms (`histogram`→`bar`) are rewritten so CLI matches host normalize.
  - Skill + CLI README document what the CLI covers vs host-only interaction.

  Migration: none — additive. Default render without `--inspect` is unchanged.

- f6cad53: Prefer exact inspect auto-mode for violin/boxplot/interval geoms, and advise when freescrolling x/y/xy guides are used on those band marks. Adds INTERACTION_INSPECT_AXIS_ON_* diagnostic codes (Migration: none — additive).

### Patch Changes

- 817efae: # Inspect x-guide advisories under coord_flip (#1409)

  Product decision: mode `x`/`xy` bar/col advisories still fire under
  `coord_flip`. The crosshair tracks the data-x band even when the guide is
  horizontal on screen, so it still cuts the filled mark.

  Catalog messages no longer claim the guide is always "vertical"; they name
  `coord_flip` so agents do not treat flip as a free pass to keep x/xy inspect
  on bar/col.
  - @ggsvelte/spec@0.33.0

## 0.32.1

### Patch Changes

- b6a2e33: Remap radial layout axis ticks through `scalesForCoordExpand` so expand:false / theta·r limits match sector fill (not the padded trained domain).
  - @ggsvelte/spec@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [9f9fafd]
  - @ggsvelte/spec@0.32.0

## 0.31.2

### Patch Changes

- a740c50: # Unit-aware temporal axisFormatters for pin and tooltip

  Migration: none for authored labels — `dateLabels` / `labels` still override. **Default** tooltip header and floating crosshair axis labels now follow column precision (year → `1835`, month → `2024-07`, day → `2024-07-09`) instead of always stamping a calendar day or full datetime. Empty-space pins on year charts no longer show `1835-01-01`.

  Axis tick **spacing** is unchanged; only the shared `axisFormatters` default pattern tracks the channel unit.
  - @ggsvelte/spec@0.31.2

## 0.31.1

### Patch Changes

- @ggsvelte/spec@0.31.1

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

### Patch Changes

- Updated dependencies [890a462]
- Updated dependencies [493e941]
  - @ggsvelte/spec@0.31.0

## 0.30.2

### Patch Changes

- @ggsvelte/spec@0.30.2

## 0.30.1

### Patch Changes

- @ggsvelte/spec@0.30.1

## 0.30.0

### Minor Changes

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

- d3250a9: # Cut multi-series line / ordinal color mount cost

  Migration: none — same marks, group ids, and ordinal color assignments; competitive canvas adapter only changes harness chrome (void + color guide none) and data feed (named ref).

  Further #1468 hot-path work: `fieldType` reuses lean parse decisions (no second typeof walk); ordinal color training skips materializing a 30k values array when the source catalog is enough; continuous line geometry can bucket+pixel-map in one normalize pass; solid multi-series canvas strokes take a monomorphic path; identity frames fill `rowIndex` without `Uint32Array.from` callbacks. Competitive canvas mount uses named data + theme_void + `{ type: "none" }` color guide so legend layout is not paid on a marks-only fixture.

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

- Updated dependencies [70971d9]
- Updated dependencies [5249477]
- Updated dependencies [796cb50]
- Updated dependencies [70971d9]
- Updated dependencies [796cb50]
- Updated dependencies [796cb50]
  - @ggsvelte/spec@0.30.0

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

- Updated dependencies [44124a6]
- Updated dependencies [c851682]
- Updated dependencies [5105cdc]
  - @ggsvelte/spec@0.29.1

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

### Patch Changes

- Updated dependencies [576fdbf]
  - @ggsvelte/spec@0.29.0

## 0.28.0

### Minor Changes

- 15d7c79: # Faster continuous color and mapped style vectors at 100k (#1423)

  Migration: none — additive. New public helpers `buildRampLut`, `sampleRampLut`,
  and `RAMP_LUT_STEPS` are optional; `trainSequential` / `colorOf` behavior is
  the default path apps already use.

  - Sequential color scales train a dense ramp LUT (`RAMP_LUT_STEPS = 1024`);
    per-point `colorOf` is one clamp + index lookup after `t` is known.
  - Fixture mid/endpoints that land on table entries stay bit-identical to
    continuous `rampColor` (e.g. `t = 0`, `0.5`, `1` and log10 decades on
    black↔white). Other `t` values quantize to the nearest of 1025 samples —
    at most one sRGB channel step vs continuous piecewise-linear output
    (#1423 acceptance: LUT or documented tolerance).
  - `mappedPaintVector` / numeric / indexed style vectors resolve the scale once
    per unique source value, then fan out (bench columns cycle ~100–1000 levels).

  Local medians on 100k canvas points (before → after): color-log10 **~101 → ~38 ms**,
  mapped-style **~89 → ~66 ms**. Budgets in `benchmarks/budgets.json` tightened to match.

- 70c8c82: # Interaction: lazy candidate store behind a runtime hook (#1421)

  The interaction candidate store (hit-testing) no longer ships in the lean
  `@ggsvelte/core/render` graph and no longer builds during `runPipeline`:

  - Candidate construction runs through a runtime hook
    (`candidate-runtime.ts`, mirroring `temporal-runtime.ts`). The full barrel
    installs it via `install-candidates.ts`; the lean render entry omits it, so
    headless/SSR bundles drop ~95 KB raw of candidate-store/hit/spatial code
    (ggsvelte-svg 156.0 → 136.1 KB gzip, ggsvelte-canvas 148.6 → 128.6 KB gzip,
    measured same-tree).
  - `RenderModel.candidates` / `RenderModel.lineage` are now lazy getters that
    build the store once on first access. Full-entry behavior is unchanged;
    a `renderToSVGString` run never pays candidate-build cost at runtime.
  - Accessing either on a lean-entry model throws an `Error` naming the full
    entry. `semantic-viewport` resolves the store at interaction time.

  CI bundle guard: `benchmarks/competitive/lean-candidates-graph.test.ts`
  asserts the lean graphs exclude the candidate-store modules.

  Migration: none — additive behavior for `@ggsvelte/core` consumers;
  `@ggsvelte/core/render` consumers who read `model.candidates` or
  `model.lineage` must switch to the full `@ggsvelte/core` entry.

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

- ef631d6: # Tree-shaken registration: GGPlot apps bundle only declared geoms/stats

  Migration: <https://ggsvelte.sh/guide/upgrading#explicit-registration-for-spec-driven-charts>

  The `@ggsvelte/core` barrel no longer registers every stat frame builder and geom batch at module scope, and no longer installs Temporal on import. Registration is explicit:

  - `registerAll()` — full grammar + Temporal + interaction candidates (one-call pre-0.27 behavior), re-exported from `@ggsvelte/svelte`.
  - `registerBasic()` — identity-chart tier (what `@ggsvelte/core/render` still installs on import).
  - Per-family `registerSmooth()` / `registerBoxplot()` / … — granular opt-in; each generated `<Geom*>` component calls its own in a `<script module>` block, so importing a component is what pulls its code into the bundle.

  GGPlot registers basic geoms/stats + Temporal by default, so component-driven apps (including histograms, smooth, sf, … via `<Geom*>` children) need no change and now tree-shake every specialty geom/stat they do not declare. A Vite consumer rendering a point/line chart no longer bundles smooth/density_2d/sf/contour/violin/hex/boxplot code (CI-enforced via bundle attribution).

  **Breaking (pre-1.0):** spec-driven charts (`layers` prop, `spec`, or headless `runPipeline` / `renderToSVGString`) using specialty geoms/stats must call `registerAll()` once (or a per-family register function). A `stat="…"` override on a component child needs that stat's family register call too — the component registers only its default stat. Missing registration fails loudly with a "not registered in this build" error naming the fix. `ggsvelte-render` (CLI) registers the full grammar itself — no change.

### Patch Changes

- 89efa48: # Faster large-n loess (interpolate surface)

  Migration: none. Internal algorithm work; small-n outputs stay on the
  existing direct/exact path (R fixtures 23–24 bit-identical).

  For groups with more than 500 rows, loess switches to an interpolate
  surface modeled on R's default `surface="interpolate"` /
  `statistics="approximate"` path (1D kd-tree-style median partition, cubic
  Hermite blend of vertex fits, approximate SE). The previous direct path
  fitted a local model at every data point (O(n·q) with q ≈ span·n) and
  allocated a fresh weights buffer per evaluation; large-n SE was hundreds
  of milliseconds with large allocation churn.

  Measured `pipeline loess 5k` (loess+se, forced method): hundreds of ms →
  low double-digit ms; budget 710 → 45 ms. Scratch weights/`l` buffers are
  reused on both surfaces. New fixture 25 pins the large-n path against R's
  default loess.

- 6295520: # Not-registered errors name the family register function

  When a specialty stat/geom is missing from the build, the thrown error now names the precise fix — `registerSummary()`, `registerViolin()`, `registerHex()`, … (exported from both `@ggsvelte/core` and `@ggsvelte/svelte`) — instead of only the broad `registerAll()` / `registerBasic()` advice, and no longer suggests `registerBasic()` for specialty names it cannot cover. Non-obvious families map correctly (`bin_hex` → `registerHex()`, `ydensity` → `registerViolin()`, `bindot` → `registerDotplot()`). The hint maps are pure strings so the lean `@ggsvelte/core/render` graph stays free of the registration modules, with drift-guard tests keeping them in sync with the `register-*.ts` family modules.

- Updated dependencies [3217502]
- Updated dependencies [5531a8d]
  - @ggsvelte/spec@0.28.0

## 0.27.0

### Minor Changes

- a1184f3: # Interaction: columnar candidate datum + lazy axis groups

  Migration: none — additive. `CandidateStoreOptions.datum` keeps working; the
  new `datumColumns` seam and `LineageStore.internSingleton` are optional.

  Faster first-hover on dense charts: candidate stores now resolve
  source-backed datum values as per-batch columns (no per-candidate object
  churn) and build axis-group tables lazily on the first `group()` call. At
  100k points the first interaction query is ~60% faster (canvas cold scatter
  workload: 651 → 263 ms on an x86_64 dev host).

### Patch Changes

- Updated dependencies [0daf0ba]
  - @ggsvelte/spec@0.27.0

## 0.26.2

### Patch Changes

- b6d495a: # Faster density and loess stats

  Migration: none. Internal algorithm work; outputs preserved within the
  repo's existing parity contracts (R fixtures unchanged and green).

  Measured on a loaded x86_64 box:

  - `pipeline density 100k`: **~749 → ~42 ms** (budget 150 ms). Groups well
    above the grid size now evaluate the KDE by linear binning onto the
    evaluation grid plus an exact discrete gaussian convolution — O(n +
    grid × taps) instead of O(n × grid) pairwise kernel evaluations.
    Binning conserves mass and uses the same ±8·bw-truncated kernel values
    as the direct window sum, so the paths agree to binning error — well
    under the 5e-4 R-parity tolerance (R itself approximates by binned
    FFT). Small groups keep the exact direct path, so the R fixtures are
    unaffected. New characterization tests pin agreement with an
    independent direct evaluation, mass conservation, and weight
    normalization.
  - `pipeline loess 5k`: **~703 → ~239 ms** (budget 710 ms). The
    statistics loop's nearest-q window slides right monotonically across
    the sorted evaluation points (amortized O(n)) with a cold-selection
    fallback for single-x windows, and the weighted normal-equation
    moments accumulate once in scalar locals (bit-identical) instead of a
    per-point powers array plus a matrix rebuild per attempted degree.

- add63a4: # Faster small-chart fixed overhead

  Migration: none. Internal changes; outputs preserved (differential-tested
  and snapshot-green).

  Measured on a loaded x86_64 box, min-of-many: `pipeline stacked-bars 50x4`
  **~1.7 → ~1.1 ms** (budget 1.1 ms), `svg render stacked-bars 50x4`
  **~2.1 → ~1.1 ms** (budget 1.3 ms).

  - Tick labels no longer pay one `toLocaleString` ICU call per label per
    render. `formatEnUS` rounds the shortest decimal representation half-up
    — matching ICU exactly, including the `1.005 → "1.01"` case `toFixed`
    gets wrong — with exponential-repr values delegating to ICU; wired into
    `defaultTickFormat`, `defaultLogTickFormat`, and the `scales.*.labels`
    format-string helper. Differential-tested over 1M+ cases.
  - Multi-column group interactions (category × fill) intern each column
    raw and fold per-row intern ids into one numeric key instead of
    building per-row `cellKey` join strings; tuple identity and first-seen
    group numbering match the canonical path exactly, with fallback for
    non-primitive columns.

- 3b5b07f: # Faster SVG mark emission

  Migration: none. Internal renderer changes; emitted SVG is byte-identical
  (snapshot suite green).

  Measured on a loaded x86_64 box, min-of-many: `svg render scatter 100k`
  **~177 → ~88 ms** (budget 130 ms); `svg render scatter 10k` **~26 → ~12 ms**
  (budget 15 ms).

  - `renderPoints` grows one string monomorphically (the existing
    `pathRingData` pattern) instead of a 100k-slot parts array plus final
    join, reads style fields inline exactly as `resolvePointMark` does, and
    emits circles — the scatter default — directly with the opacity
    attribute composed in place. The old path computed
    `pointShapeGeometry` twice per mark (once in `resolvePointMark`, once
    in `pointShape`) and applied opacity via a per-mark string `.replace`.
    Non-circle shapes keep the exact `pointShape` + replace path.
  - Rect, segment, and glyph emitters get the same parts-array →
    single-string conversion.
  - @ggsvelte/spec@0.26.2

## 0.26.1

### Patch Changes

- 3828c57: # Faster candidate-store build

  Migration: none. Internal-only performance work in the candidate-store build
  path; no public API or behavior changes.

  Measured on a loaded x86_64 box (budgets were baselined on Apple Silicon),
  min-of-many reps:

  - hit-index build 100k: ~289 ms → ~208 ms
  - canvas cold scatter 100k: ~1161 ms → ~1150 ms (noisy; CPU profiles show the
    candidate-build share shrinking across every slice)

  Slices:

  - Coincident stacks derive from traversal-order runs instead of a
    `${panel}|${x}|${y}` string-keyed Map (NaN/±0-aware fallback preserved).
  - Per-bucket `Object.freeze` and singleton-lineage `Object.freeze` dropped;
    immutable by convention, matching the coincident-stack precedent.
  - Axis-token interning is kind-dispatched (number/string/boolean Maps keyed
    on the raw value) with peek-before-allocate, eliminating per-candidate
    `tokenKey()` strings and token objects on repeat hits.
  - Fast-path gating for non-finite anchors reads the NARROWED float32 column
    values, so doubles that overflow float32 to ±Infinity take the same
    historical ordering path as any other non-finite anchor.
  - Permutation-sort comparator reads precomputed token ranks and per-candidate
    layer ids — no `compareTokens` dispatch, no `scene.batches[…]` chases.
  - Single-batch all-points scenes reuse the main anchor quadtree instead of
    building an identical second tree.
  - Singleton lineage interning fast-paths through a direct key→ref Map while
    registering the same membership token as the general path.
  - The source-backed datum resolver hoists column arrays, style reads, and
    grouping per (layer, owning table) instead of seven `table.column(field)`
    walks plus cache probes per primitive.
  - Per-candidate columns are written into capacity-preallocated final typed
    arrays instead of growable `number[]` buffers plus conversion copies.

- 4e775d9: # Sort ribbon/area groups when x keys include missing values

  Migration: none. Ribbon/area groups with non-finite running coordinates no
  longer skip x-sorting, and finite rows sort in place so missing slots still
  split shaded bands into separate runs (ggplot2 NA gaps).

- 9b51ddf: # Faster mapped-style scale training and collection

  Migration: none. Internal-only performance work; no public API or behavior
  changes.

  Measured on a loaded x86_64 box, min-of-20 reps of `pipeline mapped-style
100k` (budget 132 ms): **~124 → ~56 ms**.

  - The source-catalog walk encodes each value once per row (was twice:
    `indexableKeys` and the catalog dedupe kept separate `Set` addictions).
  - Provably-continuous aesthetics (sequential/binned/identity numeric style
    scales) skip the full-column catalog dedupe walk entirely — the discrete
    resolutions that read the catalog are unreachable, decided from field
    discreteness metadata, never row data.
  - A single mapped frame (the common case) aliases its value column instead
    of rebuilding it with one push per row; multi-frame plots and
    Float64Array frame columns keep the historical concatenation.
  - `deriveGroups` interns homogeneous primitive single columns directly
    (SameValueZero groups exactly like the `cellKey` string, NaN/±0
    included), falling back to the canonical key path on the first Date or
    mixed-type column.
  - All-number style value columns convert to their semantic Float64 view in
    one fused loop instead of a per-element `cellToNumber` callback inside
    `Float64Array.from`.
  - @ggsvelte/spec@0.26.1

## 0.26.0

### Minor Changes

- 56b856b: # Export planStrata from the lean render entry

  Migration: none — additive. `@ggsvelte/core/render` now re-exports `planStrata` and
  the `Stratum` type. Canvas-mark charts can compose
  `runPipeline` + `planStrata` (lean) with `drawStratum`
  (`@ggsvelte/core/dom`) without importing the full `@ggsvelte/core` barrel,
  which installs the Temporal polyfill on import. Measured on the competitive
  canvas scatter entry: 237.7 → 144.7 KB gzip (−39%).

### Patch Changes

- @ggsvelte/spec@0.26.0

## 0.25.0

### Minor Changes

- 1fbbf45: # Drop Temporal polyfill from lean render bundles

  Migration: none — additive public `ensureTemporalPolyfill` and lean-render size win.

  Identity / numeric charts on `@ggsvelte/core/render` need no call-site change. Apps that parse non-UTC values from `@ggsvelte/spec` alone still get the polyfill via the public temporal facade (`parseTemporal`, column helpers) or `ensureTemporalPolyfill()`. Full `@ggsvelte/core` / `@ggsvelte/core/temporal` and agent `validate()` also register it.

  The polyfill is no longer a static import on the shared parse foundation. Lean client graphs keep ISO/UTC calendar helpers without shipping Temporal + jsbi (~50KB+ gzip).

### Patch Changes

- 36efe51: # Hoist source-backed candidate row locate once per mark

  Migration: none — candidate datum fields stay byte-identical; only repeated
  `SourceRegistry.locate` work for the same global row is removed from the
  source-backed datum resolver.

- 7d92209: # Index guide plans by aesthetic once when assembling the render model

  Migration: none — same guidePlanIds assignment and plan-list order on every scale decision.

  Pre-bucket plan ids by aesthetic so each decision indexes the bucket instead of rescanning the full guide plan list (O(D×P) → O(P+D)).

- 8074811: # Hoist per-iteration invariants in stats and frame helpers

  Migration: none — identical stat output and facet panel order.

  Hoist `Object.keys` / column resolution / encode-band keys above hot loops, store hex-bin cell coords at insert time, and drop the redundant all-true contour mask (#1312).

- 072640f: # Hoist candidate identity x-key column views once per frame

  Migration: none — group×x bucket keys and lineage membership stay byte-identical;
  only per-row conversion/parsed/position column work is removed from the identity index loop.

- 120b5de: # Index batch semantics when counting unknown scale values

  Binned color and sequential/binned numeric style scales count unknown training
  values from the batch-parsed `view.semantic` array instead of re-deriving each
  row via `semanticOf` (which re-paid encodeKey lookup or single-row parseColumn
  on temporal misses). Warning counts stay the same.

- d15954d: # Speed up multi-series line geometry and SVG path strings

  Migration: none — same path vertices, group order, style-split rules, and SVG d strings for linear and step curves.

  Cut redundant work on the competitive `line-3×N` path: continuous bucket finite-check without double normalize, skip x-sort when groups are already ordered, reuse style subpath arrays when stroke style is constant, monomorphic continuous position write, and a linear `pathData` fast path for dense SVG lines.

- 7c748ec: # Batch paint-vector resolution in geometry emitters

  Migration: none — same stroke and fill colours; fewer paint-vector calls and allocations per batch.

  Geometry emitters that already accumulate style-row indices now resolve colour once per batch instead of once per item (segments, line subpaths, curves, polygons, ribbons, area/density groups).

- 86c36ab: # Vertical band axes: truncate over-wide labels instead of hiding short ones

  Migration: none — same tick values and formatters; only which category labels stay visible under a left-margin width cap when thinning cannot shrink measured width, plus density thinning for crowded tall lists.

  When a categorical Y axis (native band Y, or categorical-on-Y after `coord_flip`) overflowed the left-margin cap, layout doubled `labelEvery` until almost every label was gone, even when the widest survivor never left the labeled set. Width-driven doubling now commits only when `maxLabeledWidth` actually shrinks (probing further doublings when a single step is a no-op); otherwise the path truncates with ellipsis and keeps short siblings labeled. A separate density pass still raises `labelEvery` when band step is below label height + min gap so crowded lists do not stack.

- Updated dependencies [d731a33]
- Updated dependencies [1fbbf45]
- Updated dependencies [b6b8a61]
  - @ggsvelte/spec@0.25.0

## 0.24.3

### Patch Changes

- a84fd4e: # Band interval project() normalizes only domain extremes

  Migration: none — identical projected spans for contiguous and non-contiguous
  band selections; lower cost on large category brushes.

  `projectedSpan` used to call `scale.normalize` for every selected key to find
  min/max centers. Centers are monotone in domain index, so it now tracks the
  extreme indices in one pass and normalizes only those two values.

- 47a660a: # Band-axis tick thinning no longer rebuilds every tick on each halving

  Migration: none — same chosen labelEvery, tick values, labels, and labeled flags;
  lower cost when a vertical band axis has many categories.

  Vertical band axes used to call `deriveTicks` once per `labelEvery` doubling
  during margin degradation. Only the `labeled` flag depends on every, so the
  loop now flips flags in place after a single derivation.

- 5d8c5b8: # Shortlist filled-area hits by subpath, not every vertex

  Migration: none — same hit ids and brush membership; lower pointer cost on dense areas.

  Filled path geometry (stacked `geom_area`, ribbons, bands) used to put every path
  vertex into the spatial shortlist. A stacked area of a few thousand rows then
  paid tens of milliseconds per hover. Index one AABB per filled subpath, expand
  to the winning vertex only after containment or axis-snap, and keep brush
  `queryRect` returning every vertex of a hit subpath.

- a8c2292: # Interpolate statAlign from the merge cursor

  Migration: none — same aligned grid, y values, and source-row lineage; lower cost on large G·U expansions.

  `statAlign` no longer binary-searches each group's series once per shared-grid
  x. The merge cursor already used for source-row lineage supplies the
  interpolation bracket, so the per-output-row path is linear in the expansion
  size.
  - @ggsvelte/spec@0.24.3

## 0.24.2

### Patch Changes

- 36569c5: <!-- markdownlint-disable MD041 -->

  # Push sf geometry leaves without spreading large arrays

  Migration: none — internal

  `expandSfLeaves` and `representativePointsForGeometry` used `out.push(...items)`.
  Past the engine argument limit a large nested GeometryCollection or MultiPoint
  threw `RangeError`. Leaves and points are now pushed one element at a time.
  - @ggsvelte/spec@0.24.2

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

- 95aa7b2: <!-- markdownlint-disable MD041 -->

  # Collect style scale values without spreading row columns

  Migration: none — internal

  Mapped style aesthetics collected frame values with `values.push(...mapped)`.
  Past the engine argument limit that threw `RangeError` on large data. Values
  are now pushed one element at a time, matching the colour collect path.

- Updated dependencies [45c6cc9]
- Updated dependencies [06afe2c]
- Updated dependencies [ea0c0b3]
  - @ggsvelte/spec@0.24.1

## 0.24.0

### Minor Changes

- 375f0d2: # Bucket batches by panel once per render

  Migration: none — additive

  `SceneView` nested a loop over batches inside its loop over panels, deciding
  membership with a per-pair `batch.panelIndex === i`. Batch count itself grows
  with panel count — the pipeline emits per layer per panel — so the product grew
  roughly with layers times panels squared.

  The SVG-string renderer and the canvas renderer already grouped once (issue 185) through `groupBatchesByPanel`, which was reachable only from
  `@ggsvelte/core/dom`. It is pure, so it now sits on `@ggsvelte/core` and all
  three renderers share one copy of the routing rule rather than three.

  Measured element reads of the batch list per render, with 24 batches: 2 panels
  48, 4 panels 96, 12 panels 288, 24 panels 576 before; 24 at every panel count
  after.

### Patch Changes

- a3de79e: <!-- markdownlint-disable MD041 -->

  fix: project a wide band selection without spreading the keys

  `SemanticViewportPanel.project()` derived a band selection's extent with
  `Math.min(...centers)` / `Math.max(...centers)`, one argument per selected key.
  `keys` is a plain `readonly string[]` on the exported selection type, so a wide
  enough band brush threw `RangeError: Maximum call stack size exceeded` instead
  of returning an extent. The ceiling is the engine's argument limit — around
  100 000 keys in V8, so a browser hits it well before Bun does.

  It now walks the keys once, tracking the smallest and largest center, so no
  selection size can overflow the call. Same extent as before for every selection
  that already worked, and unknown keys are still skipped.

- 12da8b8: # Read a band selection's ends without mapping every key

  Migration: none — internal

  `SemanticViewport.resolve` reports the first and last selected values on a band
  axis. It got them by mapping the whole key list through a `flatMap` used as a
  filter, allocating a short-lived array per key to read two values. It now scans
  inward from each end.

  Scope honestly: this is an allocation cleanup on a cold path, not a hot-path
  win. The only in-tree caller is the precise-bounds editor's apply handler, which
  calls `project` on the same selection a few lines later — and that still walks
  every key, doing more per key than the loop removed here. What this buys is
  simpler code and no per-key garbage; `SemanticViewportPanel` is exported, so
  external callers get it too.

  Behaviour is unchanged: a key the axis does not carry is skipped exactly as the
  map step dropped it, one match is both ends, and no match is still undefined.

- 8c9685f: # Decide the stacked-area align rescue without rescanning the grid per group

  Migration: none — internal

  Before rewriting a stacked-area frame, the auto-align rescue asks whether any
  group skips a shared-grid x inside its own range. It answered by walking the
  sorted grid once per group, and the "before this group starts" arm was a
  `continue` rather than a seek, so every group also paid for the whole prefix
  of grid values below its own minimum.

  Groups and distinct x both grow with the data and neither is capped, so that
  scan cost groups × grid-x. It now ranks the grid once and compares each group's
  size against the width of its own window, which is the same question answered
  by subtraction: every value a group holds is a grid value inside `[min, max]`,
  and `min` and `max` are themselves members, so the group is dense exactly when
  it holds one value per grid slot in that window.

  The decision is unchanged for every input, and so is the frame that follows
  from it.

  Scope honestly: the shape this helps is many series that each cover a dense
  window of a wider shared grid. A tidy stack where every group covers the whole
  grid already short-circuited on a size check, and when a group really does have
  a hole the rescue's own row expansion dwarfs the scan. On 100 staggered series
  over a 10,000-value grid the scan read 505,000 grid slots; it now reads 10,000.

- 8f75979: # Intern a stat mark's group lineage once instead of once per mark

  Migration: none — internal

  A stat mark's lineage is the whole group it summarizes. The per-group row bucket
  is built once and frozen, and `LineageStore` interns such an array by identity so
  a group is tokenized once however many marks point at it. Two things defeated
  that, and either one alone kept the work at marks × group rows:

  - The represented-rows fallback returned `[...baseRows]`. A clone is not frozen,
    so it never matched the identity cache and every mark paid a fresh set build,
    sort and join over its whole group. The three indexed arms directly above it
    already return the shared frozen bucket for exactly this reason.
  - The cache lookup sat behind `Object.isFrozen`, which walks the array in this
    engine. Guarding a hash lookup with a linear check costs one pass over the
    members per call — the very rescan the cache exists to avoid.

  Both quantities grow with the data: marks are stat output rows, and a group's
  size is a share of the input. For a single-group plot both are the row count, so
  the cost was quadratic. Measured on a `stat: "ecdf"` line, forcing the deferred
  candidate store:

  | rows | before   | after |
  | ---- | -------- | ----- |
  | 2000 | 572 ms   | 38 ms |
  | 4000 | 1987 ms  | 54 ms |
  | 8000 | 10203 ms | 84 ms |

  A `stat: "connect"` line goes from 21135 ms to 100 ms at 8000 rows. The curve is
  now flat where it used to quadruple with each doubling.

  This is construction work behind a lazy gate, so it does not show up in render
  timings — it lands as a freeze on the first hover, hit-test or keyboard
  traversal after a render.

  Lineage membership is unchanged: stats that narrow their group (`smooth`,
  `summary`, `boxplot`, binned counts) still clone and filter.

- e28fa5f: <!-- markdownlint-disable MD041 -->

  fix(core): hit-test stepped paths against the stairs the renderer draws, not the straight chord between authored vertices. `geom_step` (and `geom_line`/`geom_path` with `curve: "step" | "step-hv" | "step-vh"`) carried the step shape as a render-time flag, so hover and brush measured a line the user never saw — a pointer resting on the drawn stroke could report no hit at all. `path-step` now owns the drawn polyline for one authored edge and both the renderers and `closestPathEdge`/`pathSegmentsIntersectRect` read it.

- 4d23a25: # Build a band axis index once per scale, not once per panel

  Migration: none — internal

  Under the default fixed facet scales every panel is handed the same trained
  `PositionScale` object, but the semantic viewport built that scale's key→value
  index separately for each one. A plot with P panels over an axis of C
  categories walked the same domain P times and kept P copies of the resulting
  map alive for as long as the render model. Both quantities grow with the data,
  so the cost was O(P×C) where O(P+C) does.

  The viewport now memoises the index on the scale object itself, so panels that
  share a scale share one map. Free facet scales give each panel its own scale
  object and so still get their own index; nothing writes to the map after it is
  built.

  Scope honestly: this is construction work, not a per-row or per-pointer term —
  it runs once when the render model is assembled. Results from `resolve`,
  `project`, and `locate` are unchanged.

- Updated dependencies [f8e379c]
  - @ggsvelte/spec@0.24.0

## 0.23.0

### Minor Changes

- 50e9292: # CLI split: ggsvelte-render moves to @ggsvelte/cli

  The `ggsvelte-render` CLI moves to its own package, `@ggsvelte/cli` (ADR 0022).

  - `@ggsvelte/cli` (new): owns the `ggsvelte-render` bin; depends only on
    `@ggsvelte/core`, so agent sandboxes install the spec feedback loop without
    the Svelte component library. Also re-exports `runCLI`/`CLIIO` for
    spawn-free embedding.
  - `@ggsvelte/svelte` (breaking, pre-1.0 minor): no longer ships the
    `ggsvelte-render` bin. Migrate with `npm install -g @ggsvelte/cli` (or add
    `@ggsvelte/cli` as a dependency) — the command name and behavior are
    unchanged. `ggsvelte-codemod` still ships with `@ggsvelte/svelte`.
  - `@ggsvelte/core`: the `--version` help text no longer names
    `@ggsvelte/svelte`; `runCLI` reports the version its caller passes.

  Migration: <https://ggsvelte.sh/guide/upgrading#cli-moved-to-ggsvelte-cli>

- e57bdbf: # Lean render path

  Migration: none — additive

  Add lean chart import paths that drop TypeBox validation and the Temporal polyfill from identity-chart client bundles.

  - `@ggsvelte/core/render` — pipeline + SVG with basic geoms only (no heavy stats).
  - `@ggsvelte/core/temporal` — optional install for time scales / Temporal polyfill.
  - `@ggsvelte/spec/portable` — fluent builder that finishes with normalize only.
  - `GGBuilder.toPortable()` on the full package; `.spec()` still TypeBox-validates.

  Measured lean scatter path: ~327 KB → ~140 KB gzip (−57%). Full package default entry stays complete.

- 9ae7909: <!-- markdownlint-disable MD041 -->

  refactor: shared mark style resolvers for rects, segments, glyphs

  `@ggsvelte/core` now exports `resolveRectMark`, `resolveSegmentMark`, and
  `resolveGlyphMark` (with their `Resolved*Mark` types) beside the existing
  point/path resolvers, completing the renderer-neutral style table. The SVG
  string renderer, the canvas drawers, and the Svelte `Batch` component all
  resolve per-mark fill/stroke/dash/alpha through these shared functions.

  No rendering behavior changes — emitted SVG, canvas draw calls, and DOM
  output are unchanged. `@ggsvelte/svelte` picks up the internal refactor of
  `Batch.svelte` only.

  Migration: none — additive

### Patch Changes

- 1d68bcc: # Group facet rows once per layer instead of rescanning per panel

  Migration: none — internal

  Building panel frames sliced each layer once per panel, and each slice walked
  the layer's whole filtered table to keep the rows belonging to that panel. The
  useful work is one pass over the layer, but the cost was one pass per panel:
  O(P x N) where P is the panel count and N the filtered rows.

  Group each layer's rows by facet key once, then answer each panel with a lookup.
  Faceting on a 200-category field did 200 times the necessary row visits,
  multiplied again by layer count, on the main bind path before stats and scale
  training.

  The replicate paths (unfaceted, or a layer carrying none of the facet fields)
  also rebuilt an identical source-row array per panel; they now share one.

  Slices are unchanged for every layout the pipeline can build: same table
  instance or subset, same row order, same source-row lineage, across wrap, grid,
  partial-field replication, absent facet values, and empty tables. A panel
  identity missing a facet field its layer partitions on now throws where it used
  to replicate — no facet form can produce that, since `assertFacetForm` rejects
  wrap mixed with grid and every degenerate layout collapses to the unfaceted
  path.

  The trade is retained memory: each layer holds its grouping for the whole panel
  loop, so a many-layer faceted plot carries roughly one extra index per row per
  layer, where the per-panel arrays were previously garbage as soon as each frame
  copied them.

- 322bc60: <!-- markdownlint-disable MD041 -->

  perf(core): run the ISO shape regex once per string cell in `isIsoLikeString` (was twice), and hoist the kind-rank table out of `compareTokens` so the store-build sort comparator allocates nothing per call

- 97f739a: <!-- markdownlint-disable MD041 -->

  perf(core): binary-search `ringStarts` for a subpath's hole breaks instead of scanning the whole batch array per point-in-path test (O(R) → O(log R + local) per probe; R grows with polygon feature/hole count in choropleths)

- 8987d9c: <!-- markdownlint-disable MD041 -->

  perf(core): resolve outline mask sources with one per-layer index instead of rescanning every batch per outline in `buildInteractionMasks` (O(B²) → O(B) over geometry batches; this path recomputes on every hover/legend emphasis change)

- ccdab47: # Gather the y window per grid row in the 2-D KDE

  Migration: none — internal

  `productKdeGrid`, which builds the density surface behind `geom_density_2d`,
  sorted samples by x and slid an x window across each grid row, but tested y one
  sample at a time in the innermost loop. Every grid row therefore re-walked the
  whole x band and threw away the samples outside `±8σy` individually. It now
  gathers each row's y window once, so neither axis is scanned per cell.

  The share of wasted visits grows with the data, because the bandwidth shrinks as
  `n^(-1/5)` while the x band keeps admitting the same fraction: 16% of visited
  pairs cleared no y window at n = 200, 64% at n = 20 000. On a 4 000-point cloud
  over the default 100 × 100 grid the visit count drops from 9.50M to 2.25M, and a
  50 000-point cloud renders 1.29× faster end to end.

  The surface is unchanged bit for bit — the gather keeps samples in ascending-x
  order, so the kernel terms are still added in the same sequence, and a
  non-finite `y` is still admitted rather than dropped. When the y window already
  reaches every row there is nothing to prune, so the gather is skipped and the
  sorted arrays are read directly.

- c8d7484: <!-- markdownlint-disable MD041 -->

  fix(core): lean path — mixed ISO+number columns stay non-temporal; tag lean lifecycle surfaces

  - `@ggsvelte/core/render` no longer classifies columns like `["2024-01-01", 5]` as temporal (numbers were epoch-ms near 1970).
  - Register `@ggsvelte/core/render`, `@ggsvelte/core/temporal`, and `@ggsvelte/spec/portable` in `lifecycle.json`.

- 9e43af7: <!-- markdownlint-disable MD041 -->

  refactor: probe-scoped hit geometry replaces the threaded containment memo

  Internal only — no public API or behavior change. `createHitGeometry` now
  hands out probe handles: `probePoint(px, py)` answers `distance`/`contains`
  and `probeRect(lo, hi)` answers `intersects`, each owning its own
  containment cache. The cache map no longer travels through four signatures,
  and point and rect containment can no longer be mixed by mistake. The two
  pass-through modules that only restated the interface — candidate-store-
  spatial.ts and candidate-store-spatial-refine.ts — are gone, so a store now
  builds one hit-geometry object instead of two.

- 488f170: <!-- markdownlint-disable MD041 -->

  perf(core): cache filled-path containment per brush rect in queryRect — an interior brush over a filled area/polygon ran a full point-in-polygon walk per candidate (O(K×V)); one cached walk per subpath per query (O(K+V))

- a54207b: # Window polygon hole rings instead of rescanning the batch

  Migration: none — internal, except a narrowed input contract on `pathData`

  SVG serialization, canvas tracing, and the coord hole remap each scanned the
  whole batch-wide `PathsBatch.ringStarts` array to find the ring breaks inside
  one subpath. A shared `ringCuts` helper binary-searches the window instead, so
  a batch with S filled subpaths and R hole rings drops from O(S x R) to
  O(S log R) per SVG render and per canvas frame. Hit testing got the same search
  inline in #1301; it now shares the helper.

  This only bites maps whose parts carry holes: with no holes the batch omits
  `ringStarts` and every call site short-circuits ahead of the helper. Where holes
  are common, R grows with S — 3000 counties with a lake each cost 9 million
  compares per frame before.

  `ringStarts` ascending order is now documented on `PathsBatch` and on the
  exported `pathData`. Both producers emit it ascending, so every in-tree caller
  is unaffected. A caller hand-building an unsorted array for `pathData` used to
  get its out-of-order breaks anyway (paired into the wrong rings); those breaks
  are now dropped instead.

- 4870c0c: <!-- markdownlint-disable MD041 -->

  fix(core): reject invalid auto-scale timezones early; lean date axes use timeTicks without Temporal

  - `assertTemporalConfiguration` still validates `timezone` when the parser is `"auto"` (no more silent fall-through to generic parse failures).
  - Lean `@ggsvelte/core/render` date-axis charts fall back to `timeTicks` + `formatTime` when the temporal runtime is not installed, instead of throwing from `planTemporalAxis`.

- 146c2c8: # Derive tile resolution once per axis instead of once per row

  Migration: none — internal

  `emitBandTiles` passed `defaultResolution(frame.xNumeric)` straight into a call
  inside its per-row loop. JavaScript evaluates arguments eagerly, so a continuous
  axis re-derived that value on every row even when a mapped or param width made
  the callee ignore it. `resolution()` scans the whole column into a Set and sorts
  the distinct values, so a `geom_tile` heatmap on continuous axes was O(n²) in
  its cell count: a 200x200 grid scanned 40,000 values 40,000 times, per axis.

  Derive it once per axis before the loop. Band axes are unchanged — they pass a
  literal `1` and never reach `resolution()`.

  Output is identical for every input; only how often the value is derived changes.

- Updated dependencies [e57bdbf]
- Updated dependencies [58356ea]
- Updated dependencies [1a9ec15]
  - @ggsvelte/spec@0.23.0

## 0.22.0

### Minor Changes

- 74caf57: <!-- markdownlint-disable MD041 -->

  feat(core): warn when every connected-mark group has one observation

  Band/discrete x joins the default grouping interaction (ggplot2 parity), so
  an area or line with a discrete series aesthetic can derive one group per
  (category, series) cell and silently degenerate every ribbon or stroke. Line
  and area batches now emit `group-single-observation` — ggplot2's geom_path
  warning, extended to area — naming the aes.group remedy.

  Migration: none — additive (new warning name; no existing surface changed).

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

### Patch Changes

- Updated dependencies [bd1a10e]
  - @ggsvelte/spec@0.22.0

## 0.21.0

### Patch Changes

- @ggsvelte/spec@0.21.0

## 0.20.0

### Patch Changes

- @ggsvelte/spec@0.20.0

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

- Updated dependencies [2054672]
- Updated dependencies [31bdf1c]
  - @ggsvelte/spec@0.19.0

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

- Updated dependencies [68cc5ec]
- Updated dependencies [4b059b0]
- Updated dependencies [5627ff9]
  - @ggsvelte/spec@0.18.0

## 0.17.0

### Minor Changes

- ac618ad: <!-- markdownlint-disable MD041 -->

  fix(svelte): guard bar/col xy inspect and box GeomText chrome

  Explicit inspect.mode x/xy on GeomBar/GeomCol now emits four interaction
  advisories (plain guide-through-bar, then stronger bisect-value-label
  warnings). GeomText hover/pin chrome is a measured rectangular box instead
  of a point ring. Auto mode was already exact for bar/col.

  Migration: none — additive diagnostics and presentation defaults

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

### Patch Changes

- 9cce304: <!-- markdownlint-disable MD041 -->

  feat(spec): export schema-derived `GUIDE_REFERENCE` for every guide type

  `GUIDE_REFERENCE` / `guideReferenceList()` publish each public guide variant
  (`legend`, `colorbar`, `colorsteps`, `axis`, `none`) with channels, props from
  the matching `*GuideSpec`, and Svelte/helper names. The docs site uses this for
  `/reference/guides`.

  Migration: none — additive

- e9e40b3: <!-- markdownlint-disable MD041 -->

  feat(spec): export schema-derived `SCALE_REFERENCE` for every Scale* surface

  `SCALE_REFERENCE` / `scaleReferenceList()` publish each public scale helper
  from `SCALE_CAPABILITIES` (plus Colour/Ordinal aliases) with family, aesthetics,
  params from position/color/style schemas, and guide notes. The docs site uses
  this for `/reference/scales`.

  Migration: none — additive

- Updated dependencies [9cce304]
- Updated dependencies [3f72e4c]
- Updated dependencies [e9e40b3]
- Updated dependencies [92a9a6c]
- Updated dependencies [cafc230]
- Updated dependencies [8bcf87c]
  - @ggsvelte/spec@0.17.0

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

### Patch Changes

- Updated dependencies [8e3b64b]
- Updated dependencies [b4a58c1]
- Updated dependencies [1256265]
- Updated dependencies [65bce1d]
- Updated dependencies [537f6ae]
- Updated dependencies [1ba87f8]
- Updated dependencies [6d4352a]
  - @ggsvelte/spec@0.16.0

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

- Updated dependencies [3fe70c3]
- Updated dependencies [aeac77b]
- Updated dependencies [b08d256]
  - @ggsvelte/spec@0.15.2

## 0.15.1

### Patch Changes

- 095865f: <!-- markdownlint-disable MD041 -->

  fix(core): honor strokePaint and glow on segment, rule, and spoke

  `SegmentParams`, `RuleParams`, and `SpokeParams` already declared `strokePaint`
  and `glow`, and `SegmentsBatch` already had slots for both, but packing never
  called `layerPaintFromParams`. Authored gradients and glow validated then
  disappeared. Shared segment packing now resolves paint the way line/curve/ribbon
  do, SVG and canvas draw it, and solid fallbacks land when stroke is otherwise
  null.

  Migration: none — params that previously did nothing now render

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

- Updated dependencies [4883364]
- Updated dependencies [3607ef1]
- Updated dependencies [c0d1e63]
  - @ggsvelte/spec@0.15.1

## 0.15.0

### Minor Changes

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

- 2e0811b: <!-- markdownlint-disable MD041 -->

  feat(core): project month-day values so the year actually collapses

  `temporalKind: "monthDay"` validated and authored but did not yet change what a
  chart drew. Now it does: values reach the scale with their year replaced by the
  reference year, so two observations of the same calendar day from different
  years occupy one position.

  The projection sits in `positionColumn` and `positionValuesToNumeric`, the two
  doors into scale space, so marks, trained domains, annotation intercepts and
  stat frames all agree. It is idempotent — a binned median of already-projected
  instants is another already-projected instant, and re-projecting it is a no-op.

  A month-day axis defaults to the `md` parser rather than `auto`, which would
  read `"04-05"` as a category and never take the temporal path at all.

  Two preflight gates learned the same exemption a `time` axis already has: a
  field parsing as `date` is exactly what a month-day axis expects to be handed,
  not a contradiction. Without both, `y: "bloomDate"` threw
  `temporal-parse-failed`.

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

### Patch Changes

- 97f3e2c: <!-- markdownlint-disable MD041 -->

  fix(theme): flat tooltip chrome for gridless themes

  Gridless themes (tufte, void) derive a transparent tooltip keyline and omit the
  default "Click to pin" affordance so minimal-ink charts keep flat interaction
  chrome (#1069). Pinning still works; only the instructional footer is silent.
  Themes that draw a grid keep the hairline border and pin hint. Inspect configs
  with `pin: false` also omit the affordance.

  Migration: none — additive visual for gridless themes only

- cd09bd8: <!-- markdownlint-disable MD041 -->

  feat(spec): export schema-derived `GEOM_REFERENCE` for every geom

  `GEOM_REFERENCE` / `geomReferenceList()` walk SpecDeclarations and publish
  each geom's summary, defaults, allowed stats and positions, and param docs.
  The docs site uses this for `/reference/geoms` so Svelte props stay in step
  with `schema/v0.json`. Also documents five previously undescribed params
  (`pointrange`/`crossbar` `funMin`/`funMax`, `function.args`).

  Migration: none — additive

- 40c3376: <!-- markdownlint-disable MD041 -->

  fix(data): drop `bloomRefDate` from the Kyoto teaching dataset

  The column projected each observation's day-of-year onto the year 2001 so a
  date axis could draw it. Two things were wrong with that. It shipped a
  fabricated year inside published data — no other copy of Aono's record has
  anything like it — and it preserved day-of-year rather than month-day, so
  **204 of 838 rows disagreed with `bloomDate` by a day**. Year 812 bloomed on
  1 April and the column said 2 April.

  `temporalKind: "monthDay"` removes the need for it. The year now collapses
  inside the scale, where it is a private implementation detail.

  This is a bundled teaching/demo dataset, not a product API contract. Anyone
  still mapping `y: "bloomRefDate"` should map `y: "bloomDate"` and give the
  axis a month-day scale:

  ```svelte
  <GGPlot data={kyotoSakura} aes={{ x: "year", y: "bloomDate" }}>
    <ScaleYMonthDay reverse domain={["05-10", "03-18"]} />
  </GGPlot>
  ```

  `bloomDate` (the real observation) and `bloomDoy` are unchanged. Anyone who
  needs the old projection can compute it, but the month-day scale is the
  correct answer and does not have the leap-year fault.

  The getting-started lesson migrates with it, so the spec it teaches now
  contains no year outside the `year` column itself.

  Guide: <https://ggsvelte.sh/guide/scales-guides#date-and-time-axes>

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

- cc0b0cd: <!-- markdownlint-disable MD041 -->

  refactor(core): one constructor for post-stat LayerFrame

  `statLayerFrame` owns the shared post-stat frame fields, yStatColumn default,
  measure forward, NO_ROW lineage, and style/extras spreads. Matching
  `frame-stats-*` adapters call it instead of hand-writing the same literal.
  function/map/manual/unique/sf stay on their own shapes until a later pass.

- Updated dependencies [06fc8e9]
- Updated dependencies [8541dc6]
- Updated dependencies [3e9d5fa]
- Updated dependencies [95f2c1d]
- Updated dependencies [cd09bd8]
- Updated dependencies [d4c969b]
- Updated dependencies [b80a3b1]
- Updated dependencies [6c44565]
- Updated dependencies [cd3ee72]
- Updated dependencies [e39ea45]
- Updated dependencies [e969b35]
  - @ggsvelte/spec@0.15.0

## 0.14.1

### Patch Changes

- @ggsvelte/spec@0.14.1

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

- 9c22922: <!-- markdownlint-disable MD041 -->

  Semantic viewport owns client→plot mapping via `locate`; surface deletes `plot-px`.

  `SemanticViewport.locate(clientX, clientY, rect)` maps capture-element client coordinates into scene pixels (CSS scale, zero-size guard, no OOB clamp). `createSemanticViewport` now takes a single options object including `sceneSize`. Interaction `setInspection` takes `CandidateFacts` only — `SceneHit` / `hitFromCandidate` / `plot-px` are gone (were never public exports).

  Migration: none — additive

### Patch Changes

- efeea7f: <!-- markdownlint-disable MD041 -->

  fix(core): type diagnostic codes at emit sites

  PipelineWarning, Advisory, PipelineError, ScaleConfigError, and
  ScaleDiagnostic code fields are catalog unions. Wrong codes fail at
  compile time; the regex source scanner is retired (#1043).

- 28ffaf0: <!-- markdownlint-disable MD041 -->

  Generate Geom* shells from the spec schema (`GEOM_PARAM_KEYS`) so param lists are no longer hand-copied. Schema param keys such as `fillPaint`, `strokePaint`, and `glow` now forward into layer params when set on the corresponding shells.

- Updated dependencies [6ca5c5d]
- Updated dependencies [28ffaf0]
  - @ggsvelte/spec@0.14.0

## 0.13.0

### Minor Changes

- dfa1ba0: <!-- markdownlint-disable MD041 -->

  Remove the seven deprecated grammar props from `<GGPlot>` (`theme`, `scales`,
  `coord`, `facet`, `labs`, `guides`, `legend`) and the `LayerDescriptor` type
  alias. Compose grammar as declaration-only children; use
  `MarkLayerDescriptor`. Run `npx ggsvelte-codemod --write` on old source.

  Migration: <https://ggsvelte.sh/guide/upgrading#0-12-to-0-13>

- 3e463ae: <!-- markdownlint-disable MD041 -->

  feat(core): resolve after_stat color/fill outside density_2d (#953)

  Migration: none — additive

  `aes(fill = after_stat(count))` on histograms and the same pattern for
  `density` / `ncount` / `ndensity`, plus count and density stats, now map
  into continuous fill/color scales and legends. Shared `colorColumns`
  helper; `STAT_COLOR_COLUMNS` extended so #915 no longer warns for these.

- cce4f5a: # One diagnostic prose source (#987)

  - Move `PIPELINE_ERROR_CATALOG` into `@ggsvelte/spec` (re-exported from core)
  - Dual-channel codes share `DUAL_ERROR_PROSE` so summary/fix cannot drift
  - Rename validation code `scale-manual-domain-range` → `color-manual-domain-range`
  - Docs error-reference imports pipeline error prose from `@ggsvelte/spec`

  Migration: <https://ggsvelte.sh/guide/upgrading#0-11-to-0-12>

### Patch Changes

- f6d99d5: <!-- markdownlint-disable MD041 -->

  fix(core): emit dual-channel scale diagnostics from structured facts

  Scale-training rich diagnostics (break-outside-domain, baseline transformed
  origin) are built at emission time with typed facts. Evidence is no longer
  recovered by parsing human-readable warning messages. Catalog completeness
  is primary via a typed emission registry (#628).

- d800541: <!-- markdownlint-disable MD041 -->

  refactor(core): host disambiguatedLabels next to domain labeling

  Move the scale-domain label helper out of legend layout builders into
  domain-labels.ts. Public export and legend re-export stay stable.

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

- d4934b0: <!-- markdownlint-disable MD041 -->

  perf(core): memoize geom_map join index across facet panels

  Fortified map table + byKey index are built once per LayerBinding (WeakMap)
  instead of once per panel. `map-region-missing` is also emitted at most once
  per layer per run.

- 20a3e17: <!-- markdownlint-disable MD041 -->

  perf(core): O(E) contour polyline stitch (no Array.unshift)

  Backward isoline extend used `chain.unshift` per edge and re-filtered
  adjacency for degree-1 seeds. Push into a prefix + reverse once, and keep
  remaining degrees + an endpoint-edge stack so stitch is linear in edge count.

- 58bccd6: <!-- markdownlint-disable MD041 -->

  perf(core): precompute per-point-batch maxRadius for hitTest

  Variable aes(size) used to re-scan `batch.sizes` on every pointer probe.
  Build stores max(batch.size, …sizes)×1.25 on the spatial point-batch entry
  so resolveTopmostHit only expands the query pad from that value.

- ee099ba: <!-- markdownlint-disable MD041 -->

  refactor(core): inline empty pipeline barrels and type satellites

  Delete pure re-export facades and one-type satellites in packages/core
  pipeline. Collapse panel-layout from 34 files to 7 by inlining sole-importer
  modules into chrome, facet, single, and the orchestrator.

- 3c5fba6: <!-- markdownlint-disable MD041 -->

  refactor(core): collapse boxplot geometry family; delete dead smooth-line write

  Merge the 12-file boxplot geometry tree into geometry-boxplot.ts +
  geometry-boxplot-body.ts. Delete orphaned geometry-smooth-line-write.ts
  (no src/ importers; only a test kept it alive).

- Updated dependencies [dfa1ba0]
- Updated dependencies [5b54dcb]
- Updated dependencies [cce4f5a]
  - @ggsvelte/spec@0.13.0

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

### Patch Changes

- eeaa980: <!-- markdownlint-disable MD041 -->

  fix: leave modest integer tick labels ungrouped (#779)

  `defaultTickFormat` only applies thousands grouping when the tick step is
  at least 1000, so year-like domains (e.g. 800–2030) render `1000` instead of
  `1,000`. Huge-number axes keep commas. Authors can still force grouping with
  `labels: ",d"`.

  Migration: charts whose continuous tick step is under 1000 may lose commas
  on four-digit labels; use `labels: ",d"` (or `",.Nf"`) to restore grouping.

- 3388a69: # Scope interaction nearest-hits to the semantic viewport panel

  Faceted hover and point select can no longer seed another facet's candidate (#787).

- 5ad437b: # Add geom_abline slope/intercept reference lines

  Annotation-only `geom: "abline"` with `params.slope` (default 1) and `params.intercept` (default 0). Clips y = intercept + slope·x to continuous panel domains and emits a segment batch. Builder `.geomAbline()` and `<GeomAbline />` (#790).

- 93dd535: # Preserve geom_sf polygon holes under coord_transform (#809 phase 9)

  `projectPathBatch` now projects each even-odd ring independently, remaps
  `ringStarts` after tessellation, and keeps `fillRule: "evenodd"`. Multi-ring
  compounds with any invalid vertex still drop whole. Replaces the #941 stopgap
  that stripped interior rings under active projectors.

- be9687f: # Add theme_void / ThemeVoid chrome-free theme

  Add `theme: "void"` / `<ThemeVoid />` (ggplot2 theme_void) — no axes, grid, or panel chrome for maps and pure-mark composition (#822).

  New theme tokens `labelsX` / `labelsY` gate axis tick labels (and layout margin) so void can suppress text without changing tick-mark behavior on existing themes.

- 6ff72f5: # Add scale_*_gradient / gradient2 / gradientn helpers

  ggplot2-shaped continuous colour constructors for color and fill: two-stop `gradient`, three-stop diverging `gradient2`, and n-stop `gradientn` (colours/colors/values). Map onto sequential scales with explicit range (#826). No asymmetric `midpoint` domain remapping in v1.

- 8114eb2: # Add scale_*_steps / steps2 / stepsn helpers

  ggplot2-shaped binned continuous colour constructors for color and fill: two-stop `steps`, three-stop diverging `steps2`, and n-stop `stepsn`. Map onto `type: "binned"` with explicit hex range (#827). No midpoint domain remapping in v1.

- 8f75eb3: # Add scale_*_hue / grey / gray / ordinal discrete colour helpers

  Register portable schemes `hue`, `grey`, and `gray`, plus ggplot2-shaped constructors for color and fill. Custom hue h/c/l or grey start/end bake a 10-stop range; defaults use named schemes. `scale_*_ordinal` aliases discrete (#829).

- 0c12fcb: # Add bare scale_alpha / scale_linewidth and ordinal style aliases (#832)

  ggplot2 ergonomics for style scales:

  - Bare `scale_alpha` / `scale_linewidth` → continuous helpers
  - `scale_alpha_ordinal` / `scale_linewidth_ordinal` / `scale_shape_ordinal` (and camelCase peers) → existing discrete helpers (`type: "ordinal"`)
  - Svelte re-exports: `<ScaleAlphaOrdinal />`, `<ScaleLinewidthOrdinal />`, `<ScaleShapeOrdinal />` (same shells as Discrete)

  Deferred: `scale_shape_continuous` / `scale_linetype_continuous` (ggplot2 warns/errors).

  Migration: none — additive

- 0e8dbda: <!-- markdownlint-disable MD041 -->

  fix: bin-edge lineage replays the stat's own cut (#905)

  `stat_bin` and `stat_summary_bin` cut rows on ggplot2's **fuzzed** break grid
  but emitted only the exact edges, so interaction lineage — which re-derived
  membership from those edges — disagreed with the stat for any value inside the
  fuzz band around an interior break. A hovered bin could report a row that never
  contributed to it while omitting one that did.

  The binning stats now carry the cut they performed (fuzzed grid, closed side,
  and per-row bin index), and both lineage consumers replay it, so represented
  rows always match the rows the stat consumed.

  Migration: none — interaction lineage only

- f6eb71a: <!-- markdownlint-disable MD041 -->

  fix: warn when an after_stat color/fill mapping is ignored (#915)

  An `{ stat }` mapping on `color`/`fill` was accepted for every geom but only
  `density_2d` / `density_2d_filled` ever resolve one into colour values, so
  elsewhere it was dropped without a diagnostic. Those cases now emit a
  `stat-channel-unsupported` warning naming the stat and the requested column.

  This is a warning rather than an error: the layer still renders exactly as
  before, and after-stat colour is a mapping we intend to support more widely
  (tracked separately).

  Migration: none — diagnostic only

- fac1f70: <!-- markdownlint-disable MD041 -->

  fix: resolve polygon-ring hits to their own frame row (#916)

  Hits on closed filled rings (`geom_density_2d_filled`, `geom_polygon`,
  `geom_sf`) resolved through the x-sorted 2×N band reconstruction whenever no
  coord transform was active, so a vertex could report a neighbouring ring's
  row — and with it the wrong `after_stat(level)` / `after_stat(density)`.
  Candidate resolution now prefers the exact per-vertex rows the geometry already
  emits (`closedFrameRows`) for every closed path, not only after coord
  projection.

  Migration: none — hit resolution only

- 57d6688: <!-- markdownlint-disable MD041 -->

  fix: trim canvas-scatter showcase so VR smoke stays under budget (#926)

  Reduce the gallery specimen from 10k to 2.5k marks (still above
  `CANVAS_AUTO_THRESHOLD`) so Playwright VR/gallery capture finish without a
  180s timeout mask. Wall time under headless Chromium scaled roughly with mark
  count (~156s at 10k → ~42s at 2.5k).

  Migration: none — docs/example display density only; no public API change.

- bbbcbd6: <!-- markdownlint-disable MD041 -->

  fix: keep binned legend bin edges distinguishable (#955)

  Default binned colour and numeric-style legends formatted edges with axis
  `tickStep(domain, 5)` precision, so fractional bins on a small domain (e.g.
  0–4 over 5 bins) could collapse adjacent edges to the same label and emit
  degenerate ranges like `"2–2"`. Labels now derive decimals from the minimum
  adjacent bin width so distinct edges stay distinct; integer-edge legends and
  explicit `labels` formats are unchanged.

  Migration: none — display-only for affected fractional-bin legends

- 36ef799: <!-- markdownlint-disable MD041 -->

  fix: use one consistent format for default temporal tick labels (#962)

  Default (no `dateLabels`) tick sequences no longer mix full dates with bare
  day numbers, or months with/without years, on the same axis. Visible labels
  are chosen from the whole sequence span (`Mon d`, or `Mon d, yyyy` when the
  span crosses years; months/quarters/hours follow the same span-uniform rule).
  Explicit `dateLabels` and standalone `fullLabel` values are unchanged.

  Migration: none — display-only for default temporal tick abbreviations.

- Updated dependencies [3ec23b0]
- Updated dependencies [c2e3856]
- Updated dependencies [5ad437b]
- Updated dependencies [f2c0997]
- Updated dependencies [e90a228]
- Updated dependencies [38af6a8]
- Updated dependencies [cac7d43]
- Updated dependencies [a89cc93]
- Updated dependencies [f0f379c]
- Updated dependencies [40a43f9]
- Updated dependencies [158576b]
- Updated dependencies [a832c75]
- Updated dependencies [c11861d]
- Updated dependencies [b90e651]
- Updated dependencies [ccbb798]
- Updated dependencies [7f89e9c]
- Updated dependencies [78fef28]
- Updated dependencies [0ab78a4]
- Updated dependencies [a120bed]
- Updated dependencies [3fb062a]
- Updated dependencies [da5825e]
- Updated dependencies [962bf83]
- Updated dependencies [2154fe1]
- Updated dependencies [cb8ba46]
- Updated dependencies [5584a49]
- Updated dependencies [757b3f5]
- Updated dependencies [26cfa45]
- Updated dependencies [1bc9988]
- Updated dependencies [f08091b]
- Updated dependencies [dbb883b]
- Updated dependencies [985ae06]
- Updated dependencies [fb9a751]
- Updated dependencies [c0ba287]
- Updated dependencies [05b0736]
- Updated dependencies [623b9c1]
- Updated dependencies [f9690fd]
- Updated dependencies [0c4919c]
- Updated dependencies [769bcbf]
- Updated dependencies [be9687f]
- Updated dependencies [d6c72c8]
- Updated dependencies [1a4401d]
- Updated dependencies [1876fc4]
- Updated dependencies [6ff72f5]
- Updated dependencies [8114eb2]
- Updated dependencies [20b4ddb]
- Updated dependencies [8f75eb3]
- Updated dependencies [dfbab7c]
- Updated dependencies [52d05ee]
- Updated dependencies [0c12fcb]
- Updated dependencies [4771f3e]
- Updated dependencies [57d6688]
- Updated dependencies [1f60f29]
- Updated dependencies [4428488]
  - @ggsvelte/spec@0.12.0

## 0.11.1

### Patch Changes

- 92564eb: <!-- markdownlint-disable MD041 -->

  fix(#770): prefer exact hits over path x-snap under inspect auto

  Under `inspect` auto mode, `CandidateStore.nearest` no longer lets
  path/smooth axis-snap distance beat co-layered point ring hits. Exact-mode
  geometric hits win first; pure x/y snap still applies when nothing exact is
  under the pointer (line-only charts unchanged). Explicit `mode: "x"|"y"|"xy"`
  is unchanged.

  Migration: none. Scatter + smooth with boolean/`auto` inspect now focuses
  points on hover instead of the trend line's full-panel vertical crosshair.
  - @ggsvelte/spec@0.11.1

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

- 56b1b09: <!-- markdownlint-disable MD041 -->

  Fix interaction on plots where a layer carries its own `data`. Candidate value
  resolution looked every mapped field up in the plot's source table, so hovering
  a chart whose band or annotation layer had its own columns threw
  `ColumnTable: unknown field "..."`. Row ids are global across sources, so the
  owning table is now resolved from the row.

  Migration: none — additive

- 0f39d55: <!-- markdownlint-disable MD041 -->

  fix: overlaid density fills composite independently through alpha

  Expand constant area/density alpha onto per-subpath alphas when a closed
  batch has multiple groups. SVG group opacity was compositing opaque sibling
  fills into an offscreen buffer first, so translucent overlaid densities
  still occluded each other in the overlap region.

  Migration: none — same author-facing alpha; only the render packing changes.

- 87411a3: <!-- markdownlint-disable MD041 -->

  fix: quieter point inspection and readable axis/tooltip chrome

  - Points and text auto-inspect as `exact` (hover ring only), not full `xy`
    crosshair grouping — axis modes remain opt-in (`mode: "x"|"y"|"xy"`).
  - Default tooltips omit the shared axis field under `x`/`y` mode and humanize
    camelCase column names for `<dt>` labels.
  - Raise light/minimal-family `axisTextSize` (8.8 → 12), base `axisTitleSize`
    (9 → 11.5), and reduce default tooltip font size (16 → 12.5) so tick labels
    are readable next to titles and tooltips.

  Migration: none for most plots. If you relied on `inspect: true` / auto mode
  drawing a full crosshair on scatter points, set `inspect={{ mode: "xy" }}`
  (or `"x"` / `"y"`) explicitly. Visual baselines for light-theme smoke shots
  refresh with the larger axis type.

- be64829: <!-- markdownlint-disable MD041 -->

  Fix candidate grouping on all-identity plots where layers carry their own
  `data`. The source-backed strategy derived grouping from the plot's table, so a
  layer with its own columns threw `deriveGroups: unknown field "..."` as soon as
  candidates were resolved — and where it happened not to throw, it indexed a
  plot-length array with a global row id and silently collapsed those rows into
  one group. Grouping is now derived per owning table and indexed locally, the
  same way value reads already were.

  Migration: none — a plot that previously threw now renders, and per-layer series
  grouping is correct where it was collapsed.

- Updated dependencies [846ee50]
  - @ggsvelte/spec@0.11.0

## 0.10.2

### Patch Changes

- fb100fd: <!-- markdownlint-disable MD041 -->

  fix: finish semantic viewport encapsulation for zoom + bounds edit

  Add `normalizedSpan` and `axisEditModel` on the model-owned semantic
  viewport so zoom degeneracy guards and interval bounds editing no longer
  reconstruct pixel normalization, axis reversal, or band slicing from raw
  `PositionScale` details.

  Migration: none for plot authors. Interaction callers that previously
  read `model.scales` for bounds-edit math should use
  `viewport.panel(id).axisEditModel(axis)` and `panel.normalizedSpan(rect)`.

- 0fafeb3: # One mark-paint resolver for three serializers

  Consolidate point/path paint style resolution (shapes, dash, stroke-null) into one `mark-paint` module shared by the SVG, canvas, and Svelte serializers.

  Migration: none — additive public helpers; renderers keep the same visual output.

- 288eaad: # Narrow LayerFrame into core + per-geom payloads

  Nest bin/dodge/smooth/box behind optional payloads so geometry modules own
  their extras, and introduce FinalizedLayerFrame so post-assembly candidate
  construction reads non-null lineage at the type level instead of a runtime
  null throw on every call.
  - @ggsvelte/spec@0.10.2

## 0.10.1

### Patch Changes

- 2b31212: <!-- markdownlint-disable MD041 -->

  fix: band x-label ladder prefers wrap / −45° over −90°+truncate (#634)

  Auto categorical labels now (1) try balanced ≤2-line wraps when greedy
  needs more lines, (2) check wrap collisions on top-aligned line planes
  matching the renderer, and (3) pick −45° vs −90° from parallel-baseline
  text clearance instead of AABB-vs-column false positives.

  Migration: none — auto layout quality only; author guide pins unchanged

- 4a31bf1: <!-- markdownlint-disable MD041 -->

  fix: wrap-then−45° hybrid band labels when plain wrap fails (#637)

  Auto categorical labels that cannot wrap now balance multi-word text onto
  ≤2 shorter lines and rotate at −45° before full-string −45°/−90° + truncate.
  Svelte and SVG renderers draw multi-line end-anchored rotated ticks.

  Migration: none — auto layout quality only; author guide pins unchanged
  - @ggsvelte/spec@0.10.1

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

- 7e3b717: <!-- markdownlint-disable MD041 -->

  Add a model-owned semantic viewport for panel lookup, pixel/domain inversion,
  domain projection, categorical identity resolution, and interval candidate
  queries. Route Svelte interval selection, precise bounds, inspection panel
  lookup, and brush zoom through that shared coordinate boundary.

- af2efc2: <!-- markdownlint-disable MD041 -->

  fix: cap and clip rotated left/right facet strip labels to panel height

  Long side-strip labels no longer paint into neighboring multi-row panels.
  Labels truncate with ellipsis to the panel-height advance budget; SVG/Svelte
  strip chrome clips to the strip band as defense in depth. Strip band width
  is remeasured against that vertical budget.

- 38683bc: <!-- markdownlint-disable MD041 -->

  fix: ribbon temporal preflight, band measure drop, outline focus mute

  - Preflight xmin/xmax only for rect/ribbon (not unused point mappings)
  - Drop ribbon rows when measure projection is non-finite (band measure axes)
  - Mirror fill focus masks onto presentation-only ribbon outline batches

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

- Updated dependencies [69415d9]
- Updated dependencies [5d04e1f]
- Updated dependencies [127e3fc]
- Updated dependencies [59232e8]
- Updated dependencies [92e7049]
- Updated dependencies [ae74d06]
  - @ggsvelte/spec@0.10.0

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

- 29f05e4: <!-- markdownlint-disable MD041 -->

  fix(core): union facet panel keys across complete per-layer DataRef sources

  When several layer-local tables each carry the facet fields but different
  levels, facet layout no longer stops at the first complete table. Panel keys
  are the union of every complete source so later layers cannot introduce
  orphaned levels.

  Migration: none — corrects multi-table facet layout under per-layer data

- Updated dependencies [e45a6a5]
- Updated dependencies [463adcf]
- Updated dependencies [6179954]
- Updated dependencies [f8723b4]
- Updated dependencies [fd28b89]
  - @ggsvelte/spec@0.9.0

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

### Patch Changes

- 2efb5b2: <!-- markdownlint-disable MD041 -->

  refactor: split style scale resolver into collect, discrete, numeric, and finite modules

- Updated dependencies [43e05b8]
- Updated dependencies [afaaeeb]
- Updated dependencies [fcc8ad0]
- Updated dependencies [737ca85]
  - @ggsvelte/spec@0.8.0

## 0.7.1

### Patch Changes

- 42b031a: <!-- markdownlint-disable MD041 -->

  perf: O(K) band thinning overlap after one pos-sort

  Rotated band label thinning sorts projections once per angle then reuses the
  sorted list (filter by every-k). neighbourOverlap accepts alreadySorted for
  temporal re-checks.

- c4d6b6c: <!-- markdownlint-disable MD041 -->

  perf: O(K·D)→O(K+D) band break domainIndex via encodeKey map

  Explicit band scale breaks resolve domain indices with a first-occurrence
  `encodeKey` map (trainBand identity), including signed zero and typed 1/"1".
  Band break lists are also deduped in O(K) in layoutDomain.

- bbe65c7: <!-- markdownlint-disable MD041 -->

  feat: author `scales.*.guide` pins for band axis label layout

  Optional `{ mode, angle, wrap }` on position scales locks categorical label
  presentation (single / wrap / rotate / off) instead of auto-escalation.
  Advisories now point at `scales.x.guide` as the howToOverride surface.

- dc6c3fe: <!-- markdownlint-disable MD041 -->

  perf: one measureWidth per rotated band tick for height and overhang

  Rotated categorical axes measure each labeled tick once and reuse the width
  for both label-band height and end-anchored overhang.

- 7181580: <!-- markdownlint-disable MD041 -->

  perf: reuse band-axis wrap lines and widths on emit

  Wrapped categorical axes wrap and measure each label once, then reuse the
  cached lines/widths for overlap, side reserve, and tick emission.

- 7f38860: <!-- markdownlint-disable MD041 -->

  perf: Θ(R·B)→Θ(R) binned rect edges via xBinId

  Identity/count bar-col geometry on `type: "binned"` recovers bin edges from the
  stable integer `xBinId` (frame construction) instead of per-row
  `centers.findIndex` scans (B ≤ MAX_BINNED_BREAKS).

- b349179: <!-- markdownlint-disable MD041 -->

  refactor: extract candidate nearest-nav helpers

  Move closestOrthInRange / directionalNearestInOrder / panelRangeInOrder into
  candidate-geometry-nearest.ts. Re-exports keep existing import paths working.

- f66f44b: <!-- markdownlint-disable MD041 -->

  perf: O(C·n)→O(n) canvas point subset color batching

  Masked multi-color point draws bucket included indices by global first-seen
  color in one pass instead of re-scanning the batch for each of up to 64 colors.

- 1fa684e: <!-- markdownlint-disable MD041 -->

  fix: closed ribbons map coord semantic indices via emitted frame rows

  Area/density/smooth closed bands attach `closedFrameRows` for each
  pre-projection vertex so candidate frame-row resolve survives non-finite edge
  filtering under `coordTransform`.

- c422da0: <!-- markdownlint-disable MD041 -->

  refactor: split candidate spatial shortlist indexes from geometry refine

- a2c8da0: <!-- markdownlint-disable MD041 -->

  refactor: split non-position color families into manual, identity, and binned modules

- 94fdbec: <!-- markdownlint-disable MD041 -->

  refactor: split scale training into continuous, band, and color modules

- 6261ee1: <!-- markdownlint-disable MD041 -->

  refactor: extract bin break grids and co-locate stats R-parity suites

- f1b4a3d: <!-- markdownlint-disable MD041 -->

  refactor: split temporal preflight into field, annotation, and shared modules

- 8b9e95d: <!-- markdownlint-disable MD041 -->

  perf: prealloc typed buffers for errorbar segment emit

  Errorbars fill Float32Array/Uint32Array sized to 3 segments per row;
  dense reuses capacity-n buffers, sparse slices — no number[] +
  Float32Array.from double-copy.

- d591a18: <!-- markdownlint-disable MD041 -->

  perf: prealloc typed buffers for geom_text glyphs emit

  emitGlyphRows sizes Float32/Uint32 buffers to frame.n (like points/rects)
  and compacts only when marks are dropped — no number[] + Float32Array.from.

- 774f6de: <!-- markdownlint-disable MD041 -->

  perf: deriveGroups groupCount from Map size (no Math.max spread)

  Explicit and derived grouping return groupCount as the canonical Map size
  after the O(R) pass, avoiding a second full-array Math.max(...groups) that
  can RangeError on large row counts.

- ddc3cd8: <!-- markdownlint-disable MD041 -->

  refactor: modularize identity candidate datum resolver

  Split locate, series, and shared types out of datum.ts; keep a thin factory
  plus lineage/attribute assembly. Public re-exports preserve test import paths.

- dbdec68: <!-- markdownlint-disable MD041 -->

  perf: O(L)→O(log L) legend label measures via shared truncateToFit

  Discrete and steps legend entries truncate with binary-search keep length
  (same helper as axes/band guides), not a reverse linear measure scan.

- 80905dd: <!-- markdownlint-disable MD041 -->

  perf: O(R) band path x-sort keys (not per-comparator indexOf)

  line/area/smooth group sorts materialize band domain ranks once, then
  compare O(1); continuous x still sorts on `xNumeric` directly.

- 616bcc6: <!-- markdownlint-disable MD041 -->

  fix: geom_col/bar hover uses relative de-emphasis instead of a point ring

  Rect mark inspection no longer draws a circle hover/selection ring at the bar
  anchor. Sibling bars de-emphasize via interaction masks (including keyless
  charts via seed primitive focus). Point-like geoms keep circle chrome.

- 328ac7d: <!-- markdownlint-disable MD041 -->

  perf: prealloc rect emit buffers; single-pass grid major/minor split

  `emitRectRows` writes into preallocated Float32Array/Uint32Array (dense no-copy;
  sparse compact). Scene panel grid positions collect major/minor in one tick pass.

- 5cebbab: <!-- markdownlint-disable MD041 -->

  perf: unique-first resolution() O(R+U log U) for jitter/errorbar/bar width

  `resolution()` dedupes finite values before sorting so multiset columns cost
  O(R + U log U). Continuous geom_col bar width reuses the helper (gap 0 → 1).

- eeffbb6: <!-- markdownlint-disable MD041 -->

  perf: prealloc typed buffers for rule segment emit

  Data and annotation rule segments fill Float32Array/Uint32Array sized to
  max mark count; dense reuses buffers, sparse compact slices — no number[]

  - Float32Array.from double-copy.

- b278811: <!-- markdownlint-disable MD041 -->

  perf: O(1) summary/boxplot group×x lineage resolve via finite-y prefilter

  Build-time group×x buckets for summary/boxplot now store only finite-y source
  rows (with empty buckets when every y is non-finite), so candidate resolve
  returns the shared frozen array without per-mark y re-filtering or full-group
  clones. Count buckets are unchanged.

- 1428eb2: <!-- markdownlint-disable MD041 -->

  perf: skip per-group sort in stat_summary mean_se path

  `statSummary` only sorts (group,x) buckets when median is requested. Default
  mean_se and min/max/sum stay O(n) per combination.

- eeb5ce0: <!-- markdownlint-disable MD041 -->

  perf: O(P·B)→O(P+B) SVG panel batch routing via shared groupBatchesByPanel

  Faceted pure-SVG renders no longer re-scan every geometry batch for each panel.
  `groupBatchesByPanel` (issue #185) is pure and shared with the canvas stratum path.

- 4e4ec5b: <!-- markdownlint-disable MD041 -->

  perf: O(log L) ellipsis truncation via shared binary search

  `truncateToFit` binary-searches keep length (O(log L) measureWidth) and is
  shared by continuous layout and band-axis planners.

- 1f94c1c: <!-- markdownlint-disable MD041 -->

  fix: train uncensored natural baseline when scale domain pins censor

  `runPipeline` with `baselineScales` and explicit x/y domains now trains
  baseline domains from a second prepare/train pass without domain pins, so
  zoom-out references match full data extent (Svelte double-pass parity).

- Updated dependencies [bbe65c7]
- Updated dependencies [4e5b875]
- Updated dependencies [3f16ec8]
- Updated dependencies [e6d5f6f]
- Updated dependencies [72b01ee]
- Updated dependencies [6afccdc]
- Updated dependencies [c4f91d0]
- Updated dependencies [29f0565]
- Updated dependencies [1fed2f3]
- Updated dependencies [9a366cf]
- Updated dependencies [ec7f21b]
- Updated dependencies [a54932c]
- Updated dependencies [d1f69cb]
- Updated dependencies [9affbb6]
- Updated dependencies [571721f]
- Updated dependencies [f5a8919]
- Updated dependencies [09e6954]
- Updated dependencies [3231dc7]
  - @ggsvelte/spec@0.7.1

## 0.7.0

### Minor Changes

- ff4ad4c: # Generic color and fill scale families

  Add complete color/fill scale families with binding-identical color/colour helpers, transformed and temporal ramps, deterministic binned colorsteps, manual and identity mappings, explicit NA/unknown policies, and serializable discrete/colorbar/colorsteps GuidePlans.

  `RenderModel.guidePlans` is now a union: narrow on `plan.type === "axis"` before reading axis-only fields. Explicit continuous color domains censor out-of-domain values by default; set `oob: "squish"` to clamp. See the [0.6 to 0.7 migration guide](https://ggsvelte.sh/guide/upgrading#0-6-to-0-7).

  Migration: <https://ggsvelte.sh/guide/upgrading#0-6-to-0-7>

### Patch Changes

- c44f6bc: <!-- markdownlint-disable MD041 -->

  Measured categorical (band) x-axis label layout. Long `geom_col`/`geom_bar` category labels now wrap onto two lines, then rotate (−45°/−90°), instead of overlapping each other and the axis title — every bar keeps its label. When rotation still can't fit, labels truncate with the full text on the tick `<title>`, and a diagnostic suggests `coord_flip` for horizontal bars. The planner never auto-flips the chart and never thins a low-cardinality axis; vertical (coord_flip) categorical axes keep their existing behavior.

- Updated dependencies [c44f6bc]
- Updated dependencies [ff4ad4c]
  - @ggsvelte/spec@0.7.0

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

- b08c930: <!-- markdownlint-disable MD041 -->

  Split the canvas DOM paint path into concern-scoped modules (DPR/color helpers, mark drawers, stratum routing) with the published `@ggsvelte/core/dom` barrel and paint behavior unchanged.

- ed09958: <!-- markdownlint-disable MD041 -->

  Point package homepages and runtime diagnostic guidance at the canonical `https://ggsvelte.sh` documentation origin after the hosting cutover.

- Updated dependencies [82b3a4d]
- Updated dependencies [6b8f64b]
- Updated dependencies [cd7457c]
- Updated dependencies [ed09958]
  - @ggsvelte/spec@0.6.0

## 0.5.1

### Patch Changes

- 85f5b5a: <!-- markdownlint-disable MD041 -->

  Map scale-diagnostic severity onto the CLI stderr `kind` field 1:1 so error-severity diagnostics emit `kind: "error"` instead of being demoted to `warning`.

- Updated dependencies [85f5b5a]
  - @ggsvelte/spec@0.5.1

## 0.5.0

### Minor Changes

- 78c1942: # Temporal guide plans

  Add measured temporal axis plans with calendar-aligned automatic breaks, contextual and complete labels, explicit interval/minor-break controls, locale/timezone formatting, stable diagnostics, and per-panel `RenderModel.guidePlans` inspection.

  Migration: none — additive

### Patch Changes

- 087a4b1: <!-- markdownlint-disable MD041 -->

  Point published package metadata at the live documentation site and identify each package's monorepo directory.

- Updated dependencies [78c1942]
- Updated dependencies [087a4b1]
  - @ggsvelte/spec@0.5.0

## 0.4.0

### Minor Changes

- cfafdd1: # Temporal scale semantics

  Add strict, value-driven date and datetime scales across PortableSpec, fluent builder, and Svelte authoring. Raw four-digit year strings now infer a proportional UTC calendar axis after whole-column validation; ambiguous date orders and identifier-like values remain discrete until explicitly configured.

  Add deterministic named, exact-format, epoch, timezone, and DST-disambiguation parsers; parser-keyed immutable table views; structured scale decisions and diagnostics; ggplot2-style scale aliases; and lubridate-style authoring helpers. Preserve original source values for interactions while using semantic epoch values before stats, positions, scale training, and rendering.

  Migration: <https://ggsvelte.sh/guide/temporal-scales>

  If a four-digit string field is an identifier rather than a calendar year, set the position scale to `type: "band"`, call `scaleXDiscrete()` / `scaleYDiscrete()`, or use the equivalent snake_case alias. Ambiguous DMY/MDY input now requires an explicit parser such as `parse: "dmy"` or `parse: "mdy"`.

### Patch Changes

- 32c207a: # CLI reference parity

  Keep renderer CLI parsing, help output, and generated reference metadata backed by one option definition.

- Updated dependencies [cfafdd1]
  - @ggsvelte/spec@0.4.0

## 0.3.1

### Patch Changes

- 8b7d672: # Report the installed CLI version

  Add the `ggsvelte-render --version` runner contract while preserving SVG-only stdout and JSON Lines diagnostics for render commands.

- 437ff12: # Enforce theme and palette compatibility

  Reject named color schemes that do not match their ordinal or sequential scale type, and reject unsupported custom color syntax before rendering. When `type` is omitted, a named scheme now selects its ordinal or sequential family instead of being silently ignored or misused. Custom ranges accept `#rgb` and `#rrggbb`; three-digit stops normalize to lowercase six-digit hex so sequential interpolation cannot emit malformed colors.

  Migration: replace categorical schemes on sequential scales with `viridis` or a custom hex range; replace `viridis` on ordinal scales with a categorical scheme or custom hex range. Replace named or functional CSS colors in `scales.color.range` and `scales.fill.range` with equivalent `#rgb` or `#rrggbb` values.

- Updated dependencies [2b2f55c]
- Updated dependencies [437ff12]
  - @ggsvelte/spec@0.3.1

## 0.3.0

### Minor Changes

- b8dcf24: # Use CandidateStore for all hit resolution

  Add paint-ordered `CandidateStore.hitTest()` and route Svelte pointer inspection
  through the render model's existing lazy candidate index. Remove the experimental
  `buildHitIndex` and related `@ggsvelte/core/dom` types so interactive plots no
  longer build and retain a second geometry index.

  Migration: <https://ggsvelte.sh/guide/upgrading#0-2-to-0-3>

- e4b02b5: # Delegate keyboard navigation to CandidateStore

  Let `CandidateStore.traverse()` apply modular sequential steps and preserve
  paint order for directional ties. Svelte inspection now delegates sequential,
  directional, and coincident keyboard navigation to the model-owned store
  without materializing a second candidate traversal list.

  Migration: <https://ggsvelte.sh/guide/upgrading#0-2-to-0-3>

### Patch Changes

- 30db776: # Deepen Candidate construction

  Consolidate source-backed and identity-indexed Candidate construction behind one pipeline module seam while preserving CandidateStore behavior and performance contracts.

- Updated dependencies [f63e498]
- Updated dependencies [378f73c]
- Updated dependencies [0a7b872]
  - @ggsvelte/spec@0.3.0

## 0.2.0

### Minor Changes

- ce685ea: # Add linked interactive legend focus

  Add opt-in pointer, touch, and keyboard legend controls; stable-key emphasis
  propagation; renderer-neutral focus masks with SVG/canvas parity; 24-pixel
  legend targets; typed events and diagnostics; and a three-view example.

  Migration: none — additive

- 70b1070: # Add precise filtering and faceted intervals

  Filter discrete legend groups without changing their color identity, coordinate
  durable interval selections across facets with independent, union, or
  cross-panel semantics, and enter exact accessible selection or zoom bounds for
  linear, log, time, reversed, and band scales.

  Migration: none — additive

### Patch Changes

- f171d83: # Performance and hardening backfill

  Changelog backfill for the performance, bug-fix, and internal-architecture work
  merged between v0.1.1 and this release that did not carry individual
  changesets.

  Performance:

  - Stroked-path hit-testing resolves candidates through an edge AABB shortlist
    (O(log E + k) instead of scanning every edge).
  - Canvas segment strokes batch mirror points and render in Θ(runs); canvas
    accessibility rows are not materialised while the data table is closed.
  - Selection membership checks use parallel `Set`s (O(1) per key), and
    non-union interval walks fuse with a shared candidate projection.
  - Many further allocation and traversal reductions across scales, legends,
    facets, tooltips, and interaction controllers.

  Fixes:

  - Keyed `seedId` pin rebinds require a role match.
  - Legend filter chrome honors `--gg-tooltip-background` and preserves
    contrast; forced-colors paint is deterministic for disabled-at-SSR tool
    buttons.
  - Restored interval selections no longer hit an SSR temporal-dead-zone error.
  - Annotation frames stay rowless for `inputGroups`.

  Internals: source modules were split into smaller single-concern units
  (validate, normalize, error catalog, controllers) with no public API change.

- Updated dependencies [f171d83]
  - @ggsvelte/spec@0.2.0

## 0.1.1

### Patch Changes

- 6b3b581: # Installable registry dependencies

  Publish registry-compatible internal dependency ranges and verify release-shaped tarballs with npm, matching the actual Changesets publishing path.

- Updated dependencies [6b3b581]
  - @ggsvelte/spec@0.1.1

## 0.1.0

### Minor Changes

- c7aecaa: # First public release

  Publish the first public ggsvelte release: a Svelte 5 grammar of graphics with strong defaults, ggplot2-inspired themes and palettes, responsive bounded rendering, agent-friendly portable specs and diagnostics, hybrid SVG/canvas output, accessible opt-in inspection and brushing, complete interaction documentation, and a release-gated compatibility and quality matrix.

### Patch Changes

- Updated dependencies [c7aecaa]
  - @ggsvelte/spec@0.1.0

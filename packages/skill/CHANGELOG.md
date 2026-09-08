# @ggts-sh/skill

## 0.43.0

### Minor Changes

- b68b75c: Share interaction behavior between React and Svelte, render React charts during SSR, and qualify both adapters as installed packages. Add typed React grammar children and complete framework examples.

  Add `ggts check` and `ggts render`, move teaching datasets to `@ggts-sh/core/data` with the Svelte compatibility export, and document the shared agent sandbox workflow in one skill package.

  Rename all seven packages from `@ggsvelte/*` to `@ggts-sh/*`, rename the Svelte migration executable to `ggts-codemod`, and serve documentation at `https://ggts.sh`. Existing old-scope installations remain available.

  Migration: https://ggts.sh/guide/upgrading#0-42-to-0-43

## 0.42.0

### Minor Changes

- fec36b3: Add `tooltipTotal` on `<Inspect>` so stacked charts can show a group Total without switching inspect `mode` to `"x"` or `"y"`.

  Migration: none — additive

## 0.41.0

## 0.40.0

### Minor Changes

- d798f17: Add Crameri v8.0.1 categorical `*S` palettes and cyclic `*O` ramps. Cyclic schemes need an explicit domain period and wrap out-of-bounds.

  Migration: none — additive

## 0.39.0

### Patch Changes

- f5ebb1d: Teach agents the opt-in registration contract in `@ggsvelte/skill`. SKILL.md now lists every register/install call that fails at render when omitted: spec-driven `registerAll()`, stat overrides, `installTemporal()`, lean color/style/band/legend families, and named themes on `@ggsvelte/core/headless`.

  Migration: none — skill text

## 0.38.2

## 0.38.1

## 0.38.0

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

- b981a3a: # Document GGPlot children in ggplot2 thinking order

  Migration: none — docs and skill convention only. Svelte examples, the agent
  skill, and the package README now author mark layers first, then scales /
  coords / facets, then theme / guides / labs, with host-only `<Inspect>` last.
  Runtime assembly was already bag-based; child interleave does not change the
  PortableSpec beyond mark z-order and last-wins folds within a grammar family.

- f93cc00: Document Minard-class ring-anchor points in multi-layer hit hygiene guidance.

  Migration: none — skill reference only.

## 0.34.0

### Patch Changes

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

- cf484fe: # Teach inspect mode selection and multi-layer hit hygiene

  Migration: none — skill reference prose only; no API change.

  Expand `references/interactions.md` and the SKILL.md Interactions pointer so
  agents prefer `mode="auto"` when product auto matches geometry, pin
  `mode="exact"` on violin / boxplot / discrete error bars (auto still freescrolls
  those until #1528), mark decorative furniture `inspect={false}` (Minard-class
  multi-layer hits), and verify hover/pin outside the CLI SVG loop. Records
  keep-single skill packaging for #1530.

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

### Patch Changes

- 1c2803b: Document `CANVAS_AUTO_THRESHOLD` in the dense-scatter recipe without linking the retired canvas-scatter showcase.

## 0.31.2

## 0.31.1

### Patch Changes

- fb5ee0c: # Document CoordRadial and CoordPolar in the agent skill

  Migration: none — skill reference prose only; no API change.

  Teach agents the polar/radial coordinate shells added in 0.31: component
  roster (`CoordRadial`, `CoordPolar`), PortableSpec `type: "radial"`, options
  (`theta`, `start`/`end`, `innerRadius`, `expand`, `clip`, `reverse`, limits),
  and the ggplot2 `coord_polar` alias defaults (clip on; prefer radial for new
  work).

## 0.31.0

## 0.30.2

### Patch Changes

- e30a788: # Document skill test layers and seed trigger fixtures

  Migration: none — package README plus repo-only eval fixtures; no API change.

  Document the three-layer skill test story (content contracts, trigger/disclosure
  contracts, held-out NL→spec evals). Repo-only `evals/trigger-cases.json` seeds
  future agent-in-the-loop skill evals and is not packed to npm.

## 0.30.1

## 0.30.0

### Patch Changes

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

### Patch Changes

- cd7a4c8: # Skill teaches the stat-override registration contract

  docs(skill): teach the stat-override registration contract (#1420). `<Geom*>` children self-register only their DEFAULT stat; the stat usage patterns, the errorbar `stat="summary"` recipe, and the SKILL.md preamble now name the matching `register<Family>()` calls from `@ggsvelte/svelte` (and `registerAll()` for spec-driven surfaces). Agents following the skill previously produced apps that threw "not registered in this build" for `stat="…"` overrides.

## 0.27.0

### Minor Changes

- 2effe5c: # Skill moved to @ggsvelte/skill

  Migration: <https://ggsvelte.sh/guide/upgrading#skill-moved-to-ggsvelte-skill>

  The agent skill is now its own package, `@ggsvelte/skill`, versioned in lock-step with the rest of ggsvelte. The package root is the skill directory: install it and copy/symlink `node_modules/@ggsvelte/skill` into your agent's skills directory as `ggsvelte/`, or point agents at `node_modules/@ggsvelte/skill/SKILL.md` directly. Dependabot now surfaces skill updates for bundled copies.

  **Breaking (pre-1.0):** `@ggsvelte/svelte` no longer bundles the skill — `node_modules/@ggsvelte/svelte/skills/ggsvelte/` is gone. Migrate by adding `@ggsvelte/skill` as a (dev) dependency and copying from there instead.

# @ggsvelte/svelte

## 0.42.0

### Minor Changes

- fec36b3: Add `tooltipTotal` on `<Inspect>` so stacked charts can show a group Total without switching inspect `mode` to `"x"` or `"y"`.

  Migration: none — additive

### Patch Changes

- c390b04: Add `@ggsvelte/react`, a React DOM adapter over the same core pipeline and ggplot2 names as `@ggsvelte/svelte`. Shared spec assembly lives in `@ggsvelte/compose`.

  Migration: none — additive

- Updated dependencies [c390b04]
  - @ggsvelte/compose@0.42.0
  - @ggsvelte/core@0.42.0
  - @ggsvelte/spec@0.42.0

## 0.41.0

### Patch Changes

- Updated dependencies [4edbf48]
  - @ggsvelte/core@0.41.0
  - @ggsvelte/spec@0.41.0

## 0.40.0

### Minor Changes

- d798f17: Add Crameri v8.0.1 categorical `*S` palettes and cyclic `*O` ramps. Cyclic schemes need an explicit domain period and wrap out-of-bounds.

  Migration: none — additive

### Patch Changes

- Updated dependencies [d798f17]
- Updated dependencies [23ac1af]
- Updated dependencies [5e7dd00]
  - @ggsvelte/spec@0.40.0
  - @ggsvelte/core@0.40.0

## 0.39.0

### Minor Changes

- 7725754: Stop installing the Temporal polyfill in every `GGPlot` bundle. Temporal scale children now install full Temporal support; spec- and `layers`-driven temporal charts must call `installTemporal()` or `registerAll()` at startup.

  Migration: <https://ggsvelte.sh/guide/upgrading#explicit-temporal-registration-for-spec-driven-charts>

### Patch Changes

- Updated dependencies [799be44]
  - @ggsvelte/core@0.39.0
  - @ggsvelte/spec@0.39.0

## 0.38.2

### Patch Changes

- Updated dependencies [18b49bd]
- Updated dependencies [488756c]
  - @ggsvelte/core@0.38.2
  - @ggsvelte/spec@0.38.2

## 0.38.1

### Patch Changes

- Updated dependencies [8e99a6f]
- Updated dependencies [fa8f552]
- Updated dependencies [f6cc615]
- Updated dependencies [fa38a7e]
- Updated dependencies [7d2320b]
  - @ggsvelte/core@0.38.1
  - @ggsvelte/spec@0.38.1

## 0.38.0

### Patch Changes

- 361725e: Paint inspect crosshairs from one coord-flip remap so x/y guides stay consistent under flip.
- fe365d1: Identity-stat stacked and filled columns now inspect the post-position height, so fill tooltips show shares and Total sums those shares.
- c72ab09: Inspection tooltips fade in on first appear and fade out on last leave. Hover follow and misses between marks stay instant.

  Migration: none — internal tooltip chrome

- Updated dependencies [fe365d1]
- Updated dependencies [eded7a2]
- Updated dependencies [b3280eb]
  - @ggsvelte/core@0.38.0
  - @ggsvelte/spec@0.38.0

## 0.37.1

### Patch Changes

- Updated dependencies [0de1c9c]
- Updated dependencies [f390b78]
- Updated dependencies [9ca1d4e]
- Updated dependencies [0d5b6f7]
- Updated dependencies [7a5b1a8]
- Updated dependencies [d22be72]
  - @ggsvelte/core@0.37.1
  - @ggsvelte/spec@0.37.1

## 0.37.0

### Patch Changes

- Updated dependencies [8cf6e4e]
  - @ggsvelte/core@0.37.0
  - @ggsvelte/spec@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [fa6f795]
  - @ggsvelte/core@0.36.0
  - @ggsvelte/spec@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [5dea633]
  - @ggsvelte/core@0.35.0
  - @ggsvelte/spec@0.35.0

## 0.34.4

### Patch Changes

- 5b6f317: Fix geom_qq_line Inspect: mid-stroke hover no longer teleports between line ends, and tooltips show theoretical/sample quantiles instead of a blank value row.

  Migration: none — bugfix.

- 8e07451: Fix y-axis title placement: position relative to the panel grid (`gridLeft - titleOffset`) instead of a hardcoded SVG `x=12`, so the title tracks the left margin and clears wide tick labels.
- Updated dependencies [5b6f317]
- Updated dependencies [8e07451]
  - @ggsvelte/core@0.34.4
  - @ggsvelte/spec@0.34.4

## 0.34.3

### Patch Changes

- 3b04a07: Fix geom_dotplot Inspect tooltips: hybrid identity+after_stat candidates now expose per-dot x (bin center) and stackpos instead of printing "–" for every mark.
- df6cb6a: Fix position-fill tooltips that printed absurd percentages (e.g. "87300%") by publishing post-position proportions as candidate y values, and emit a `percent-labels-out-of-range` advisory when scale labels are percent formats on non-proportion domains.
- c883335: Omit aes.weight from the default tooltip body — y already carries the weighted measure for count/sum bars, so printing the source weight column was pure redundancy.
- Updated dependencies [3b04a07]
- Updated dependencies [df6cb6a]
- Updated dependencies [86964d8]
  - @ggsvelte/core@0.34.3
  - @ggsvelte/spec@0.34.3

## 0.34.2

### Patch Changes

- b1e675b: Drop Minard ring-anchor / false linked-selection guidance; teach independent dual panels when series cardinalities differ.

  Migration: none — skill reference only.

- Updated dependencies [b1e675b]
  - @ggsvelte/core@0.34.2
  - @ggsvelte/spec@0.34.2

## 0.34.1

### Patch Changes

- b981a3a: # Document GGPlot children in ggplot2 thinking order

  Migration: none — docs and skill convention only. Svelte examples, the agent
  skill, and the package README now author mark layers first, then scales /
  coords / facets, then theme / guides / labs, with host-only `<Inspect>` last.
  Runtime assembly was already bag-based; child interleave does not change the
  PortableSpec beyond mark z-order and last-wins folds within a grammar family.

- b038333: fix legend-filter checkbox visuals: drive `input.checked` from controller state instead of Svelte's `checked={}` binding so trusted label clicks uncheck when a series is hidden. Trim the legend-filter gallery subtitle.
- f93cc00: Document Minard-class ring-anchor points in multi-layer hit hygiene guidance.

  Migration: none — skill reference only.

- Updated dependencies [f93cc00]
  - @ggsvelte/core@0.34.1
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

- Updated dependencies [cbb25bb]
  - @ggsvelte/core@0.34.0
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

- Updated dependencies [f1aa36d]
- Updated dependencies [f6cad53]
- Updated dependencies [817efae]
  - @ggsvelte/core@0.33.0
  - @ggsvelte/spec@0.33.0

## 0.32.1

### Patch Changes

- Updated dependencies [b6a2e33]
  - @ggsvelte/core@0.32.1
  - @ggsvelte/spec@0.32.1

## 0.32.0

### Patch Changes

- 7b1a947: Recover fill/color and single-row weight values from lineage for stat-aggregate bar tooltips so series identity and weights are not blank.
- 237adaa: Raise secondary tooltip line contrast ("Click to pin", overflow) so pin affordances clear WCAG AA on the default paper.
- 7e3b6bc: Axis-group default tooltips show one series-name → reading row per series instead of repeated measure/series key-value pairs.
- Updated dependencies [9f9fafd]
  - @ggsvelte/spec@0.32.0
  - @ggsvelte/core@0.32.0

## 0.31.2

### Patch Changes

- Updated dependencies [a740c50]
  - @ggsvelte/core@0.31.2
  - @ggsvelte/spec@0.31.2

## 0.31.1

### Patch Changes

- @ggsvelte/spec@0.31.1
- @ggsvelte/core@0.31.1

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
  - @ggsvelte/core@0.31.0

## 0.30.2

### Patch Changes

- @ggsvelte/spec@0.30.2
- @ggsvelte/core@0.30.2

## 0.30.1

### Patch Changes

- 950de58: # Expand shared lineages once on precise-bounds recompute

  Migration: none — internal precise-bounds apply path only; same interval keys and lineageCount.

  Precise-bounds apply now domain-filters candidates before expanding `lineage.keys()`, and expands each lineage id once among matches (smooth/aggregate eval grids no longer re-spread the same bag once per mark). Semantic keys resolve only for in-interval candidates.
  - @ggsvelte/spec@0.30.1
  - @ggsvelte/core@0.30.1

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

- Updated dependencies [70971d9]
- Updated dependencies [5249477]
- Updated dependencies [796cb50]
- Updated dependencies [d3250a9]
- Updated dependencies [70971d9]
- Updated dependencies [796cb50]
- Updated dependencies [796cb50]
  - @ggsvelte/spec@0.30.0
  - @ggsvelte/core@0.30.0

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
  - @ggsvelte/core@0.29.1
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
  - @ggsvelte/core@0.29.0
  - @ggsvelte/spec@0.29.0

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

- ef631d6: # Tree-shaken registration: GGPlot apps bundle only declared geoms/stats

  Migration: <https://ggsvelte.sh/guide/upgrading#explicit-registration-for-spec-driven-charts>

  The `@ggsvelte/core` barrel no longer registers every stat frame builder and geom batch at module scope, and no longer installs Temporal on import. Registration is explicit:

  - `registerAll()` — full grammar + Temporal + interaction candidates (one-call pre-0.27 behavior), re-exported from `@ggsvelte/svelte`.
  - `registerBasic()` — identity-chart tier (what `@ggsvelte/core/render` still installs on import).
  - Per-family `registerSmooth()` / `registerBoxplot()` / … — granular opt-in; each generated `<Geom*>` component calls its own in a `<script module>` block, so importing a component is what pulls its code into the bundle.

  GGPlot registers basic geoms/stats + Temporal by default, so component-driven apps (including histograms, smooth, sf, … via `<Geom*>` children) need no change and now tree-shake every specialty geom/stat they do not declare. A Vite consumer rendering a point/line chart no longer bundles smooth/density_2d/sf/contour/violin/hex/boxplot code (CI-enforced via bundle attribution).

  **Breaking (pre-1.0):** spec-driven charts (`layers` prop, `spec`, or headless `runPipeline` / `renderToSVGString`) using specialty geoms/stats must call `registerAll()` once (or a per-family register function). A `stat="…"` override on a component child needs that stat's family register call too — the component registers only its default stat. Missing registration fails loudly with a "not registered in this build" error naming the fix. `ggsvelte-render` (CLI) registers the full grammar itself — no change.

### Patch Changes

- Updated dependencies [15d7c79]
- Updated dependencies [70c8c82]
- Updated dependencies [89efa48]
- Updated dependencies [3217502]
- Updated dependencies [5531a8d]
- Updated dependencies [6295520]
- Updated dependencies [ef631d6]
  - @ggsvelte/core@0.28.0
  - @ggsvelte/spec@0.28.0

## 0.27.0

### Minor Changes

- 2effe5c: # Skill moved to @ggsvelte/skill

  Migration: <https://ggsvelte.sh/guide/upgrading#skill-moved-to-ggsvelte-skill>

  The agent skill is now its own package, `@ggsvelte/skill`, versioned in lock-step with the rest of ggsvelte. The package root is the skill directory: install it and copy/symlink `node_modules/@ggsvelte/skill` into your agent's skills directory as `ggsvelte/`, or point agents at `node_modules/@ggsvelte/skill/SKILL.md` directly. Dependabot now surfaces skill updates for bundled copies.

  **Breaking (pre-1.0):** `@ggsvelte/svelte` no longer bundles the skill — `node_modules/@ggsvelte/svelte/skills/ggsvelte/` is gone. Migrate by adding `@ggsvelte/skill` as a (dev) dependency and copying from there instead.

### Patch Changes

- 6ba2e2a: # GeomLabel boxes paint in the live Svelte scene

  Migration: none. GeomLabel already emitted box geometry in the pipeline and the pure SVG-string serializer; the live Svelte Batch scene path only drew the text. Docs and index thumbnails now show the rounded box chrome.

- Updated dependencies [a1184f3]
- Updated dependencies [0daf0ba]
  - @ggsvelte/core@0.27.0
  - @ggsvelte/spec@0.27.0

## 0.26.2

### Patch Changes

- Updated dependencies [b6d495a]
- Updated dependencies [add63a4]
- Updated dependencies [3b5b07f]
  - @ggsvelte/core@0.26.2
  - @ggsvelte/spec@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [3828c57]
- Updated dependencies [4e775d9]
- Updated dependencies [9b51ddf]
  - @ggsvelte/core@0.26.1
  - @ggsvelte/spec@0.26.1

## 0.26.0

### Patch Changes

- 0db70b1: <!-- markdownlint-disable MD041 -->

  refactor: one interaction context + controller assembly behind the plot engine

  Internal only — no public API or behavior change. The five interaction
  controller factories (zoom, selection, interval, surface, inspection) used to
  declare their own 6–19-field dep bags, hand-wired by the plot engine across
  ~60 fields with `let surfaceState!` / `let semanticCandidateProjection!` late
  bindings to break the surface ↔ inspection ↔ interval ↔ selection cycles.

  A shared `InteractionContext` now carries the common bag (model, config
  slices, handlers, announce, DOM refs, semantic-key service), each factory
  takes `(context, options)` with options holding only controller-specific
  ports, and a single `createInteractionStates` assembly owns the construction
  order and sibling wiring internally. The surface→inspection reducer edge is a
  hoisted concrete instance, so the `surfaceState!` late binding is gone; the
  projection remains the one documented late binding.

- Updated dependencies [56b856b]
  - @ggsvelte/core@0.26.0
  - @ggsvelte/spec@0.26.0

## 0.25.0

### Minor Changes

- 0bc6748: # Add TidyTuesday teaching datasets; rewrite worst gallery examples

  Migration: none — additive data exports and gallery example content only.

  Bundle four politically neutral teaching tables under `@ggsvelte/svelte/data`
  (`chocolateBars`, `coffeeRatings`, `beerProduction`, `fastfoodMenu`) from
  TidyTuesday (CC0 curation; primary sources credited in NOTICE). Rewrite the
  most egregious history-of-stats gallery examples to use them, with plain
  capability-led titles and subtitles.

- b6f6694: # Default tooltip content policy for high-n stacks

  Migration: none — additive public surface only (`groupTotal` /
  `groupMemberCount` on axis-group inspections; new
  `INTERACTION_INSPECT_HIGH_CARDINALITY_DISCRETE` diagnostic). Existing hosts
  keep working; pin / custom content / `oninspect` still cover full listings.

  Axis-group default hover selects top-k by absolute value (focused series
  always included), shows a stack Total row, and an overflow line when members
  are truncated. Pin still lists the full group in the scrollable panel.

### Patch Changes

- 085f9bf: # Assemble snapshots each layer once, not twice

  Migration: none — same assembled PortableSpec and mutation isolation; one less
  O(rows×cols) deep copy per layer with inline data on every assemble.

  `assemblePortableSpec` already snapshots layers before folding non-mark
  grammar children. `materializeAndNormalize` no longer re-snapshots them before
  Date→ISO materialization.

- a212fdd: # Align inspect tooltip Total and overflow with multi-layer groups

  Migration: none — `groupTotal` / `groupMemberCount` on axis-mode inspection
  snapshots still mean full-group unique series contributions; they now include
  distinct series from every layer (not only the focus layer) while still
  deduping multi-layer paints of the same source series (line+point, col+text).

- 5530d29: # Drop repeated per-row work on render and interaction paths

  Migration: none — same legend keys, pin rebind, a11y totals, mark labels, and identity epochs.

  Hoists work that used to re-run over data-scaled collections: lineage-level legend visit keys, precomputed inspection batch roles, index-only keyed pin match, one a11y primitive scan when the table is open, unique mark-label fields closed over the model, and join-built data identity tokens.

- b2e0a0c: # Memoize SSR plot model and strata for one server pass

  Migration: none — same SSR markup; the server path no longer re-runs the
  pipeline on every `model` / `strata` / `hasCanvas` getter read within a render.

- Updated dependencies [d731a33]
- Updated dependencies [36efe51]
- Updated dependencies [7d92209]
- Updated dependencies [8074811]
- Updated dependencies [072640f]
- Updated dependencies [120b5de]
- Updated dependencies [1fbbf45]
- Updated dependencies [d15954d]
- Updated dependencies [7c748ec]
- Updated dependencies [b6b8a61]
- Updated dependencies [86c36ab]
  - @ggsvelte/spec@0.25.0
  - @ggsvelte/core@0.25.0

## 0.24.3

### Patch Changes

- Updated dependencies [a84fd4e]
- Updated dependencies [47a660a]
- Updated dependencies [5d8c5b8]
- Updated dependencies [a8c2292]
  - @ggsvelte/core@0.24.3
  - @ggsvelte/spec@0.24.3

## 0.24.2

### Patch Changes

- Updated dependencies [36569c5]
  - @ggsvelte/core@0.24.2
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

- 2cbcdb2: <!-- markdownlint-disable MD041 -->

  # Teach v0.21 row identity; mark plot-level key deprecated

  Migration: none — skill docs only

  SKILL.md still listed `key` as a first-class GGPlot prop and told agents to
  always give a stable key after #1254/#1257 moved durable identity onto
  Inspect / Select / createPlotInteraction. Align the lead skill with
  references/interactions.md so agents stop generating the deprecated surface.

- Updated dependencies [45c6cc9]
- Updated dependencies [06afe2c]
- Updated dependencies [95aa7b2]
- Updated dependencies [ea0c0b3]
  - @ggsvelte/spec@0.24.1
  - @ggsvelte/core@0.24.1

## 0.24.0

### Patch Changes

- 95818e8: # Resolve tooltip lineage keys by row index

  Migration: none — internal

  Building a tooltip snapshot materialized one row object per source row in a
  candidate's lineage, then threw it away. `model.row` copies every column on each
  call and has no cache, while the key resolver production wires in only ever
  needs the index. For an aggregate or `geom_smooth` mark the lineage is the whole
  group, so hovering one mark over a large group allocated a row per group member.

  The coordinator now takes an index-keyed resolver, matching what production
  already passed, and the lineage walk asks it directly. Measured on a 60-row
  smooth: 120 row materializations before, at most 2 after.

  `resolveInspection` keeps its row-shaped `keyOf` and builds the materializing
  adapter itself, so its output is unchanged. That adapter memoizes one index, so
  reading a member's own row for the snapshot and then asking for its key does not
  copy the row twice.

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

- Updated dependencies [a3de79e]
- Updated dependencies [12da8b8]
- Updated dependencies [8c9685f]
- Updated dependencies [8f75979]
- Updated dependencies [375f0d2]
- Updated dependencies [f8e379c]
- Updated dependencies [e28fa5f]
- Updated dependencies [4d23a25]
  - @ggsvelte/core@0.24.0
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

### Patch Changes

- 368d990: <!-- markdownlint-disable MD041 -->

  refactor: one capability resolution seam behind the layer registry

  Internal only — no public API or behavior change. Legend focus/filter
  resolution shares one channel-capability core; the plot engine reads
  inspect/legendFocus/legendFilter through a single resolution factory with
  three independent SSR-safe deriveds, and advisory delivery goes through one
  once-per-diagnostic helper.

- e66c68b: <!-- markdownlint-disable MD041 -->

  fix: warn when an `<Inspect>` child drops the inspect prop's `identity`

  `<GGPlot inspect={{ identity: "year" }}><Inspect /></GGPlot>` used to lose the
  `identity` without a word. The child replaces the prop whole (REPLACE, as
  documented), an empty child bag means `inspect={true}`, and row identity then
  fell back to an `id` column or the row index — so pins and selection keys
  silently rebound to the wrong rows.

  The capability seam now resolves row identity itself and reports the loss as
  `INTERACTION_INSPECT_IDENTITY_DROPPED`. A child that names its own `identity`
  is a deliberate override and stays quiet. REPLACE semantics are unchanged;
  only the silence is gone.

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

- Updated dependencies [50e9292]
- Updated dependencies [1d68bcc]
- Updated dependencies [322bc60]
- Updated dependencies [97f739a]
- Updated dependencies [8987d9c]
- Updated dependencies [ccdab47]
- Updated dependencies [c8d7484]
- Updated dependencies [e57bdbf]
- Updated dependencies [58356ea]
- Updated dependencies [9e43af7]
- Updated dependencies [488f170]
- Updated dependencies [a54207b]
- Updated dependencies [9ae7909]
- Updated dependencies [4870c0c]
- Updated dependencies [146c2c8]
- Updated dependencies [1a9ec15]
  - @ggsvelte/core@0.23.0
  - @ggsvelte/spec@0.23.0

## 0.22.0

### Patch Changes

- 8da5197: <!-- markdownlint-disable MD041 -->

  fix(svelte): no point-circle hover chrome on filled area stacks

  Hovering or pinning a stacked area band drew the translucent hover ring — a
  point-mark affordance — at the anchor. Closed path fills (area, density,
  polygon) now use the same mute/continuous-crosshair chrome as rects, matching
  the selection/legend emphasis rules. Open path strokes (lines) keep the ring,
  which gaps the crosshair at the focused vertex.

- Updated dependencies [74caf57]
- Updated dependencies [bd1a10e]
  - @ggsvelte/core@0.22.0
  - @ggsvelte/spec@0.22.0

## 0.21.0

### Minor Changes

- 2c9ad6e: <!-- markdownlint-disable MD041 -->

  feat: durable row identity on Inspect / Select / controller

  Custom durable identity now prefers interaction surfaces:

  - `<Inspect identity="…" />` or `inspect={{ identity: "…" }}`
  - `select={{ type: "point" | "interval", identity: "…" }}`
  - `createPlotInteraction({ identity: "…" })`

  Resolution order: Inspect → Select → controller → deprecated GGPlot `key` →
  auto `id` column → row index (order-stable only). Ordinary charts still omit
  identity entirely.

  `GGPlot key` dual-reads through 0.21.x and emits `DEPRECATED_PLOT_PROP`;
  removal lands in 0.22.0.

  Migration: <https://ggsvelte.sh/guide/upgrading#row-identity-on-interaction>

### Patch Changes

- b7ced53: <!-- markdownlint-disable MD041 -->

  fix: gap xy inspect guides around nearby GeomText boxes

  Hard-gap vertical and horizontal crosshairs through measured sibling
  label AABBs in the focus panel so continuous scatter+text charts
  (Langren/Tufte-style) keep both guides without bisecting name labels.

  Migration: none — presentation only when inspect mode draws axis guides
  and the panel has GeomText/GeomLabel glyphs.

- daf4174: <!-- markdownlint-disable MD041 -->

  feat: default row identity without requiring GGPlot `key`

  Interaction identity resolves to an `id` column when present, otherwise
  the row index. Ordinary charts omit `key`; the prop remains an optional
  override for non-`id` natural keys. Legend focus and point selection no
  longer require an explicit key for the default path.

  Migration: none required. Remove redundant `key="id"` from charts whose
  rows already expose an `id` field.

- 8e4d17d: <!-- markdownlint-disable MD041 -->

  docs(skill): teach v0.20 Inspect / GuideLegend interaction API

  Agent skill and site copy preferred the deprecated GGPlot `inspect`,
  `legendFocus`, and `legendFilter` props. Prefer `<Inspect>` and
  `<GuideLegend channel focus|filter />` in skill fences, homepage JSON, and
  the guides reference. Gallery examples already use the children; a contract
  test keeps them that way.

  Migration: none — teaching only.
  - @ggsvelte/spec@0.21.0
  - @ggsvelte/core@0.21.0

## 0.20.0

### Minor Changes

- 1340119: <!-- markdownlint-disable MD041 -->

  feat(svelte): move legend filter opt-in to `<GuideLegend filter>`

  Legend filter is now a host-only prop on `<GuideLegend channel="…" filter />`
  (boolean or `{ mode?, multiple? }`), not a PortableSpec / guideLegend field.
  Only channels with an active filter child get Show-group checkboxes
  (merged legends match via `aesthetics[]`).

  `<GGPlot legendFilter>` still works plot-wide until 0.20.0 and emits
  `DEPRECATED_PLOT_PROP` with migration guidance.

  Migration: <https://ggsvelte.sh/guide/upgrading#legend-filter-on-guidelegend>

  Replace:

  ```svelte
  <GGPlot legendFilter key="id" …>
    <GeomPoint />
  </GGPlot>
  ```

  with:

  ```svelte
  <GGPlot key="id" …>
    <GuideLegend channel="color" filter />
    <GeomPoint />
  </GGPlot>
  ```

  Use the aesthetic that owns the discrete legend (`color`, `fill`, `shape`, …).
  Focus and filter can share one GuideLegend:
  `<GuideLegend channel="color" focus filter />`.

- 27e8194: <!-- markdownlint-disable MD041 -->

  feat(svelte): move legend focus opt-in to `<GuideLegend focus>`

  Legend focus is now a host-only prop on `<GuideLegend channel="…" focus />`
  (boolean or `{ preview?: boolean }`), not a PortableSpec / guideLegend field.
  Only channels with an active focus child get interactive legend targets
  (merged legends match via `aesthetics[]`).

  `<GGPlot legendFocus>` still works plot-wide until 0.20.0 and emits
  `DEPRECATED_PLOT_PROP` with migration guidance.

  Migration: <https://ggsvelte.sh/guide/upgrading#legend-focus-on-guidelegend>

  Replace:

  ```svelte
  <GGPlot legendFocus key="id" …>
    <GeomPoint />
  </GGPlot>
  ```

  with:

  ```svelte
  <GGPlot key="id" …>
    <GuideLegend channel="color" focus />
    <GeomPoint />
  </GGPlot>
  ```

  Use the aesthetic that owns the discrete legend (`color`, `fill`, `shape`, …).
  Focus-only GuideLegend children do not force a `type: "legend"` guide, so
  continuous colour scales keep their colorbar.

- 66d5cc6: <!-- markdownlint-disable MD041 -->

  feat(svelte): declaration-only `<Inspect>` host capability child

  Enable inspection with `<Inspect />` / `<Inspect mode="xy" />` inside
  `<GGPlot>` instead of (or as well as) the `inspect` prop. Host-only — never
  part of PortableSpec. Mark eligibility stays `inspect={false}` opt-out on
  geoms. Multiple `<Inspect>` children last-win with an advisory.

  Migration: none — additive; prop form still works. Prefer:

  ```svelte
  <GGPlot data={rows} aes={{ x: "x", y: "y" }}>
    <Inspect />
    <GeomPoint />
  </GGPlot>
  ```

### Patch Changes

- @ggsvelte/spec@0.20.0
- @ggsvelte/core@0.20.0

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

- 312cb48: <!-- markdownlint-disable MD041 -->

  fix(docs): grammar families are layers in the agent skill

  Scale/Theme/Guide/Labs/Coord/Facet/Legend are Layer kinds in Svelte.
  PortableSpec `layers[]` holds marks only as serialization, not ontology.
  Closes the #1200 inverted framing path.

- Updated dependencies [2054672]
- Updated dependencies [31bdf1c]
  - @ggsvelte/core@0.19.0
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
  - @ggsvelte/core@0.18.0

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

- 1f0ed91: <!-- markdownlint-disable MD041 -->

  docs(skill): keep SKILL.md scheme/theme lead counts in sync with registries

  Slim the theme lead line to representative names, and assert scheme/theme
  totals (plus reference section headers and example names) against
  `COLOR_SCHEME_NAMES` / `CATEGORICAL_SCHEME_NAMES` / `SEQUENTIAL_SCHEME_NAMES`
  and product `THEME_NAMES` in `scripts/skill-content.test.ts` so ggthemes
  port PRs cannot leave the agent skill summary stale (#1210).

- 4b3dd74: <!-- markdownlint-disable MD041 -->

  docs(skill): comprehensive theme roster via references/themes.md

  Move the full product theme table, shells, and role overrides into
  `references/themes.md`. SKILL.md again lists every product theme name (not a
  representative subset) and points agents at the new reference. Inventory tests
  assert the lead-line list and the themes.md table against product THEME_NAMES.

- Updated dependencies [9cce304]
- Updated dependencies [ac618ad]
- Updated dependencies [3f72e4c]
- Updated dependencies [e9e40b3]
- Updated dependencies [92a9a6c]
- Updated dependencies [cafc230]
- Updated dependencies [8bcf87c]
  - @ggsvelte/spec@0.17.0
  - @ggsvelte/core@0.17.0

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

- 9236d23: <!-- markdownlint-disable MD041 -->

  fix(svelte): park legend Clear under the pressed guide, not the scene corner

  The recovery control used a fixed top-right scene park that often covered
  legend titles and swatch labels. It now anchors to the pressed legend box
  (below right stacks, beside bottom strips), uses compact row height instead
  of a 44×44 slab, and fades after idle leave so committed screenshots stay
  clean. Hover or focus on legend chrome brings it back.

  Migration: none — interaction chrome only

- 174c575: <!-- markdownlint-disable MD041 -->

  fix(svelte): legend emphasis mute-only for non-point geoms

  Legend/controller series highlight no longer stamps dashed rings on every
  path vertex, area edge, segment midpoint, or dense point cloud.

  - Rings only for `points` batch marks; paths, rects, segments, and glyphs
    use mute-only de-emphasis (`interactionMuted` alpha)
  - Legend emphasis density-gates rings: more than 48 ring anchors demotes
    all emphasis rings to mute-only so dense series stay readable
  - Point selection rings are ungated (select still highlights every chosen
    point)
  - Grouped gallery examples (area/bar stack, dodge, multi-series line,
    scatter) enable `legendFocus` for interactive QA

  Migration: none for typical charts. Charts that relied on path/area
  vertex rings for emphasis now mute non-focused series only — the intended
  bar/col look.

- Updated dependencies [8e3b64b]
- Updated dependencies [b4a58c1]
- Updated dependencies [1256265]
- Updated dependencies [65bce1d]
- Updated dependencies [537f6ae]
- Updated dependencies [1ba87f8]
- Updated dependencies [6d4352a]
  - @ggsvelte/core@0.16.0
  - @ggsvelte/spec@0.16.0

## 0.15.2

### Patch Changes

- 3fe70c3: <!-- markdownlint-disable MD041 -->

  perf(svelte): cache candidate semantic keys by lineage membership

  Interval, selection, and mask projection walk every candidate. Marks that
  share a lineage (smooth eval grids) now expand membership once and reuse
  the key bag. Single-candidate paths stay O(L) on first hit.

  Migration: none — internal speedup only

- d4f148f: <!-- markdownlint-disable MD041 -->

  fix(svelte): gap inspection crosshairs at the hover ring

  Continuous x/y/xy guides no longer paint through the focused mark and
  its hover ring. Each guide splits into segments that stop short of the
  ring; rect hover chrome still draws continuous guides.

  Migration: none — inspection chrome only

- c5f265e: <!-- markdownlint-disable MD041 -->

  fix(svelte): place legend Clear at top-right of the scene, not below

  When legend focus commits, the Clear control no longer sits under the
  plot with a bottom margin that shoved every chart below. It is absolute
  at the top-right of the scene so SVG size stays fixed and layout does
  not jump (and the tool-rail strip above the plot stays free).

  Migration: none — chrome placement only

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
  - @ggsvelte/core@0.15.2
  - @ggsvelte/spec@0.15.2

## 0.15.1

### Patch Changes

- dd76c10: <!-- markdownlint-disable MD041 -->

  fix(tooltip): format stat-layer position values with axis formatters

  Default tooltip field rows for stat layers (no source row) now route x/y
  through the same scale-aware axis formatters as the axis header. Temporal
  stats no longer dump raw epoch milliseconds (#1113). Live-region text
  matches. Non-position channels and identity rows keep the plain cell path
  when formatters are absent.

  Migration: none — display-only for default tooltips and keyboard live text

- 69afc23: <!-- markdownlint-disable MD041 -->

  fix(svelte): interval bounds editor shows month-day as MM-DD

  `temporalKind: "monthDay"` resolves values into a fixed leap reference year.
  The bounds editor was printing that year via `toISOString()`, so authors saw
  `2000-04-01T00:00:00.000Z` instead of the `04-01` form they write and the axis
  shows. Drafts now format and parse as month-day (`MM-DD`) when the axis kind is
  `monthDay`.

  Closes #1114.

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

- Updated dependencies [095865f]
- Updated dependencies [4883364]
- Updated dependencies [3607ef1]
- Updated dependencies [c0d1e63]
  - @ggsvelte/core@0.15.1
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

- 6c44565: <!-- markdownlint-disable MD041 -->

  fix(data): correct the 2026 Kyoto bloom date and refresh the provenance

  The 2026 row said 30 March (day 89). Peak bloom was 29 March (day 88). We
  took the series from the George Mason mirror, which was committed four days
  before Genki Katata published the authoritative 2026 entry; Our World in
  Data carries 29 March too. Every other year checks out — all 827 shared
  years match Aono's own `KyotoFullFlower7.xls`, and 2016–2025 match Katata's
  continuation.

  The provenance also needed refreshing. Aono's site closed on 2025-03-31 and
  he has since died, so the notice now points at NOAA NCEI, which holds his
  file, and at Katata (CIGS), who continues the series after it ends in 2015.
  The header claimed direct observation "up to 1888"; upstream says the
  modern full-bloom record starts in the 1880s. It now also states that the
  dates are proleptic Gregorian throughout, so nobody goes looking for a
  calendar seam at 1582.

  The committed lesson chart SVGs move by one point.

- 8871d55: <!-- markdownlint-disable MD041 -->

  docs(quickstart): name the epochs above the bands, and fix the callouts

  The chart sent readers to a colour key at the foot of the plot to learn what
  three coloured bands meant, under the title "Climate epoch" — a phrase that
  editorialises where the data was doing fine on its own. The names now sit
  above the bands they name, and the legend is gone.

  They go in the strip between the panel top and the bands, which was already
  empty: the earliest bloom in 1,200 years is 25 March and the domain starts on
  18 March. No observation is displaced and the axis makes no new claim.

  The baseline rule was `#9aa0a6` at alpha 0.7 and effectively invisible, marking
  something nothing named. It is darker and full strength, and the caption says
  what it is. The reference chart puts that label in the right margin; mid-April
  is dense in every century, so there is nowhere inside the panel to say it
  without printing text over data.

  Callouts now state the record as well as the claim — "1323 · May 4, latest on
  record" rather than "1323 — latest on record" — with a middle dot, and every
  label sits left of the point it names with an end anchor, so no leader runs
  back through its own words. Verified by measuring rendered geometry at 640,
  900 and 1200px, not by eye.

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

- Updated dependencies [97f3e2c]
- Updated dependencies [06fc8e9]
- Updated dependencies [8541dc6]
- Updated dependencies [3e9d5fa]
- Updated dependencies [95f2c1d]
- Updated dependencies [cd09bd8]
- Updated dependencies [40c3376]
- Updated dependencies [d4c969b]
- Updated dependencies [b80a3b1]
- Updated dependencies [2e0811b]
- Updated dependencies [6c44565]
- Updated dependencies [cd3ee72]
- Updated dependencies [e39ea45]
- Updated dependencies [e969b35]
- Updated dependencies [cc0b0cd]
  - @ggsvelte/core@0.15.0
  - @ggsvelte/spec@0.15.0

## 0.14.1

### Patch Changes

- b9cde4e: <!-- markdownlint-disable MD041 -->

  fix(inspect): drop duplicate columns from default tooltips

  When fill or color remaps the same column as a position channel (common on
  categorical bars: `aes(x = cat, fill = cat)`), the default tooltip listed that
  column twice — once under the labs title and again under the raw field name.
  Default tooltips now keep the first row per column name, matching a11y
  live-text. Distinct color/fill columns still appear.

  Migration: none
  - @ggsvelte/spec@0.14.1
  - @ggsvelte/core@0.14.1

## 0.14.0

### Patch Changes

- 28ffaf0: <!-- markdownlint-disable MD041 -->

  Generate Geom* shells from the spec schema (`GEOM_PARAM_KEYS`) so param lists are no longer hand-copied. Schema param keys such as `fillPaint`, `strokePaint`, and `glow` now forward into layer params when set on the corresponding shells.

- 9c22922: <!-- markdownlint-disable MD041 -->

  Semantic viewport owns client→plot mapping via `locate`; surface deletes `plot-px`.

  `SemanticViewport.locate(clientX, clientY, rect)` maps capture-element client coordinates into scene pixels (CSS scale, zero-size guard, no OOB clamp). `createSemanticViewport` now takes a single options object including `sceneSize`. Interaction `setInspection` takes `CandidateFacts` only — `SceneHit` / `hitFromCandidate` / `plot-px` are gone (were never public exports).

  Migration: none — additive

- Updated dependencies [6ca5c5d]
- Updated dependencies [efeea7f]
- Updated dependencies [28ffaf0]
- Updated dependencies [9c22922]
  - @ggsvelte/spec@0.14.0
  - @ggsvelte/core@0.14.0

## 0.13.0

### Minor Changes

- 34183f1: <!-- markdownlint-disable MD041 -->

  Add `palmerPenguins` and `mpg` to `@ggsvelte/svelte/data` so the bundled
  teaching surface covers the three shapes the guide needs: time series
  (`kyotoSakura`), continuous distribution with groups (`palmerPenguins`, CC0),
  and categorical comparison (`mpg`, EPA / ggplot2 subset). Each ships with a
  citation export, a docs JSON asset pinned to the package rows, and NOTICE
  attribution.

  Migration: none — additive

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

- 10979c1: <!-- markdownlint-disable MD041 -->

  lifecycle: promote Geom* declaration-only shells to stable-intent (#705)

  Tag every public `<Geom*>` component stable-intent so the recommended Svelte
  composition path matches theme/scale/coord grammar children. Registry and
  factory helpers stay experimental. Tag-only change — no runtime API change.

  Migration: none — additive

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

- 45a4a31: <!-- markdownlint-disable MD041 -->

  refactor(svelte): extract pure data-identity epoch input builder

  Move markLayers-vs-layers-prop, ready-without-assembled, and explicit-spec
  content pick into buildDataIdentityEpochInput next to dataIdentityEpochToken.
  plot-engine keeps the tracker and $derived call site.

- a955cf2: <!-- markdownlint-disable MD041 -->

  refactor(svelte): thin scene-reconcile apply out of InspectionState $effect

  `applySceneInspectReconcile(plan, bag)` owns the clear-disabled / invalidate-*
  side-effect table; the factory `$effect` is a short plan → apply shell (#855).

- c550483: <!-- markdownlint-disable MD041 -->

  perf(svelte): CAP-sized heap for canvas a11y table row select

  Opening the canvas a11y table no longer fully sorts every distinct source-row
  index. Keep a max-heap of the CAP smallest indexes that materialise so cost is
  O(R log CAP) instead of O(R log R) when R ≫ 100.

- 2531cb5: <!-- markdownlint-disable MD041 -->

  docs(svelte): rewrite the shipped agent skill artifact for the 0.12 API

  The skill (`skills/ggsvelte/`, shipped in the package tarball) now teaches
  child-layer composition as the canonical Svelte form, draws the JSON-vs-props
  aes distinction, covers the 0.11.0 grammar-prop deprecation and codemod, and
  adds a `references/` tree with exhaustive geom/stat/theme/palette/scale
  inventories checked against the spec catalogs by `scripts/skill-content.test.ts`.

- Updated dependencies [f6d99d5]
- Updated dependencies [dfa1ba0]
- Updated dependencies [d800541]
- Updated dependencies [5b54dcb]
- Updated dependencies [d4934b0]
- Updated dependencies [3e463ae]
- Updated dependencies [20a3e17]
- Updated dependencies [58bccd6]
- Updated dependencies [ee099ba]
- Updated dependencies [3c5fba6]
- Updated dependencies [cce4f5a]
  - @ggsvelte/core@0.13.0
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

### Patch Changes

- 3388a69: # Scope interaction nearest-hits to the semantic viewport panel

  Faceted hover and point select can no longer seed another facet's candidate (#787).

- 5ad437b: # Add geom_abline slope/intercept reference lines

  Annotation-only `geom: "abline"` with `params.slope` (default 1) and `params.intercept` (default 0). Clips y = intercept + slope·x to continuous panel domains and emits a segment batch. Builder `.geomAbline()` and `<GeomAbline />` (#790).

- be9687f: # Add theme_void / ThemeVoid chrome-free theme

  Add `theme: "void"` / `<ThemeVoid />` (ggplot2 theme_void) — no axes, grid, or panel chrome for maps and pure-mark composition (#822).

  New theme tokens `labelsX` / `labelsY` gate axis tick labels (and layout margin) so void can suppress text without changing tick-mark behavior on existing themes.

- 6ff72f5: # Add scale_*_gradient / gradient2 / gradientn helpers

  ggplot2-shaped continuous colour constructors for color and fill: two-stop `gradient`, three-stop diverging `gradient2`, and n-stop `gradientn` (colours/colors/values). Map onto sequential scales with explicit range (#826). No asymmetric `midpoint` domain remapping in v1.

- 8114eb2: # Add scale_*_steps / steps2 / stepsn helpers

  ggplot2-shaped binned continuous colour constructors for color and fill: two-stop `steps`, three-stop diverging `steps2`, and n-stop `stepsn`. Map onto `type: "binned"` with explicit hex range (#827). No midpoint domain remapping in v1.

- 8f75eb3: # Add scale_*_hue / grey / gray / ordinal discrete colour helpers

  Register portable schemes `hue`, `grey`, and `gray`, plus ggplot2-shaped constructors for color and fill. Custom hue h/c/l or grey start/end bake a 10-stop range; defaults use named schemes. `scale_*_ordinal` aliases discrete (#829).

- 1ed929a: # Escape discard of pending pin stash

  Escape (and setInspection clear) now discard the pending pin-restore stash so a later re-pin cannot restore a pre-dismiss candidate (#856).

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

- Updated dependencies [eeaa980]
- Updated dependencies [3388a69]
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
- Updated dependencies [93dd535]
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
- Updated dependencies [0e8dbda]
- Updated dependencies [f6eb71a]
- Updated dependencies [fac1f70]
- Updated dependencies [57d6688]
- Updated dependencies [bbbcbd6]
- Updated dependencies [1f60f29]
- Updated dependencies [36ef799]
- Updated dependencies [4428488]
  - @ggsvelte/core@0.12.0
  - @ggsvelte/spec@0.12.0

## 0.11.1

### Patch Changes

- c198432: <!-- markdownlint-disable MD041 -->

  refactor(#659): compose the repo's own charts as child layers (slice 8)

  The docs site, the getting-started tutorial, the package README, the bundled
  agent skill, and the clean-consumer compatibility harness no longer pass the
  grammar props deprecated in 0.11.0 — they use `<Scale>`, `<Labs>`, `<Guides>`,
  `<Coord>`, `<Facet>`, and the theme shells instead. A new guard runs
  `ggsvelte-codemod`'s own transform over those sources and fails if any of them
  would still change.

- c198432: <!-- markdownlint-disable MD041 -->

  docs(#659): teach the child-layer API in the guide (slice 9)

  Every Svelte snippet outside the upgrading page now composes scales, guides,
  coordinates, facets, labels, and themes as children rather than as the props
  deprecated in 0.11.0, and the copy-ready snippets on the themes page follow.
  The upgrading guide keeps the old form on purpose — it is the page that
  migrates away from it — and a guard asserts that exemption stays earned.

- Updated dependencies [92564eb]
  - @ggsvelte/core@0.11.1
  - @ggsvelte/spec@0.11.1

## 0.11.0

### Minor Changes

- d458ddb: <!-- markdownlint-disable MD041 -->

  feat: theme children + deprecate GGPlot `theme` prop

  Ship declaration-only `<Theme>` / `<ThemeDark>` / … children (stable-intent),
  fold non-mark plot layers after props so children win, and deliver a
  once-per-instance `DEPRECATED_PLOT_PROP` advisory through `ondiagnostic`
  (`PlotDiagnostic` union). Rename `LayerDescriptor` → `MarkLayerDescriptor`
  (deprecated type alias kept until 0.13.0).

  Migration: <https://ggsvelte.sh/guide/upgrading#compose-the-theme-as-a-child-layer>

- 0f457f1: <!-- markdownlint-disable MD041 -->

  feat: scale children (color/fill) + deprecate GGPlot `scales` prop

  Ship declaration-only `<Scale>` / `<ScaleColor*>` / `<ScaleFill*>` / Colour
  aliases (stable-intent), fold scale children after props so children win per
  channel, deliver a once-per-instance `DEPRECATED_PLOT_PROP` advisory for the
  `scales` prop, and emit `DUPLICATE_SCALE_CHANNEL` when two scale children
  collide on one aesthetic. `PlotDiagnostic` widens to
  `InteractionDiagnostic | DeprecationDiagnostic | CompositionDiagnostic`
  (exhaustive `switch` on `.code` needs a new arm; annotated handlers keep
  working).

  Migration: <https://ggsvelte.sh/guide/upgrading#compose-scales-as-child-layers>

- 0e96701: <!-- markdownlint-disable MD041 -->

  feat: generate all scale child shells via codegen (#659 slice 4)

  Add position and style `<Scale*>` shells (45 new) and regenerate the 18
  color/fill shells from a single manifest-driven generator
  (`bun run scale:children:gen`). Every `SCALE_CAPABILITIES` family now has a
  declaration-only child; `<Scale value={…}/>` remains the escape hatch for
  raw/computed fragments. The `scales` prop deprecation already shipped in
  slice 3.

  Migration: none — additive

- b512a74: <!-- markdownlint-disable MD041 -->

  feat: coord + facet children + deprecate GGPlot `coord` / `facet` props

  Ship declaration-only `<Coord>` / `<CoordFlip>` / `<CoordFixed>` /
  `<CoordEqual>` / `<CoordTransform>` / `<CoordCartesian>` and `<Facet>` /
  `<FacetWrap>` / `<FacetGrid>` children (stable-intent). Both families are
  REPLACE (last child wins over props and earlier children). Deliver
  `DEPRECATED_PLOT_PROP` for the `coord` and `facet` props (since 0.11.0,
  remove in 0.13.0) and `DUPLICATE_PLOT_LAYER` when two coord, facet, or theme
  children are registered (composition diagnostics become a discriminated
  union with the existing `DUPLICATE_SCALE_CHANNEL` scale variant).

  Migration: <https://ggsvelte.sh/guide/upgrading#compose-coord-as-a-child-layer>
  Migration: <https://ggsvelte.sh/guide/upgrading#compose-facet-as-a-child-layer>

- 9e2a271: <!-- markdownlint-disable MD041 -->

  feat(#659): labs + guides + legend children, deprecate the props (slice 6)

  Ship declaration-only `<Labs>`, `<Guide*>` and `<Legend>` layers — the last
  three grammar props to move off `<GGPlot>`.

  - `<Labs title x color …/>` — the whole flat Labs surface as named props. No
    `value` escape hatch: `<Labs {...computed} />` already covers it.
  - `<GuideAxis/>`, `<GuideLegend/>`, `<GuideColorbar/>`, `<GuideColorsteps/>`,
    `<GuideNone/>` — one shell per guide TYPE, each keyed by a `channel` prop
    (the aesthetic is a key, not part of the component name), plus
    `<Guides value={…}/>` for raw or computed guide bags.
  - `<Legend order="sorted"/>` — the plot-wide entry-SORT enum. Deliberately
    separate from `<GuideLegend order={2}/>`, which is a per-aesthetic integer
    placement rank; same word, unrelated concepts.

  Deprecates the `labs`, `guides` and `legend` props (since 0.11.0, removable in
  0.13.0) with upgrading-guide anchors. Children still win over props (D2).

  All three are keyed-MERGE families, so a new `DUPLICATE_MERGE_KEY` composition
  advisory fires when two children write the same key — the later one wins, and
  siblings touching different keys all survive. `DUPLICATE_SCALE_CHANNEL` keeps
  its own code: it shipped in 0.11.0 and its `channel` field and spelling-alias
  suggestion are scale-specific. `CompositionDiagnostic` widens accordingly, so
  exhaustive `switch`es on `.code` need one new arm.

  **Type rename on `@ggsvelte/svelte` only:** the `Labs` spec type is re-exported
  there as `LabsSpec`, because the new `<Labs>` component claims the bare name
  (every grammar child is named for the PortableSpec field it fills, and `Labs`
  is the only spec type without a `Spec`/`Input` suffix). `import type { Labs }
from "@ggsvelte/spec"` is unchanged and remains canonical; only the
  `@ggsvelte/svelte` re-export moved. Using the old name against a `Labs` object
  is a compile error, not a silent mistype.

  Migration: <https://ggsvelte.sh/guide/upgrading#compose-labs-as-a-child-layer>
  Migration: <https://ggsvelte.sh/guide/upgrading#compose-guides-as-child-layers>
  Migration: <https://ggsvelte.sh/guide/upgrading#compose-legend-as-a-child-layer>

- f58fa66: <!-- markdownlint-disable MD041 -->

  feat(#659): ship the plot-props codemod (slice 7, closes #290)

  Add `ggsvelte-codemod`, the first codemod under ADR 0013's policy: it migrates
  the seven grammar props deprecated in 0.11.0 — `facet`, `coord`, `scales`,
  `guides`, `legend`, `theme`, `labs` — into the child layers that replace them.

  ```bash
  npx ggsvelte-codemod src          # diff only, writes nothing
  npx ggsvelte-codemod --write src  # apply
  ```

  Dry-run by default, writes only behind `--write`, per ADR 0013's rule that
  checks and codemods never rewrite code implicitly. Migrated children are
  inserted before any child the file already had, so a hand-written
  `<ScaleColorDiscrete/>` keeps winning over a migrated `scales` prop (D2:
  props apply first, then children in registration order).

  Scoped to meaning-preserving rewrites, never style. It targets the generic
  escape hatches (`<Coord value={…}/>`, `<Scale value={…}/>`, `<Guides
value={…}/>`) rather than named shells, because for scales the named form is
  not byte-identity-preserving (D8 — `normalize()` does not infer scale `type`).
  Flat bags expand to named props (`labs={{ title: "Sales" }}` →
  `<Labs title="Sales"/>`), falling back to `<Labs {...expr}/>` when an object
  literal cannot be expanded losslessly. `theme={expr}` with a non-literal value
  is deliberately NOT rewritten — `theme` is `ThemeName | ThemeSpec` and
  `<Theme>` has no `value` hatch — and is reported as `manual change required`
  with the guide anchor instead of being half-migrated.

  Only files importing `GGPlot` from `@ggsvelte/svelte` are touched, so a
  consumer's own `GGPlot` is never rewritten.

  Fixtures live at `packages/svelte/tests/codemod/fixtures/<from>-<to>/<case>/`
  per ADR 0013 and assert the acceptance criteria directly: idempotence, edits
  confined to the rewritten ranges, and unrecognized shapes left untouched with
  a printed pointer.

  Migration: <https://ggsvelte.sh/guide/upgrading#migrate-the-grammar-props-with-the-codemod>

- fc5a8fc: <!-- markdownlint-disable MD041 -->

  Add `@ggsvelte/svelte/data` with the bundled `kyotoSakura` teaching dataset —
  838 peak cherry-blossom dates for Kyoto, 812–2026 CE, typed rows plus a
  `KYOTO_SAKURA_CITATION` string. It backs the getting-started lesson, so the
  quickstart file you copy builds in a bare app with no extra downloads. Data
  copyright Yasuyuki Aono; see NOTICE for the full attribution.

  Migration: none — additive

### Patch Changes

- cdb06ee: <!-- markdownlint-disable MD041 -->

  feat: widen LayerRegistry for non-mark plot layers

  Add a `Layer` union (mark + scale/theme/coord/facet/labs/guides/legend),
  `markLayers` / `registerPlotLayer`, and fold non-mark `plotLayers` into
  assembly after the existing gates. No public behaviour change: no non-mark
  components ship yet, and mark consumers read `markLayers`.

  Migration: none — additive

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

- 902e331: <!-- markdownlint-disable MD041 -->

  fix: default tooltips use labs titles and theme font size

  - Default tooltip field labels prefer explicit `labs` titles for x/y/color/fill
    (and other aesthetic lab keys), then lightly humanized column names.
  - Tooltip type size tracks `theme.fontSize` instead of a hard-coded 12.5px
    (residual of #753 hierarchy work).

  Migration: none. Charts with `labs` get more readable default tooltips; custom
  `inspect.content` snippets remain fully author-controlled. Smoke interaction
  VR baselines refresh for the smaller theme-driven tooltip type size.

- Updated dependencies [846ee50]
- Updated dependencies [56b1b09]
- Updated dependencies [0f39d55]
- Updated dependencies [87411a3]
- Updated dependencies [be64829]
  - @ggsvelte/core@0.11.0
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

- Updated dependencies [fb100fd]
- Updated dependencies [0fafeb3]
- Updated dependencies [288eaad]
  - @ggsvelte/core@0.10.2
  - @ggsvelte/spec@0.10.2

## 0.10.1

### Patch Changes

- a787b5d: <!-- markdownlint-disable MD041 -->

  fix: default geom_col/bar inspect is tooltip-only (no sibling mute flicker)

  Bar/column hover no longer mutes sibling marks by default. Instant opacity
  mask toggles at bar gaps caused full-plot flicker under normal pointer
  movement. Default inspection is tooltip/ring-chrome only (rects still skip
  point rings). Opt in with `inspect={{ muteSiblings: true }}`; muted marks
  ease opacity with a short CSS transition (disabled under
  `prefers-reduced-motion`).

  Migration: none for typical charts. Authors who want #386-style relative
  de-emphasis on hover should set `inspect={{ muteSiblings: true }}`.

- 4a31bf1: <!-- markdownlint-disable MD041 -->

  fix: wrap-then−45° hybrid band labels when plain wrap fails (#637)

  Auto categorical labels that cannot wrap now balance multi-word text onto
  ≤2 shorter lines and rotate at −45° before full-string −45°/−90° + truncate.
  Svelte and SVG renderers draw multi-line end-anchored rotated ticks.

  Migration: none — auto layout quality only; author guide pins unchanged

- Updated dependencies [2b31212]
- Updated dependencies [4a31bf1]
  - @ggsvelte/core@0.10.1
  - @ggsvelte/spec@0.10.1

## 0.10.0

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

- Updated dependencies [69415d9]
- Updated dependencies [5d04e1f]
- Updated dependencies [7e3b717]
- Updated dependencies [af2efc2]
- Updated dependencies [127e3fc]
- Updated dependencies [38683bc]
- Updated dependencies [59232e8]
- Updated dependencies [92e7049]
- Updated dependencies [ae74d06]
  - @ggsvelte/spec@0.10.0
  - @ggsvelte/core@0.10.0

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

- 1b7bae9: <!-- markdownlint-disable MD041 -->

  fix: do not disable legend filters when a hidden rowless annotation scaled-constant shares a style scale

  A data field mapping + annotation `rule` constant on the same discrete style
  scale still exposes filter controls for the visible data categories. Rowful
  scaled constants that appear as legend entries remain non-filterable.

- Updated dependencies [e45a6a5]
- Updated dependencies [463adcf]
- Updated dependencies [6179954]
- Updated dependencies [f8723b4]
- Updated dependencies [29f05e4]
- Updated dependencies [fd28b89]
  - @ggsvelte/spec@0.9.0
  - @ggsvelte/core@0.9.0

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

- Updated dependencies [2efb5b2]
- Updated dependencies [43e05b8]
- Updated dependencies [afaaeeb]
- Updated dependencies [fcc8ad0]
- Updated dependencies [737ca85]
  - @ggsvelte/core@0.8.0
  - @ggsvelte/spec@0.8.0

## 0.7.1

### Patch Changes

- 616bcc6: <!-- markdownlint-disable MD041 -->

  fix: geom_col/bar hover uses relative de-emphasis instead of a point ring

  Rect mark inspection no longer draws a circle hover/selection ring at the bar
  anchor. Sibling bars de-emphasize via interaction masks (including keyless
  charts via seed primitive focus). Point-like geoms keep circle chrome.

- Updated dependencies [42b031a]
- Updated dependencies [c4d6b6c]
- Updated dependencies [bbe65c7]
- Updated dependencies [dc6c3fe]
- Updated dependencies [7181580]
- Updated dependencies [7f38860]
- Updated dependencies [b349179]
- Updated dependencies [f66f44b]
- Updated dependencies [1fa684e]
- Updated dependencies [c422da0]
- Updated dependencies [a2c8da0]
- Updated dependencies [94fdbec]
- Updated dependencies [6261ee1]
- Updated dependencies [f1b4a3d]
- Updated dependencies [8b9e95d]
- Updated dependencies [d591a18]
- Updated dependencies [774f6de]
- Updated dependencies [ddc3cd8]
- Updated dependencies [dbdec68]
- Updated dependencies [80905dd]
- Updated dependencies [616bcc6]
- Updated dependencies [328ac7d]
- Updated dependencies [5cebbab]
- Updated dependencies [eeffbb6]
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
- Updated dependencies [b278811]
- Updated dependencies [1428eb2]
- Updated dependencies [eeb5ce0]
- Updated dependencies [4e4ec5b]
- Updated dependencies [1f94c1c]
  - @ggsvelte/core@0.7.1
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
  - @ggsvelte/core@0.7.0

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

- 47d9ddd: <!-- markdownlint-disable MD041 -->

  Collapse identical default-tooltip field blocks for multi-layer inspect (line + point) without changing the public inspection member list.

- ed09958: <!-- markdownlint-disable MD041 -->

  Point package homepages and runtime diagnostic guidance at the canonical `https://ggsvelte.sh` documentation origin after the hosting cutover.

- Updated dependencies [82b3a4d]
- Updated dependencies [6b8f64b]
- Updated dependencies [cd7457c]
- Updated dependencies [b08c930]
- Updated dependencies [ed09958]
  - @ggsvelte/spec@0.6.0
  - @ggsvelte/core@0.6.0

## 0.5.1

### Patch Changes

- 85f5b5a: <!-- markdownlint-disable MD041 -->

  Map scale-diagnostic severity onto the CLI stderr `kind` field 1:1 so error-severity diagnostics emit `kind: "error"` instead of being demoted to `warning`.

- Updated dependencies [85f5b5a]
  - @ggsvelte/spec@0.5.1
  - @ggsvelte/core@0.5.1

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
  - @ggsvelte/core@0.5.0

## 0.4.0

### Minor Changes

- cfafdd1: # Temporal scale semantics

  Add strict, value-driven date and datetime scales across PortableSpec, fluent builder, and Svelte authoring. Raw four-digit year strings now infer a proportional UTC calendar axis after whole-column validation; ambiguous date orders and identifier-like values remain discrete until explicitly configured.

  Add deterministic named, exact-format, epoch, timezone, and DST-disambiguation parsers; parser-keyed immutable table views; structured scale decisions and diagnostics; ggplot2-style scale aliases; and lubridate-style authoring helpers. Preserve original source values for interactions while using semantic epoch values before stats, positions, scale training, and rendering.

  Migration: <https://ggsvelte.sh/guide/temporal-scales>

  If a four-digit string field is an identifier rather than a calendar year, set the position scale to `type: "band"`, call `scaleXDiscrete()` / `scaleYDiscrete()`, or use the equivalent snake_case alias. Ambiguous DMY/MDY input now requires an explicit parser such as `parse: "dmy"` or `parse: "mdy"`.

### Patch Changes

- f9d62dc: # Temporal agent guidance

  Clarify temporal parser and override behavior in the packaged ggsvelte agent skill.

- Updated dependencies [cfafdd1]
- Updated dependencies [32c207a]
  - @ggsvelte/spec@0.4.0
  - @ggsvelte/core@0.4.0

## 0.3.1

### Patch Changes

- 8b7d672: # Harden the responsive Quickstart path

  Make declaration-only layers server-render on the supported Svelte floor, apply `ariaLabel` to static chart output, commit responsive width and readiness together after collapsed containers recover, and expose the installed package version through `ggsvelte-render --version`.

- Updated dependencies [8b7d672]
- Updated dependencies [2b2f55c]
- Updated dependencies [437ff12]
  - @ggsvelte/core@0.3.1
  - @ggsvelte/spec@0.3.1

## 0.3.0

### Patch Changes

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

- 57e4c85: # Internalize plot interaction assembly

  Internalize controller construction, deferred sibling wiring, shared Candidate
  projection, and lifecycle registration in a deep plot-interaction assembly module.

- 5d95948: # Own semantic Candidate projection once

  Move semantic Candidate traversal, liveness gating, anchor projection, interaction masks, and interval-consumption shaping behind one runtime module seam.

- Updated dependencies [f63e498]
- Updated dependencies [b8dcf24]
- Updated dependencies [30db776]
- Updated dependencies [e4b02b5]
- Updated dependencies [378f73c]
- Updated dependencies [0a7b872]
  - @ggsvelte/spec@0.3.0
  - @ggsvelte/core@0.3.0

## 0.2.1

### Patch Changes

- d724578: # Update the packaged agent skill for v0.2

  Document linked interaction controllers, legend focus and filtering, faceted
  intervals, exact bounds, and the current Svelte peer requirement.

## 0.2.0

### Minor Changes

- ce685ea: # Add linked interactive legend focus

  Add opt-in pointer, touch, and keyboard legend controls; stable-key emphasis
  propagation; renderer-neutral focus masks with SVG/canvas parity; 24-pixel
  legend targets; typed events and diagnostics; and a three-view example.

  Migration: none — additive

- 1fc7b4d: # Add semantic linked-view interaction state

  Add `createPlotInteraction`, controlled selection and zoom, presentation-only
  emphasis, stable semantic scopes, explicit key reconciliation, and a complete
  linked plots-controls-table example.

  Migration: <https://ggsvelte.sh/guide/upgrading#0-1-to-0-2>

- 70b1070: # Add precise filtering and faceted intervals

  Filter discrete legend groups without changing their color identity, coordinate
  durable interval selections across facets with independent, union, or
  cross-panel semantics, and enter exact accessible selection or zoom bounds for
  linear, log, time, reversed, and band scales.

  Migration: none — additive

- 98df82b: # Raise the Svelte peer floor to 5.33.1

  The `svelte` peer range narrows from `^5.29.0` to `^5.33.1`. Svelte 5.33.1
  restored lazy server-side `$derived` evaluation (sveltejs/svelte#15964), so
  the library no longer carries wiring constraints for the 5.29 eager behavior.
  Only the eager-derived declaration constraint is removed — internal controller
  construction order and effect-registration order are unchanged. Consumers on
  Svelte 5.29.0–5.33.0 must upgrade Svelte to take this release.

  Migration: <https://ggsvelte.sh/guide/upgrading#0-1-to-0-2>

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

- 9de8100: # Advise on silently-inert interaction wiring

  Two new advisory diagnostics (ADR 0013 ambiguity audit): `interactionScope`
  without an `interaction` controller is ignored and now says so, and an
  interaction handler (`oninspect`/`onselect`/`onzoom`/`onlegendfocus`/
  `onlegendfilter`) whose capability prop is not enabled never fires and now
  says so. Both are delivered once per prop per plot instance through the
  existing `ondiagnostic` channel (dev-only console fallback) and never change
  behavior. The passive controller-consumer pattern stays advisory-free.

  Migration: none — additive

- Updated dependencies [ce685ea]
- Updated dependencies [f171d83]
- Updated dependencies [70b1070]
- Updated dependencies [f171d83]
  - @ggsvelte/core@0.2.0
  - @ggsvelte/spec@0.2.0

## 0.1.1

### Patch Changes

- 6b3b581: # Installable registry dependencies

  Publish registry-compatible internal dependency ranges and verify release-shaped tarballs with npm, matching the actual Changesets publishing path.

- Updated dependencies [6b3b581]
  - @ggsvelte/spec@0.1.1
  - @ggsvelte/core@0.1.1

## 0.1.0

### Minor Changes

- c7aecaa: # First public release

  Publish the first public ggsvelte release: a Svelte 5 grammar of graphics with strong defaults, ggplot2-inspired themes and palettes, responsive bounded rendering, agent-friendly portable specs and diagnostics, hybrid SVG/canvas output, accessible opt-in inspection and brushing, complete interaction documentation, and a release-gated compatibility and quality matrix.

### Patch Changes

- Updated dependencies [c7aecaa]
  - @ggsvelte/spec@0.1.0
  - @ggsvelte/core@0.1.0

# @ggts-sh/cli

## 0.43.1

### Patch Changes

- @ggts-sh/core@0.43.1

## 0.43.0

### Minor Changes

- b68b75c: Share interaction behavior between React and Svelte, render React charts during SSR, and qualify both adapters as installed packages. Add typed React grammar children and complete framework examples.

  Add `ggts check` and `ggts render`, move teaching datasets to `@ggts-sh/core/data` with the Svelte compatibility export, and document the shared agent sandbox workflow in one skill package.

  Rename all seven packages from `@ggsvelte/*` to `@ggts-sh/*`, rename the Svelte migration executable to `ggts-codemod`, and serve documentation at `https://ggts.sh`. Existing old-scope installations remain available.

  Migration: https://ggts.sh/guide/upgrading#0-42-to-0-43

### Patch Changes

- Updated dependencies [b68b75c]
  - @ggts-sh/core@0.43.0

## 0.42.0

### Patch Changes

- @ggsvelte/core@0.42.0

## 0.41.0

### Patch Changes

- Updated dependencies [4edbf48]
  - @ggsvelte/core@0.41.0

## 0.40.0

### Minor Changes

- d798f17: Add Crameri v8.0.1 categorical `*S` palettes and cyclic `*O` ramps. Cyclic schemes need an explicit domain period and wrap out-of-bounds.

  Migration: none — additive

### Patch Changes

- Updated dependencies [d798f17]
- Updated dependencies [23ac1af]
- Updated dependencies [5e7dd00]
  - @ggsvelte/core@0.40.0

## 0.39.0

### Patch Changes

- Updated dependencies [799be44]
  - @ggsvelte/core@0.39.0

## 0.38.2

### Patch Changes

- Updated dependencies [18b49bd]
- Updated dependencies [488756c]
  - @ggsvelte/core@0.38.2

## 0.38.1

### Patch Changes

- Updated dependencies [8e99a6f]
- Updated dependencies [fa8f552]
- Updated dependencies [f6cc615]
- Updated dependencies [fa38a7e]
- Updated dependencies [7d2320b]
  - @ggsvelte/core@0.38.1

## 0.38.0

### Patch Changes

- Updated dependencies [fe365d1]
- Updated dependencies [eded7a2]
- Updated dependencies [b3280eb]
  - @ggsvelte/core@0.38.0

## 0.37.1

### Patch Changes

- Updated dependencies [0de1c9c]
- Updated dependencies [f390b78]
- Updated dependencies [9ca1d4e]
- Updated dependencies [0d5b6f7]
- Updated dependencies [7a5b1a8]
- Updated dependencies [d22be72]
  - @ggsvelte/core@0.37.1

## 0.37.0

### Patch Changes

- Updated dependencies [8cf6e4e]
  - @ggsvelte/core@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [fa6f795]
  - @ggsvelte/core@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [5dea633]
  - @ggsvelte/core@0.35.0

## 0.34.4

### Patch Changes

- 8e07451: Fix y-axis title placement: position relative to the panel grid (`gridLeft - titleOffset`) instead of a hardcoded SVG `x=12`, so the title tracks the left margin and clears wide tick labels.
- Updated dependencies [5b6f317]
- Updated dependencies [8e07451]
  - @ggsvelte/core@0.34.4

## 0.34.3

### Patch Changes

- df6cb6a: Fix position-fill tooltips that printed absurd percentages (e.g. "87300%") by publishing post-position proportions as candidate y values, and emit a `percent-labels-out-of-range` advisory when scale labels are percent formats on non-proportion domains.
- Updated dependencies [3b04a07]
- Updated dependencies [df6cb6a]
- Updated dependencies [86964d8]
  - @ggsvelte/core@0.34.3

## 0.34.2

### Patch Changes

- b1e675b: Drop Minard ring-anchor / false linked-selection guidance; teach independent dual panels when series cardinalities differ.

  Migration: none — skill reference only.

- Updated dependencies [b1e675b]
  - @ggsvelte/core@0.34.2

## 0.34.1

### Patch Changes

- f93cc00: Document Minard-class ring-anchor points in multi-layer hit hygiene guidance.

  Migration: none — skill reference only.

- Updated dependencies [f93cc00]
  - @ggsvelte/core@0.34.1

## 0.34.0

### Patch Changes

- Updated dependencies [cbb25bb]
  - @ggsvelte/core@0.34.0

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

### Patch Changes

- Updated dependencies [f1aa36d]
- Updated dependencies [f6cad53]
- Updated dependencies [817efae]
  - @ggsvelte/core@0.33.0

## 0.32.1

### Patch Changes

- Updated dependencies [b6a2e33]
  - @ggsvelte/core@0.32.1

## 0.32.0

### Patch Changes

- @ggsvelte/core@0.32.0

## 0.31.2

### Patch Changes

- Updated dependencies [a740c50]
  - @ggsvelte/core@0.31.2

## 0.31.1

### Patch Changes

- @ggsvelte/core@0.31.1

## 0.31.0

### Patch Changes

- Updated dependencies [890a462]
  - @ggsvelte/core@0.31.0

## 0.30.2

### Patch Changes

- @ggsvelte/core@0.30.2

## 0.30.1

### Patch Changes

- @ggsvelte/core@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [5249477]
- Updated dependencies [796cb50]
- Updated dependencies [d3250a9]
- Updated dependencies [796cb50]
- Updated dependencies [796cb50]
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

- Updated dependencies [15d7c79]
- Updated dependencies [70c8c82]
- Updated dependencies [89efa48]
- Updated dependencies [3217502]
- Updated dependencies [5531a8d]
- Updated dependencies [6295520]
- Updated dependencies [ef631d6]
  - @ggsvelte/core@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [a1184f3]
  - @ggsvelte/core@0.27.0

## 0.26.2

### Patch Changes

- Updated dependencies [b6d495a]
- Updated dependencies [add63a4]
- Updated dependencies [3b5b07f]
  - @ggsvelte/core@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [3828c57]
- Updated dependencies [4e775d9]
- Updated dependencies [9b51ddf]
  - @ggsvelte/core@0.26.1

## 0.26.0

### Patch Changes

- Updated dependencies [56b856b]
  - @ggsvelte/core@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [36efe51]
- Updated dependencies [7d92209]
- Updated dependencies [8074811]
- Updated dependencies [072640f]
- Updated dependencies [120b5de]
- Updated dependencies [1fbbf45]
- Updated dependencies [d15954d]
- Updated dependencies [7c748ec]
- Updated dependencies [86c36ab]
  - @ggsvelte/core@0.25.0

## 0.24.3

### Patch Changes

- Updated dependencies [a84fd4e]
- Updated dependencies [47a660a]
- Updated dependencies [5d8c5b8]
- Updated dependencies [a8c2292]
  - @ggsvelte/core@0.24.3

## 0.24.2

### Patch Changes

- Updated dependencies [36569c5]
  - @ggsvelte/core@0.24.2

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

- Updated dependencies [45c6cc9]
- Updated dependencies [06afe2c]
- Updated dependencies [95aa7b2]
  - @ggsvelte/core@0.24.1

## 0.24.0

### Patch Changes

- Updated dependencies [a3de79e]
- Updated dependencies [12da8b8]
- Updated dependencies [8c9685f]
- Updated dependencies [8f75979]
- Updated dependencies [375f0d2]
- Updated dependencies [e28fa5f]
- Updated dependencies [4d23a25]
  - @ggsvelte/core@0.24.0

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

### Patch Changes

- Updated dependencies [50e9292]
- Updated dependencies [1d68bcc]
- Updated dependencies [322bc60]
- Updated dependencies [97f739a]
- Updated dependencies [8987d9c]
- Updated dependencies [ccdab47]
- Updated dependencies [c8d7484]
- Updated dependencies [e57bdbf]
- Updated dependencies [9e43af7]
- Updated dependencies [488f170]
- Updated dependencies [a54207b]
- Updated dependencies [9ae7909]
- Updated dependencies [4870c0c]
- Updated dependencies [146c2c8]
  - @ggsvelte/core@0.23.0

## 0.22.0

Initial extraction: the `ggsvelte-render` bin moved here from
`@ggsvelte/svelte` so agent sandboxes can install the spec feedback loop
without the Svelte component library. Release history before 0.22.0 lives in
the `@ggsvelte/svelte` changelog.

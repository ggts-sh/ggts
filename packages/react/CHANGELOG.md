# @ggts-sh/react

## 0.44.0

### Minor Changes

- 0042a00: Add three ggplot2 parity features for grouped charts (#1825):

  - `facet.space` (`"fixed"`, `"free"`, `"free_x"`, `"free_y"`) on the grid form sizes each column or row by the length of its scale, as in `facet_grid(space = ...)`. `<FacetGrid space>` passes it through. `space` on the wrap form fails with `facet-space-without-grid`.
  - `rule`, `hline`, and `vline` take a constant `params.linetype`, as in `geom_hline(linetype = "dashed")`. A constant `aes.linetype` still wins.
  - Position-scale `labels` accepts an array of strings that names each explicit break in order. A length mismatch, or an array without explicit `breaks`, fails with `scale-labels-breaks-length`.

  Migration: none — additive

- 1ce2b48: Add `@ggts-sh/svelte/lean` and `@ggts-sh/react/lean`. These entries export the same API as the default entries but do not call `registerBasic()` on import. Apps register only the geoms and scale kinds their charts use. A point and line Svelte chart drops from 231.5 KB to 205.7 KB gzip; a React scatter drops from 187.4 KB to 157.7 KB. Both entries and the default entries now re-export the per-family register functions (`registerBasicPoints`, `registerOrdinalColor`, `registerDefaultOrdinalColor`, …), and `@ggts-sh/core` exports `registerDefaultOrdinalColor` from its main entry. Migration: none — additive. The default entries keep their behavior.

### Patch Changes

- Updated dependencies [0042a00]
- Updated dependencies [1ce2b48]
- Updated dependencies [f413d5f]
- Updated dependencies [50ffc5e]
  - @ggts-sh/spec@0.44.0
  - @ggts-sh/core@0.44.0
  - @ggts-sh/compose@0.44.0

## 0.43.2

### Patch Changes

- ca0841c: Suppress non-informative constant identity and single-entry manual paint fields from default Inspect tooltip rows and exclude identity paint from axis-group series labels while retaining full fields on public inspection snapshots (#1844).
- Updated dependencies [ca0841c]
- Updated dependencies [18412d6]
  - @ggts-sh/core@0.43.2
  - @ggts-sh/compose@0.43.2
  - @ggts-sh/spec@0.43.2

## 0.43.1

### Patch Changes

- 3e1cf25: Match Svelte default inspect tooltip chrome, solid crosshair guides with axis values, and in-legend focus targets. Share theme, guide, tooltip, and legend layout policies through core. Resume transient inspection immediately when unpinning with the pointer.
- Updated dependencies [866a052]
- Updated dependencies [3e1cf25]
  - @ggts-sh/core@0.43.1
  - @ggts-sh/compose@0.43.1
  - @ggts-sh/spec@0.43.1

## 0.43.0

### Minor Changes

- b68b75c: Share interaction behavior between React and Svelte, render React charts during SSR, and qualify both adapters as installed packages. Add typed React grammar children and complete framework examples.

  Add `ggts check` and `ggts render`, move teaching datasets to `@ggts-sh/core/data` with the Svelte compatibility export, and document the shared agent sandbox workflow in one skill package.

  Rename all seven packages from `@ggsvelte/*` to `@ggts-sh/*`, rename the Svelte migration executable to `ggts-codemod`, and serve documentation at `https://ggts.sh`. Existing old-scope installations remain available.

  Migration: https://ggts.sh/guide/upgrading#0-42-to-0-43

### Patch Changes

- Updated dependencies [b68b75c]
  - @ggts-sh/spec@0.43.0
  - @ggts-sh/core@0.43.0
  - @ggts-sh/compose@0.43.0

## 0.42.0

### Minor Changes

- c390b04: Add `@ggsvelte/react`, a React DOM adapter over the same core pipeline and ggplot2 names as `@ggsvelte/svelte`. Shared spec assembly lives in `@ggsvelte/compose`.

  Migration: none — additive

### Patch Changes

- Updated dependencies [c390b04]
  - @ggsvelte/compose@0.42.0
  - @ggsvelte/core@0.42.0
  - @ggsvelte/spec@0.42.0

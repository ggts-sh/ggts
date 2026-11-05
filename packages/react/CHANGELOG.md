# @ggts-sh/react

## 0.48.3

### Patch Changes

- @ggts-sh/compose@0.48.3
  - @ggts-sh/core@0.48.3
  - @ggts-sh/spec@0.48.3

## 0.48.2

### Patch Changes

- d6a3020: A click on an entry of the second legend now presses that entry in the React host when two legends have entries with the same rows. The React host used to press the matching entry of the first legend. When emphasis keys from a controller match two entries, the React host now presses none, as the Svelte host does.
- Updated dependencies [0778dba]
- Updated dependencies [4c48a38]
- Updated dependencies [d4b3d6e]
- Updated dependencies [0e6ec1b]
- Updated dependencies [295bcb9]
- Updated dependencies [d6a3020]
  - @ggts-sh/core@0.48.2
  - @ggts-sh/compose@0.48.2
  - @ggts-sh/spec@0.48.2

## 0.48.1

### Patch Changes

- ce6e8d4: Stop walking every source row on each hover of a stat mark. Smooth and density lines have many vertices that share one list of source rows, and each pointer move walked that list again. At 100k rows, a hover along a smooth line now takes under 1 ms, from about 58 ms in React and 24 ms in Svelte. In React, a selection change on such a line takes about 4 ms, from about 1.5 s, because the hook no longer walks the rows once per vertex. Inspection results do not change. Snapshots of the same line now share one frozen `sourceKeys` array, so compare its contents and not its identity. `@ggts-sh/core/interaction` adds the experimental `createSourceKeysCache`, and `materializeInspection` takes an optional cache as a last argument.
- 90da79a: Stop rebuilding the interaction overlay and the pressed legend state on each pointer move. Each move copied every candidate, looked up the selected and emphasized anchors again, and built new key sets for each legend entry. On a 100k-point chart, a hover move goes from 16 ms to 1 ms, from about 240 ms to about 2 ms with 30k points selected, and from about 76 ms to about 2 ms with a legend entry pressed. Rendered output does not change.
- 9277260: Stop rebuilding SVG markup when only the interaction masks change on a canvas chart. Each paint for a selection, an emphasis, a legend press, or a `muteSiblings` hover rebuilt the SVG of the axes and labels and compared it with the DOM. On 7 years of daily bars, a `muteSiblings` hover move goes from 19 ms to 2 ms. Charts with few SVG nodes do not change. Rendered output does not change. An outside edit to that SVG, such as one from a browser extension, now stays until the scene changes, where each paint used to undo it.
- Updated dependencies [ce6e8d4]
- Updated dependencies [1895671]
- Updated dependencies [1789dd4]
- Updated dependencies [d4d2d3e]
- Updated dependencies [2c682e8]
- Updated dependencies [fd27a43]
- Updated dependencies [e217bb4]
- Updated dependencies [0723e4a]
  - @ggts-sh/core@0.48.1
  - @ggts-sh/compose@0.48.1
  - @ggts-sh/spec@0.48.1

## 0.48.0

### Patch Changes

- Updated dependencies [0747ef9]
- Updated dependencies [3a31b29]
- Updated dependencies [4da628c]
- Updated dependencies [c271088]
  - @ggts-sh/core@0.48.0
  - @ggts-sh/spec@0.48.0
  - @ggts-sh/compose@0.48.0

## 0.47.0

### Patch Changes

- Updated dependencies [00e1f32]
- Updated dependencies [00e1f32]
  - @ggts-sh/spec@0.47.0
  - @ggts-sh/core@0.47.0
  - @ggts-sh/compose@0.47.0

## 0.46.0

### Patch Changes

- Updated dependencies [d13aa0b]
  - @ggts-sh/spec@0.46.0
  - @ggts-sh/core@0.46.0
  - @ggts-sh/compose@0.46.0

## 0.45.0

### Patch Changes

- Updated dependencies [ede3ce2]
- Updated dependencies [5d793ac]
- Updated dependencies [e5a62ce]
  - @ggts-sh/spec@0.45.0
  - @ggts-sh/core@0.45.0
  - @ggts-sh/compose@0.45.0

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

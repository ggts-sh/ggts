# @ggts-sh/compose

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

### Minor Changes

- c390b04: Add `@ggsvelte/react`, a React DOM adapter over the same core pipeline and ggplot2 names as `@ggsvelte/svelte`. Shared spec assembly lives in `@ggsvelte/compose`.

  Migration: none — additive

### Patch Changes

- @ggsvelte/spec@0.42.0

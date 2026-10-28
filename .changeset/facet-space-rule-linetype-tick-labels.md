---
"@ggts-sh/spec": minor
"@ggts-sh/core": minor
"@ggts-sh/svelte": minor
"@ggts-sh/react": minor
"@ggts-sh/skill": patch
---

Add three ggplot2 parity features for grouped charts (#1825):

- `facet.space` (`"fixed"`, `"free"`, `"free_x"`, `"free_y"`) on the grid form sizes each column or row by the length of its scale, as in `facet_grid(space = ...)`. `<FacetGrid space>` passes it through. `space` on the wrap form fails with `facet-space-without-grid`.
- `rule`, `hline`, and `vline` take a constant `params.linetype`, as in `geom_hline(linetype = "dashed")`. A constant `aes.linetype` still wins.
- Position-scale `labels` accepts an array of strings that names each explicit break in order. A length mismatch, or an array without explicit `breaks`, fails with `scale-labels-breaks-length`.

Migration: none — additive

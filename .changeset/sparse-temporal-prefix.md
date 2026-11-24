---
"@ggts-sh/spec": minor
---

Add the `sparse-temporal-prefix` spec-lint advisory. On data-bearing specs it warns when a layer maps a temporal `x` column with at least 5 distinct parsed values whose earliest value `x[0]` accounts for at most 10% of valid rows and sits at least 5 calendar years and 3× the remaining median spacing ahead of `x[1]`, excluding pinned `scales.x.domain` bounds that already drop `x[0]`. `lintSpec()`, `validate(spec, { lint: true })`, and `ggts check` surface it alongside a `scales.x.domain` suggestion; the advisory never blocks a render.

Migration: none — additive.

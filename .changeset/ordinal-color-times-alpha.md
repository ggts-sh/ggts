---
"@ggts-sh/spec": minor
---

Add the `ordinal-color-times-alpha` spec-lint advisory. On data-bearing specs it warns when a discrete `color` or `fill` scale with more than four classes co-occurs on a layer with a quantitative `alpha` field whose scale interpolates continuously (`type` omitted or `"sequential"` with a non-degenerate numeric range), producing a hue-by-opacity grid that exceeds roughly eight distinguishable shades. `lintSpec()` and `validate(spec, { lint: true })` emit the advisory at `/scales/color` or `/scales/fill` with suggestions to encode one variable via position or small multiples, drop `alpha` to a constant, or bin `alpha` into at most two steps.

Migration: none — additive.

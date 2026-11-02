---
"@ggts-sh/spec": minor
"@ggts-sh/skill": patch
---

Add the `area-over-period-totals` spec-lint advisory. On data-bearing specs it warns when an `area` layer's x sits on a regular calendar grid (every value the first day of a year, quarter or month, or an integer year on a linear scale) while the layer holds one total per period — an interior run of zeros or missing x between non-zero values, or, for per-period counts (non-negative integers whose series rise and fall rather than accumulate), fewer than about 30 distinct x values. The area then draws slopes between period boundaries where the data has no value. `lintSpec()` and `validate(spec, { lint: true })` surface it alongside a `col` + `position: "stack"` suggestion; the advisory never blocks a render.

Migration: none — additive.

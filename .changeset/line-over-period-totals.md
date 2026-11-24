---
"@ggts-sh/spec": minor
---

Add the `line-over-period-totals` spec-lint advisory. On data-bearing specs it warns when a `line` or `step` layer (with `identity` or default stat) has `x` on a regular calendar grid (year, quarter, or month starts in UTC, or integer years on a linear scale) across 8 or more distinct periods while `y` holds jagged non-negative integer counts. `lintSpec()` and `validate(spec, { lint: true })` surface it alongside guidance to plot cumulative stock or signed deltas from the finest dated data, or to label a per-period count in the chart title.

Migration: none — additive.

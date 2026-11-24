---
"@ggts-sh/spec": patch
---

Preserve `null` entries in `layerEvidence` inside `collectPeriodTotalAdvisories()` so `area`, `line`, and `step` layers using unresolved runtime datasets (`data: { name: "..." }`) do not fall back to plot-level `spec.data` and emit false-positive `area-over-period-totals` or `line-over-period-totals` advisories.

---
"@ggts-sh/core": patch
---

Vertical band axes now use the measured label planner. Crowded category labels thin only at high cardinality with a `band-label-overlap` diagnostic; fewer categories stay labeled and report overlap. Authors can keep every label with `scales.*.guide.mode: "single"` or `collision: "preserve"`.

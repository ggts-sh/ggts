---
"@ggts-sh/spec": patch
---

Require `dy` and `positionParams.y` to agree in direction without opposing shifts in `bar-end-label-offset` under `coord: { type: "flip" }`. Previously, a correctly signed `positionParams.y` suppressed the advisory even when paired with an opposing `dy` that shifted the label back inside or outside the bar.

---
"@ggts-sh/core": minor
---

Add the `facet-grid-too-tall` pipeline warning when a multi-row facet grid exceeds 1200 px in height. The warning reports the rendered grid height, row count, and bottom x-axis title `y` coordinate, and is not suppressed by `theme.panelAspect: "free"` or constrained coordinates while retaining degenerate viewport and placement guards.

Migration: none — additive.

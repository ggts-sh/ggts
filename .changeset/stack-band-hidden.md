---
"@ggts-sh/core": minor
---

Renders now warn with `stack-band-hidden` when a stacked area, col, or bar layer has groups whose bands never reach 2 px of thickness at the rendered size, naming the hidden groups as their rendered fill-legend keys. The warning only fires when a discrete fill legend is actually drawn. It suggests merging small groups into "Other", faceting by group with free y scales, `position: "fill"` to compare shares, or one line per group on a log y scale. Plain, flipped, and fixed-aspect Cartesian coordinates are measured exactly. Coordinate transforms are measured when their y projection is identity with no viewport limits; radial, sf, limited, and nonlinear-y transforms are excluded.

Migration: none — additive.

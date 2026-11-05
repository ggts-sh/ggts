---
"@ggts-sh/core": patch
---

A stacked area under a pinned y domain that excludes 0 no longer writes path vertices outside the panel. The same holds for density areas and smooth confidence bands. Where an edge leaves the panel, the path now ends at the panel edge on the original line, so the drawn shape does not change. Panels that do not clip, such as polar panels by default, keep their paths as before.

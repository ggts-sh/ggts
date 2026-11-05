---
"@ggts-sh/core": patch
---

A violin with `trim: false` under a pinned y domain no longer writes path vertices outside the panel. Where the outline leaves the panel, the path now ends at the panel edge on the original line, so the drawn shape does not change. Panels that do not clip keep their paths as before.

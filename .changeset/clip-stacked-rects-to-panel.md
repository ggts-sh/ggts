---
"@ggts-sh/core": patch
---

Clip `col`/`bar` rect geometry to the panel. Bar edges are synthesized from a zero baseline, so an author-pinned y domain that excludes 0 projected that baseline far outside the panel: one stacked segment drew taller than the panel and the rest collapsed to 0 px (#1897). Rect bounds now clamp to the panel's data rect, which is exact for axis-aligned rects and matches panel clipping.

Migration: none — internal.

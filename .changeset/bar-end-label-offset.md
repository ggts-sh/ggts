---
"@ggts-sh/spec": minor
---

Add the `bar-end-label-offset` spec-lint advisory (`needs: "spec"`). It flags `text` and `label` layers that set `params.anchor` to `"start"` or `"end"` over a `col` or `bar` (`stat !== "bin"`) layer sharing the same panel and categorical `x` (plus `y` for `col`), where the anchor places the label's edge at the bar's value end instead of centering over the mark. Suggests `{ params: { anchor: "middle" } }` (with `params.dy` for vertical offsets and a note on stacked segments).

Migration: none — additive.

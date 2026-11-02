---
"@ggts-sh/core": minor
"@ggts-sh/spec": minor
---

Warn when text or label marks overlap within the same layer and panel (#1881).

`text` and `label` layers now measure rendered text boxes after layout and emit
`text-label-overlap` naming the layer and panel indices and the number of
unique overlapping marks. `params.checkOverlap` is opt-in (default `false`):
set it to `true` to greedily keep labels in draw order and drop later labels
that collide with an earlier retained label, which keeps the warning silent.
No repulsion or nudging is added, and the SF label variants are unchanged.

Migration: none — additive

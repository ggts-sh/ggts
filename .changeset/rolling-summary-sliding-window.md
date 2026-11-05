---
"@ggts-sh/core": patch
---

Compute `stat: "summary_rolling"` with a sliding window instead of sorting every
window. `mean`, `sum`, `min` and `max` now take O(n) after the group sort, and
`median` moves rows in one sorted array. A 100k-row line with a 1440-row window
goes from about 10 s to tens of milliseconds. Output rows and order do not change.
Values do not change, with three exceptions: floating-point rounding in `mean` and
`sum`, overflow in `mean` and `sum` for values near the limit of a double, and the
sign of a zero median when a window mixes 0 and -0.

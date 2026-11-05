---
"@ggts-sh/core": patch
---

Quantile fits no longer evaluate every pairwise slope at up to 150 rows per group. Because the loss is convex in the slope, the fit now skips slopes that cannot win. A chart with 20 groups of 150 rows now runs the pipeline in about 54 ms, not 695 ms, and 50 groups take about 132 ms, not 1.8 s.

Fitted lines do not change, including which line wins when the best fit is not unique. Data where no slope can be skipped, such as `x` packed into a tiny span far from zero, takes up to about 6% longer.

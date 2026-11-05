---
"@ggts-sh/core": patch
---

Fit `stat: "quantile"` without sorting the residuals for every candidate slope. Each
slope now uses a selection in one reused buffer, and the slope search skips repeated
work. Three quantiles over 150 rows go from about 400 ms to about 30 ms, and over
20,000 rows from about 2 s to about 40 ms. The fitted lines do not change, apart
from the sign of a zero intercept.

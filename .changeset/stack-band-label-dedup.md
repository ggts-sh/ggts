---
"@ggts-sh/core": patch
---

The stacked band warning no longer scans its group names once per hidden band. A stack with one fill level per row and 8,000 levels now runs the pipeline in about 12 ms, not 52 ms, and 64,000 levels take about 120 ms, not 2.5 s. A stack with up to 1,000 fill levels shows no visible change. The warning text does not change.

---
"@ggts-sh/core": patch
---

Stacked and filled `geomCol` layers no longer run a linear search per candidate when a scale `domain` drops some of their rects. The search made the candidate store build in O(rects × rows). It now builds one lookup per layer, only for a layer with a drop. That lookup costs about 25 bytes per row while the layer's frame is alive.

Candidate values do not change. Up to about 4,000 rows the time does not change. Under node, the first read of all candidates goes from 43 ms to 16 ms at 16,000 rows, from 492 ms to 85 ms at 64,000 rows, and from 1.8 s to 195 ms at 128,000 rows, when the domain leaves out the first category.

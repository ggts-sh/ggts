---
"@ggts-sh/core": patch
---

Check text and label overlap against kept labels in bands instead of comparing every pair. The check runs on each `geomText` and `geomLabel` batch, so large label layers paid for it even when the only result was a warning. In a scatter of labels inside the panel, 8,000 labels go from about 140 ms to about 2 ms, and 32,000 labels from about 2.3 s to about 8 ms. With clipping off, labels spread far outside the panel can still crowd one band, for example one long row with far outliers. Those layouts still cost about as much as comparing every pair, and the worst one found runs about 2.4 times slower (8,000 labels: 80 ms against 33 ms). The warning count and the labels that `checkOverlap` removes do not change.

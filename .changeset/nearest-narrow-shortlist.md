---
"@ggts-sh/core": patch
---

Search fewer candidates in `nearest` on each pointer move. Auto mode, the default for hover, no longer scans candidates that cannot match along an axis, and a search tries a narrow radius before the full radius. A 128,000-point scatter goes from about 5 ms to about 0.02 ms per move, a 4,000-point scatter from about 0.1 ms to about 0.003 ms, and a 128,000-point line from about 5 ms to about 0.3 ms. Results for a finite pointer position do not change, including ties. Filled areas take the same time as before. If the narrow search settles nothing, the full search runs as well, so a chart with many candidates in one column can take up to twice as long on some moves. Charts that mix points with lines or segments build their hover index up to about 17% slower, and keep about 5 to 8 MB more at 128,000 candidates.

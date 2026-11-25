---
"@ggts-sh/spec": patch
---

Keep the bounded temporal inference sample in one array. Numeric columns avoid initializing a second sample buffer, and the first and last sampled values retain their order.

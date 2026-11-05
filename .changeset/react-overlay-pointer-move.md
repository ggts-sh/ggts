---
"@ggts-sh/react": patch
---

Stop rebuilding the interaction overlay and the pressed legend state on each pointer move. Each move copied every candidate, looked up the selected and emphasized anchors again, and built new key sets for each legend entry. On a 100k-point chart, a hover move goes from 16 ms to 1 ms, from about 240 ms to about 2 ms with 30k points selected, and from about 76 ms to about 2 ms with a legend entry pressed. Rendered output does not change.

---
"@ggts-sh/spec": patch
---

Automatic date inference now stops sampling a column when it finds a number or boolean. A number column is never a date column, so the rest of the pass only counts values. `parseTemporalColumn` also skips the second fill of its output arrays when no value was written. Results are unchanged.

---
"@ggts-sh/core": patch
---

The full build no longer converts a non-temporal column twice. `ColumnTable.parsed()` re-ran `cellsToNumeric` on nominal columns after date inference (an ISO probe and `Number()` on every cell), and `fieldType()` then rescanned the raw column, so groups of label strings cost about twice what the lean build pays. Nominal `auto` columns now take the lean shape split in a single pass: pure number columns copy values, pure non-ISO label columns get an all-invalid semantic view, and mixed or numeric-text columns keep the full coercion.

The temporal decision (parser key, evidence, non-null count, status) is unchanged. The parsed view and the field type now match the lean build exactly, which also settles the `Infinity`-shaped label cells the full build used to coerce.

`ColumnTable.parsed()` plus `fieldType()` on 10k label strings: about 115 us to 50 us. On 10k numbers: about 40 us to 23 us.
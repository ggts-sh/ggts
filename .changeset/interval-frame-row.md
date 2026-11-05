---
"@ggts-sh/core": patch
---

Candidates for `geomErrorbar`, `geomLinerange`, `geomPointrange` and `geomCrossbar` with a computed stat now report the right data after a scale `domain` leaves out categories. Before, the first categories of the data appeared in place of the kept ones, so `x` and `y` values belonged to the wrong mark. A domain that drops only the last categories was not affected.

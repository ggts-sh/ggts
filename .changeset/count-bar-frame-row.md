---
"@ggts-sh/core": patch
---

Candidates for bars, count points and boxplots now report the right data after a scale `domain` leaves out categories. Before, the first categories of the data appeared in place of the kept ones, so `x` and `y` values (and `position: "fill"` shares) belonged to the wrong bar. A domain that drops only the last categories was not affected.

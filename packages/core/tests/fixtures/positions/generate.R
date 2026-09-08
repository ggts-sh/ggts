#!/usr/bin/env Rscript
# M1 stat/position parity fixture generator (extends the M0a-5 grouping
# pattern). Extracts ggplot2's stat_count output and position_stack /
# position_fill / position_dodge geometry through the public layer_data()
# API for fixed synthetic datasets, and writes one JSON fixture per case.
#
# Expected rows are keyed by (x value, group value) so comparisons are
# order-independent. Datasets are chosen so first-occurrence order equals
# factor-level (alphabetical) order: ggts canonicalizes groups by first
# occurrence while ggplot2 uses factor levels — with aligned orders the
# fixtures pin the shared semantics (decision 0008 documents the deviation
# for unaligned data).
#
# Run from anywhere:  Rscript packages/core/tests/fixtures/positions/generate.R

suppressPackageStartupMessages({
  library(ggplot2)
  library(jsonlite)
})

out_dir <- dirname(sub("--file=", "", grep("--file=", commandArgs(FALSE), value = TRUE)[1]))
if (is.na(out_dir) || out_dir == "") out_dir <- "."

emit <- function(id, name, description, ggplot_call, data, expected) {
  fixture <- list(
    case = sprintf("%02d-%s", id, name),
    description = description,
    provenance = "R-generated",
    ggplot2Version = as.character(packageVersion("ggplot2")),
    rVersion = paste(R.version$major, R.version$minor, sep = "."),
    ggplotCall = ggplot_call,
    data = data,
    expected = expected
  )
  path <- file.path(out_dir, sprintf("%02d-%s.json", id, name))
  write_json(fixture, path, auto_unbox = TRUE, pretty = TRUE, digits = NA)
  cat("wrote", path, "\n")
}

# --------------------------------------------------------------- datasets ---
# First-occurrence order == alphabetical order (see header).

df_count <- data.frame(
  x = c("a", "a", "b", "b", "c", "c", "c", "a"),
  g = c("g1", "g2", "g1", "g2", "g1", "g2", "g1", "g1"),
  w = c(1, 2, 3, 4, 5, 6, 7, 8),
  stringsAsFactors = FALSE
)

df_stack <- data.frame(
  x = c("p", "p", "p", "q", "q", "q"),
  g = c("g1", "g2", "g3", "g1", "g2", "g3"),
  y = c(3, 2, 5, 1, 4, 2),
  stringsAsFactors = FALSE
)

df_mixed <- data.frame(
  x = c("p", "p", "p", "q", "q", "q"),
  g = c("g1", "g2", "g3", "g1", "g2", "g3"),
  y = c(3, -2, 5, -1, 4, -2),
  stringsAsFactors = FALSE
)

# ---------------------------------------------------------------- helpers ---

# layer_data with the x band label restored from the factor code and the
# group label carried through aes(label = g) — ggplot2's group id is the
# x-by-g INTERACTION here (both are discrete), so it cannot label g itself.
bars <- function(p, df) {
  ld <- layer_data(p)
  ld$x_label <- levels(factor(df$x))[round(as.numeric(ld$x))]
  ld$g_label <- ld$label
  ld
}

count_expected <- function(ld) {
  lapply(seq_len(nrow(ld)), function(i) {
    list(x = ld$x_label[i], g = ld$g_label[i], count = ld$count[i])
  })
}

stack_expected <- function(ld) {
  lapply(seq_len(nrow(ld)), function(i) {
    list(x = ld$x_label[i], g = ld$g_label[i], ymin = ld$ymin[i], ymax = ld$ymax[i])
  })
}

dodge_expected <- function(ld) {
  lapply(seq_len(nrow(ld)), function(i) {
    center <- round(as.numeric(ld$x[i]))
    list(
      x = ld$x_label[i], g = ld$g_label[i],
      xminOffset = ld$xmin[i] - center,
      xmaxOffset = ld$xmax[i] - center,
      ymin = ld$ymin[i], ymax = ld$ymax[i]
    )
  })
}

df_json <- function(df) as.list(df)

# ------------------------------------------------------------------ cases ---

# 1. stat_count per x (single group)
p <- ggplot(df_count, aes(x)) + geom_bar()
emit(1, "count-by-x",
     "stat_count: rows counted per distinct x value (one group).",
     "ggplot(df, aes(x)) + geom_bar()",
     df_json(df_count["x"]),
     count_expected({ ld <- layer_data(p); ld$x_label <- levels(factor(df_count$x))[round(as.numeric(ld$x))]; ld$g_label <- "all"; ld }))

# 2. stat_count per x within fill groups
p <- ggplot(df_count, aes(x, fill = g, label = g)) + geom_bar()
emit(2, "count-by-x-and-fill",
     "stat_count: rows counted per (x, fill group) combination.",
     "ggplot(df, aes(x, fill = g, label = g)) + geom_bar()",
     df_json(df_count[c("x", "g")]),
     count_expected(bars(p, df_count)))

# 3. stat_count with weights (weight sums replace row counts)
p <- ggplot(df_count, aes(x, fill = g, label = g, weight = w)) + geom_bar()
emit(3, "count-weighted",
     "stat_count with aes(weight): count = sum of weights per (x, group).",
     "ggplot(df, aes(x, fill = g, label = g, weight = w)) + geom_bar()",
     df_json(df_count),
     count_expected(bars(p, df_count)))

# 4. position_stack on geom_col (all-positive; pins the stacking ORDER)
p <- ggplot(df_stack, aes(x, y, fill = g, label = g)) + geom_col(position = "stack")
emit(4, "stack-positive",
     "position_stack: per-x cumulative ymin/ymax; first group level on top.",
     "ggplot(df, aes(x, y, fill = g, label = g)) + geom_col(position = 'stack')",
     df_json(df_stack),
     stack_expected(bars(p, df_stack)))

# 5. position_stack with mixed signs (positives up, negatives down)
p <- ggplot(df_mixed, aes(x, y, fill = g, label = g)) + geom_col(position = "stack")
emit(5, "stack-mixed-sign",
     "position_stack with mixed signs: positive values stack up from 0, negative values stack down from 0.",
     "ggplot(df, aes(x, y, fill = g, label = g)) + geom_col(position = 'stack')",
     df_json(df_mixed),
     stack_expected(bars(p, df_mixed)))

# 6. position_fill (per-x proportions of 1)
p <- ggplot(df_stack, aes(x, y, fill = g, label = g)) + geom_col(position = "fill")
emit(6, "fill-proportions",
     "position_fill: stacked values rescale to proportions summing to 1 per x.",
     "ggplot(df, aes(x, y, fill = g, label = g)) + geom_col(position = 'fill')",
     df_json(df_stack),
     stack_expected(bars(p, df_stack)))

# 7. position_dodge slot assignment (offsets from the band center, width 0.9)
p <- ggplot(df_stack, aes(x, y, fill = g, label = g)) + geom_col(position = "dodge")
emit(7, "dodge-slots",
     "position_dodge: every group gets one slot per x; offsets from the band center in resolution units (total width 0.9).",
     "ggplot(df, aes(x, y, fill = g, label = g)) + geom_col(position = 'dodge')",
     df_json(df_stack),
     dodge_expected(bars(p, df_stack)))

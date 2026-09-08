#!/usr/bin/env Rscript
# M2 statistical-layer parity fixture generator (same pattern as
# fixtures/positions/generate.R). Extracts ggplot2's stat_bin, stat_smooth
# (lm + loess), stat_boxplot, and mean_se stat_summary output through the
# public layer_data() API, plus stats::density() reference curves, for fixed
# synthetic datasets. One JSON fixture per case.
#
# Loess parity targets (decision 0010 / #1422): case 22 pins ggplot2's DEFAULT
# loess path (surface = "interpolate", statistics = "approximate") on small n;
# case 23 pins the exact/direct path (loess.control(surface = "direct",
# statistics = "exact")) that ggts uses for n ≤ INTERPOLATE_DIRECT_LIMIT;
# case 25 pins the large-n interpolate path (n=1200) vs R defaults.
#
# Run from anywhere:  Rscript packages/core/tests/fixtures/stats/generate.R

suppressPackageStartupMessages({
  library(ggplot2)
  library(jsonlite)
})

out_dir <- dirname(sub("--file=", "", grep("--file=", commandArgs(FALSE), value = TRUE)[1]))
if (is.na(out_dir) || out_dir == "") out_dir <- "."

emit <- function(id, name, description, ggplot_call, data, expected, extra = NULL) {
  fixture <- c(
    list(
      case = sprintf("%02d-%s", id, name),
      description = description,
      provenance = "R-generated",
      ggplot2Version = as.character(packageVersion("ggplot2")),
      rVersion = paste(R.version$major, R.version$minor, sep = "."),
      ggplotCall = ggplot_call,
      data = data,
      expected = expected
    ),
    extra
  )
  path <- file.path(out_dir, sprintf("%02d-%s.json", id, name))
  write_json(fixture, path, auto_unbox = TRUE, pretty = TRUE, digits = NA)
  cat("wrote", path, "\n")
}

df_json <- function(df) as.list(df)

# --------------------------------------------------------------- datasets ---

set.seed(4213)
# Continuous variable for binning/density: bimodal-ish, includes negatives.
xbin <- round(c(rnorm(60, 2, 1.5), rnorm(40, 8, 2.5)), 6)
wbin <- round(runif(100, 0.5, 3), 6)
gbin <- rep(c("g1", "g2"), each = 50) # first-occurrence == alphabetical

df_bin <- data.frame(x = xbin, w = wbin, g = gbin, stringsAsFactors = FALSE)

# Scatter for smoothing: quadratic-ish trend + noise, n = 60.
xs <- round(sort(runif(60, 0, 10)), 6)
ys <- round(3 + 1.5 * xs - 0.12 * xs^2 + rnorm(60, 0, 1.2), 6)
df_smooth <- data.frame(x = xs, y = ys)

# Boxplot: three categories, one with clear outliers.
df_box <- data.frame(
  x = rep(c("a", "b", "c"), times = c(30, 25, 20)),
  y = round(c(rnorm(30, 10, 2), rnorm(25, 14, 3), c(rnorm(18, 8, 1), 25, -6)), 6),
  stringsAsFactors = FALSE
)

# Summary (mean_se): 4 categories, uneven sizes.
df_sum <- data.frame(
  x = rep(c("p", "q", "r", "s"), times = c(8, 12, 5, 9)),
  y = round(rnorm(34, 20, 4), 6),
  stringsAsFactors = FALSE
)

# Density: single group + a grouped pair.
df_dens <- data.frame(
  x = round(c(rnorm(80, 0, 1), rnorm(40, 4, 0.7)), 6),
  g = rep(c("g1", "g2"), times = c(80, 40)),
  stringsAsFactors = FALSE
)

# ------------------------------------------------------------- bin cases ---

bin_expected <- function(ld, g = NULL) {
  lapply(seq_len(nrow(ld)), function(i) {
    row <- list(
      x = ld$x[i], xmin = ld$xmin[i], xmax = ld$xmax[i],
      count = ld$count[i], density = ld$density[i], ncount = ld$ncount[i],
      ndensity = ld$ndensity[i]
    )
    if (!is.null(g)) row$g <- ld$g_label[i]
    row
  })
}

p <- ggplot(df_bin, aes(x)) + geom_histogram()
emit(10, "bin-default-bins",
     "stat_bin defaults: bins = 30, first bin centered on min(x), closed right.",
     "ggplot(df, aes(x)) + geom_histogram()",
     df_json(df_bin["x"]), bin_expected(layer_data(p)))

p <- ggplot(df_bin, aes(x)) + geom_histogram(binwidth = 1.25, boundary = 0)
emit(11, "bin-binwidth-boundary",
     "stat_bin with binwidth + boundary: bin edges aligned to multiples of the width.",
     "ggplot(df, aes(x)) + geom_histogram(binwidth = 1.25, boundary = 0)",
     df_json(df_bin["x"]), bin_expected(layer_data(p)))

p <- ggplot(df_bin, aes(x)) + geom_histogram(binwidth = 1.25, center = 0)
emit(12, "bin-binwidth-center",
     "stat_bin with binwidth + center: a bin centered on 0.",
     "ggplot(df, aes(x)) + geom_histogram(binwidth = 1.25, center = 0)",
     df_json(df_bin["x"]), bin_expected(layer_data(p)))

p <- ggplot(df_bin, aes(x)) + geom_histogram(binwidth = 2, boundary = 0, closed = "left")
emit(13, "bin-closed-left",
     "stat_bin closed = 'left': bins are [lo, hi); edge values land in the upper bin.",
     "ggplot(df, aes(x)) + geom_histogram(binwidth = 2, boundary = 0, closed = 'left')",
     df_json(df_bin["x"]), bin_expected(layer_data(p)))

# Integer data on integer edges: the closed rule decides the counts.
df_int <- data.frame(x = c(0, 1, 1, 2, 2, 2, 3, 4, 4, 5))
p <- ggplot(df_int, aes(x)) + geom_histogram(binwidth = 1, boundary = 0)
emit(14, "bin-edges-closed-right",
     "Integer values ON bin edges with closed = 'right' (default): x = k lands in (k-1, k].",
     "ggplot(df, aes(x)) + geom_histogram(binwidth = 1, boundary = 0)",
     df_json(df_int), bin_expected(layer_data(p)))

p <- ggplot(df_int, aes(x)) + geom_histogram(binwidth = 1, boundary = 0, closed = "left")
emit(15, "bin-edges-closed-left",
     "Integer values ON bin edges with closed = 'left': x = k lands in [k, k+1).",
     "ggplot(df, aes(x)) + geom_histogram(binwidth = 1, boundary = 0, closed = 'left')",
     df_json(df_int), bin_expected(layer_data(p)))

p <- ggplot(df_bin, aes(x, weight = w)) + geom_histogram(binwidth = 2, boundary = 0)
emit(16, "bin-weighted",
     "stat_bin with aes(weight): count = sum of weights per bin; density/ncount follow.",
     "ggplot(df, aes(x, weight = w)) + geom_histogram(binwidth = 2, boundary = 0)",
     df_json(df_bin[c("x", "w")]), bin_expected(layer_data(p)))

p <- ggplot(df_bin, aes(x, fill = g, label = g)) + geom_histogram(binwidth = 2.5, boundary = 0)
ld <- layer_data(p); ld$g_label <- ld$label
emit(17, "bin-grouped-stack",
     "stat_bin per fill group over SHARED breaks (scale-range based), stacked; zero bins kept.",
     "ggplot(df, aes(x, fill = g, label = g)) + geom_histogram(binwidth = 2.5, boundary = 0)",
     df_json(df_bin[c("x", "g")]),
     lapply(seq_len(nrow(ld)), function(i) list(
       g = ld$g_label[i], x = ld$x[i], xmin = ld$xmin[i], xmax = ld$xmax[i],
       count = ld$count[i], stackYmin = ld$ymin[i], stackYmax = ld$ymax[i]
     )))

# ---------------------------------------------------------- smooth cases ---

smooth_expected <- function(ld) {
  lapply(seq_len(nrow(ld)), function(i) list(
    x = ld$x[i], y = ld$y[i], ymin = ld$ymin[i], ymax = ld$ymax[i], se = ld$se[i]
  ))
}

p <- ggplot(df_smooth, aes(x, y)) + geom_smooth(method = "lm", n = 80, level = 0.95)
emit(20, "smooth-lm-se",
     "stat_smooth method = 'lm': exact closed-form fit and 95% t-band at 80 points.",
     "ggplot(df, aes(x, y)) + geom_smooth(method = 'lm', n = 80)",
     df_json(df_smooth), smooth_expected(layer_data(p)))

p <- ggplot(df_smooth, aes(x, y)) + geom_smooth(method = "lm", n = 40, level = 0.99)
emit(21, "smooth-lm-level99",
     "stat_smooth lm at level = 0.99 and n = 40 (pins the t quantile handling).",
     "ggplot(df, aes(x, y)) + geom_smooth(method = 'lm', n = 40, level = 0.99)",
     df_json(df_smooth), smooth_expected(layer_data(p)))

p <- ggplot(df_smooth, aes(x, y)) + geom_smooth(method = "loess", n = 80, span = 0.75)
emit(22, "smooth-loess-default",
     "stat_smooth loess with R DEFAULTS (surface interpolate, statistics approximate) — the tolerance target.",
     "ggplot(df, aes(x, y)) + geom_smooth(method = 'loess', n = 80, span = 0.75)",
     df_json(df_smooth), smooth_expected(layer_data(p)))

p <- ggplot(df_smooth, aes(x, y)) + geom_smooth(
  method = "loess", n = 80, span = 0.75,
  method.args = list(control = loess.control(surface = "direct", statistics = "exact"))
)
emit(23, "smooth-loess-direct-exact",
     "stat_smooth loess with surface = 'direct', statistics = 'exact' — the analytic parity target.",
     "geom_smooth(method = 'loess', method.args = list(control = loess.control(surface = 'direct', statistics = 'exact')))",
     df_json(df_smooth), smooth_expected(layer_data(p)))

p <- ggplot(df_smooth, aes(x, y)) + geom_smooth(
  method = "loess", n = 60, span = 0.4, se = TRUE,
  method.args = list(degree = 1, control = loess.control(surface = "direct", statistics = "exact"))
)
emit(24, "smooth-loess-degree1-span04",
     "loess degree = 1, span = 0.4 (direct/exact): pins the degree and span handling.",
     "geom_smooth(method = 'loess', n = 60, span = 0.4, method.args = list(degree = 1, control = ...))",
     df_json(df_smooth), smooth_expected(layer_data(p)))

# Large-n loess: R defaults (interpolate/approximate). ggts switches to its
# interpolate surface above INTERPOLATE_DIRECT_LIMIT (500) — see issue #1422.
set.seed(4213)
n_large <- 1200
xs_large <- round(sort(runif(n_large, 0, 10)), 6)
ys_large <- round(3 + 1.5 * xs_large - 0.12 * xs_large^2 + rnorm(n_large, 0, 1.2), 6)
df_smooth_large <- data.frame(x = xs_large, y = ys_large)
p <- ggplot(df_smooth_large, aes(x, y)) + geom_smooth(method = "loess", n = 80, span = 0.75)
emit(25, "smooth-loess-interpolate-large",
     "Large-n loess (n=1200) with R DEFAULT surface=interpolate / statistics=approximate — pins the ggts interpolate path (#1422).",
     "ggplot(df, aes(x, y)) + geom_smooth(method = 'loess', n = 80, span = 0.75)  # n_data=1200",
     df_json(df_smooth_large), smooth_expected(layer_data(p)),
     list(nData = n_large, surface = "interpolate"))

# --------------------------------------------------------- boxplot cases ---

p <- ggplot(df_box, aes(x, y)) + geom_boxplot()
ld <- layer_data(p)
ld$x_label <- levels(factor(df_box$x))[round(as.numeric(ld$x))]
emit(30, "boxplot-basic",
     "stat_boxplot: type-7 hinges, 1.5 IQR whiskers, outliers beyond the fences.",
     "ggplot(df, aes(x, y)) + geom_boxplot()",
     df_json(df_box),
     lapply(seq_len(nrow(ld)), function(i) list(
       x = ld$x_label[i], ymin = ld$ymin[i], lower = ld$lower[i], middle = ld$middle[i],
       upper = ld$upper[i], ymax = ld$ymax[i], outliers = sort(ld$outliers[[i]])
     )))

p <- ggplot(df_box, aes(x, y)) + geom_boxplot(coef = 0.5)
ld <- layer_data(p)
ld$x_label <- levels(factor(df_box$x))[round(as.numeric(ld$x))]
emit(31, "boxplot-coef05",
     "stat_boxplot with coef = 0.5: short whiskers, many outliers.",
     "ggplot(df, aes(x, y)) + geom_boxplot(coef = 0.5)",
     df_json(df_box),
     lapply(seq_len(nrow(ld)), function(i) list(
       x = ld$x_label[i], ymin = ld$ymin[i], lower = ld$lower[i], middle = ld$middle[i],
       upper = ld$upper[i], ymax = ld$ymax[i], outliers = sort(ld$outliers[[i]])
     )))

# --------------------------------------------------------- summary cases ---

p <- ggplot(df_sum, aes(x, y)) + stat_summary(fun.data = mean_se, geom = "errorbar")
ld <- layer_data(p)
ld$x_label <- levels(factor(df_sum$x))[round(as.numeric(ld$x))]
emit(40, "summary-mean-se",
     "stat_summary mean_se (the default): y = mean, ymin/ymax = mean -/+ sd/sqrt(n).",
     "ggplot(df, aes(x, y)) + stat_summary(fun.data = mean_se, geom = 'errorbar')",
     df_json(df_sum),
     lapply(seq_len(nrow(ld)), function(i) list(
       x = ld$x_label[i], y = ld$y[i], ymin = ld$ymin[i], ymax = ld$ymax[i]
     )))

p <- ggplot(df_sum, aes(x, y)) +
  stat_summary(fun = median, fun.min = min, fun.max = max, geom = "errorbar")
ld <- layer_data(p)
ld$x_label <- levels(factor(df_sum$x))[round(as.numeric(ld$x))]
emit(41, "summary-median-min-max",
     "stat_summary fun = median with fun.min = min / fun.max = max.",
     "stat_summary(fun = median, fun.min = min, fun.max = max, geom = 'errorbar')",
     df_json(df_sum),
     lapply(seq_len(nrow(ld)), function(i) list(
       x = ld$x_label[i], y = ld$y[i], ymin = ld$ymin[i], ymax = ld$ymax[i]
     )))

# --------------------------------------------------------- density cases ---
# Reference: stats::density() directly (bw.nrd0, gaussian, n = 512, cut = 3)
# — ggts keeps R's cut*bw grid tails, where ggplot2 truncates the grid at
# the scale range (documented divergence, decision 0010). count/scaled follow
# ggplot2's definitions (density * n, density / max).

dens_expected <- function(x, n = 512, cut = 3, bw = NULL, adjust = 1) {
  bw_used <- if (is.null(bw)) bw.nrd0(x) else bw
  d <- density(x, bw = bw_used * adjust, kernel = "gaussian", n = n, cut = cut)
  list(
    bw = bw_used * adjust,
    from = min(d$x), to = max(d$x),
    x = d$x, density = d$y,
    count = d$y * length(x), scaled = d$y / max(d$y)
  )
}

x1 <- df_dens$x[df_dens$g == "g1"]
emit(50, "density-basic",
     "stats::density reference: bw.nrd0, gaussian kernel, n = 512, cut = 3.",
     "density(x, bw = 'nrd0', n = 512, cut = 3)",
     list(x = x1), dens_expected(x1))

emit(51, "density-bw-adjust",
     "stats::density with explicit bw = 0.3 and n = 256, cut = 3.",
     "density(x, bw = 0.3, n = 256)",
     list(x = x1), dens_expected(x1, n = 256, bw = 0.3))

x2 <- df_dens$x[df_dens$g == "g2"]
emit(52, "density-group2",
     "stats::density reference for the second (tighter) group.",
     "density(x, bw = 'nrd0', n = 512, cut = 3)",
     list(x = x2), dens_expected(x2))

# ------------------------------------------------------------- qt values ---
# Student-t quantiles pinning stats/numeric.ts's qt() implementation.
qt_cases <- expand.grid(p = c(0.75, 0.95, 0.975, 0.995), df = c(1, 2, 5, 10, 30, 100, 1000))
qt_cases$q <- qt(qt_cases$p, qt_cases$df)
emit(60, "qt-reference",
     "R qt() reference values over the p/df grid the smooth stat uses.",
     "qt(p, df)",
     list(), lapply(seq_len(nrow(qt_cases)), function(i) list(
       p = qt_cases$p[i], df = qt_cases$df[i], q = qt_cases$q[i]
     )))

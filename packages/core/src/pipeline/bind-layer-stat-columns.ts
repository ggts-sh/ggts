import type { StatName } from "@ggts-sh/spec";

/**
 * y-channel { stat } columns each stat exposes (module-header contracts).
 *
 * Total over StatName, so a new stat is a compile error here rather than a
 * silent empty row at the read site (#1042). An empty array means the stat
 * writes y as a frame coordinate and publishes no y-mappable column — a
 * decision, not an omission.
 */
export const STAT_Y_COLUMNS: Record<StatName, readonly string[]> = {
  identity: [],
  unique: [],
  manual: [],
  count: ["count"],
  bin: ["count", "density", "ncount", "ndensity"],
  density: ["density", "count", "scaled", "ndensity"],
  ydensity: ["density", "count", "scaled", "violinwidth"],
  // density_2d writes isoline x/y; level/density are after_stat, not y columns.
  density_2d: [],
  density_2d_filled: [],
  // stackpos only — count is not a valid y (would collapse the stack; #803)
  bindot: ["stackpos"],
  smooth: [],
  boxplot: [],
  summary: [],
  // y is a required *input* to stat_sum — do not publish n/prop on y.
  sum: [],
  function: ["y"],
  ecdf: ["ecdf"],
  // y/ymin/ymax are field-mapped measure outputs (not {stat} y columns).
  summary_bin: [],
  // y is the rolling summary (a measure output, not a {stat} y column).
  summary_rolling: [],
  // Contour writes x/y as frame coordinates; after_stat level is not a y column.
  contour: [],
  // The rest write y straight into the frame, so nothing is y-mappable.
  // connect expands tied-x step corners into vertices (#816).
  connect: [],
  // align only shifts x positions; it never computes a y.
  align: [],
  // ellipse writes the ellipse path vertices as x/y.
  ellipse: [],
  // 2-d bins put y on the cell centre; their counts go to colour/fill instead
  // (see STAT_COLOR_COLUMNS): bin_hex #800, bin_2d ggplot2 geom_bin2d.
  bin_hex: [],
  bin_2d: [],
  // Fitted quantile-regression grid: y is the fitted coordinate.
  quantile: [],
  // sf / sf_coordinates write geometry and representative-point coordinates.
  sf: [],
  sf_coordinates: [],
  // qq publishes theoretical/sample as frame x/y, not as mappable columns.
  qq: [],
  qq_line: [],
};

/**
 * color/fill `{ stat }` columns each stat exposes. Frame builders resolve these
 * via `colorColumns` in `frame-stats-shared.ts` (#953). Stats absent from this
 * map publish nothing for colour — bind emits `stat-channel-unsupported` (#915).
 */
export const STAT_COLOR_COLUMNS: Partial<Record<StatName, readonly string[]>> = {
  // bin / histogram: count + density family (ggplot2 after_stat on fill/color).
  bin: ["count", "density", "ncount", "ndensity"],
  bin_2d: ["count", "density", "ncount", "ndensity"],
  // bin_hex fill defaults to after_stat count (ggplot2 geom_hex; #800).
  bin_hex: ["count", "density", "ncount", "ndensity"],
  count: ["count"],
  density: ["density", "count", "scaled", "ndensity"],
  density_2d: ["level", "density"],
  density_2d_filled: ["level", "density"],
};

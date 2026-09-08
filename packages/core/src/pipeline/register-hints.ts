/**
 * Stat/geom name → family register function name, for "not registered in
 * this build" error hints (#1420). Pure strings by design: importing the
 * actual register functions here would pull the whole registration graph
 * into the lean `@ggts-sh/core/render` bundle and undo tree-shaking.
 *
 * Coverage mirrors the register-*.ts family modules one-for-one; the drift
 * guards in tests/register-hints.test.ts fail if a family module lands
 * without a matching hint entry. Basic-tier names point at their granular
 * headless registration family while the fallback still names
 * registerBasic()/registerAll().
 */

/** Specialty stat name → family register function (from @ggts-sh/core or @ggts-sh/svelte). */
export const STAT_REGISTER_HINTS: Readonly<Record<string, string>> = {
  count: "registerBasicPoints",
  sum: "registerBasicBars",
  align: "registerAlign",
  bin: "registerBin",
  bin_2d: "registerBin2d",
  bin_hex: "registerHex",
  bindot: "registerDotplot",
  boxplot: "registerBoxplot",
  connect: "registerConnect",
  contour: "registerContour",
  density: "registerDensity",
  density_2d: "registerDensity2d",
  density_2d_filled: "registerDensity2dFilled",
  ecdf: "registerEcdf",
  ellipse: "registerEllipse",
  function: "registerFunction",
  manual: "registerManual",
  qq: "registerQq",
  qq_line: "registerQqLine",
  quantile: "registerQuantile",
  sf: "registerSf",
  sf_coordinates: "registerSfText",
  smooth: "registerSmooth",
  summary: "registerSummary",
  summary_bin: "registerSummaryBin",
  summary_rolling: "registerSummaryRolling",
  unique: "registerUnique",
  ydensity: "registerViolin",
};

/** Specialty geom name → family register function (from @ggts-sh/core or @ggts-sh/svelte). */
export const GEOM_REGISTER_HINTS: Readonly<Record<string, string>> = {
  area: "registerBasicAreas",
  bar: "registerBasicBars",
  blank: "registerBasicRects",
  col: "registerBasicBars",
  count: "registerBasicPoints",
  density: "registerBasicAreas",
  label: "registerBasicGlyphs",
  line: "registerBasicLines",
  path: "registerBasicLines",
  point: "registerBasicPoints",
  rect: "registerBasicRects",
  ribbon: "registerBasicAreas",
  rule: "registerBasicSegments",
  segment: "registerBasicSegments",
  step: "registerBasicLines",
  text: "registerBasicGlyphs",
  abline: "registerAbline",
  bin_2d: "registerBin2d",
  boxplot: "registerBoxplot",
  contour: "registerContour",
  crossbar: "registerCrossbar",
  curve: "registerCurve",
  density_2d: "registerDensity2d",
  density_2d_filled: "registerDensity2dFilled",
  dotplot: "registerDotplot",
  errorbar: "registerErrorbar",
  function: "registerFunction",
  hex: "registerHex",
  linerange: "registerLinerange",
  map: "registerMap",
  pointrange: "registerPointrange",
  polygon: "registerPolygon",
  qq: "registerQq",
  qq_line: "registerQqLine",
  quantile: "registerQuantile",
  raster: "registerRaster",
  rug: "registerRug",
  sf: "registerSf",
  sf_label: "registerSfLabel",
  sf_text: "registerSfText",
  smooth: "registerSmooth",
  spoke: "registerSpoke",
  tile: "registerTile",
  violin: "registerViolin",
};

export function statRegisterHint(stat: string): string | undefined {
  return STAT_REGISTER_HINTS[stat];
}

export function geomRegisterHint(geom: string): string | undefined {
  return GEOM_REGISTER_HINTS[geom];
}

export function isBasicRegisterHint(family: string): boolean {
  return family.startsWith("registerBasic");
}

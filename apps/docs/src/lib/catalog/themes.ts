import type { ThemeName } from "@ggts-sh/spec";

import { CATEGORICAL_SCHEMES, VIRIDIS_RAMP_10 } from "./palette-tables.js";

/**
 * Docs-local mirror of package aliases (grey/gray → ggplot2). Kept as a plain
 * object so this module never value-imports `@ggts-sh/spec` / TypeBox — that
 * barrel lands in the chart mega-chunk and was modulepreloaded on /themes.
 */
const THEME_NAME_ALIASES = {
  grey: "ggplot2",
  gray: "ggplot2",
} as const satisfies Partial<Record<ThemeName, ThemeName>>;

/** Canonical picker themes — grey/gray alias ggplot2 and stay out of the list. */
type ThemeOptionName = Exclude<ThemeName, keyof typeof THEME_NAME_ALIASES>;

/** No scheme-name display aliases remain after the grey/gray scheme purge. */
const CATEGORICAL_SCHEME_DISPLAY_ALIASES = {} as const satisfies Partial<
  Record<keyof typeof CATEGORICAL_SCHEMES, keyof typeof CATEGORICAL_SCHEMES>
>;

type PaletteOptionName = Exclude<
  keyof typeof CATEGORICAL_SCHEMES,
  keyof typeof CATEGORICAL_SCHEME_DISPLAY_ALIASES
>;

const THEME_LABELS = {
  default: "Default",
  light: "Light",
  dark: "Dark",
  minimal: "Minimal",
  ggplot2: "ggplot2",
  classic: "Classic",
  bw: "B&W",
  hrbr: "HRBR",
  few: "Few",
  clean: "Clean",
  fivethirtyeight: "FiveThirtyEight",
  economist: "Economist",
  tufte: "Tufte",
  linedraw: "Linedraw",
  void: "Void",
  stata: "Stata",
  stata_s1color: "Stata S1 Color",
  solarized: "Solarized",
  solarizeddark: "Solarized Dark",
  economist_white: "Economist White",
  solarized_2: "Solarized 2",
  solarized_2dark: "Solarized 2 Dark",
  wsj: "WSJ",
  hc: "Highcharts",
  hcdark: "Highcharts Dark",
  pander: "Pander",
  base: "Base",
  igray: "Inverse Gray",
  map: "Map",
  solid: "Solid",
  test: "Test",
} as const satisfies Record<ThemeOptionName, string>;

const PALETTE_LABELS = {
  observable10: "Observable 10",
  ipsum: "Ipsum",
  flexoki: "Flexoki",
  colorblind: "Colorblind",
  stata: "Stata",
  economist: "Economist",
  solarized: "Solarized",
  few: "Few",
  few_light: "Few Light",
  few_dark: "Few Dark",
  fivethirtyeight: "FiveThirtyEight",
  ptol: "Paul Tol",
  canva: "Canva",
  wsj: "WSJ",
  wsj_rgby: "WSJ R/G/B/Y",
  wsj_red_green: "WSJ Red/Green",
  wsj_black_green: "WSJ Black/Green",
  wsj_dem_rep: "WSJ Dem/Rep",
  tableau20: "Tableau 20",
  tableau_colorblind: "Tableau Color Blind",
  tableau_seattle_grays: "Seattle Grays",
  tableau_jewel_bright: "Jewel Bright",
  tableau_hue_circle: "Hue Circle",
  pander: "Pander",
  hue: "Hue",
  // ColorBrewer qualitative (#825) — keep the upstream palette names.
  Dark2: "Dark2",
  // Crameri categorical *S (v8.0.1) — keep the official names.
  actonS: "actonS",
  bamakoS: "bamakoS",
  batlowS: "batlowS",
  batlowWS: "batlowWS",
  batlowKS: "batlowKS",
  bilbaoS: "bilbaoS",
  budaS: "budaS",
  davosS: "davosS",
  devonS: "devonS",
  glasgowS: "glasgowS",
  grayCS: "grayCS",
  hawaiiS: "hawaiiS",
  imolaS: "imolaS",
  lajollaS: "lajollaS",
  lapazS: "lapazS",
  lipariS: "lipariS",
  naviaS: "naviaS",
  nuukS: "nuukS",
  osloS: "osloS",
  tokyoS: "tokyoS",
  turkuS: "turkuS",
} as const satisfies Record<PaletteOptionName, string>;

/** Categorical scheme paired with each theme demo so paper + marks read as a set. */
const THEME_DEMO_SCHEMES = {
  default: "observable10",
  light: "observable10",
  dark: "flexoki",
  minimal: "colorblind",
  ggplot2: "observable10",
  classic: "colorblind",
  bw: "colorblind",
  hrbr: "ipsum",
  few: "few",
  clean: "flexoki",
  fivethirtyeight: "fivethirtyeight",
  economist: "economist",
  tufte: "colorblind",
  linedraw: "colorblind",
  void: "colorblind",
  stata: "stata",
  // Chart themes whose matching scheme names were removed still need a
  // specimen palette; pair them with a close remaining scheme.
  stata_s1color: "stata",
  solarized: "solarized",
  solarizeddark: "solarized",
  economist_white: "economist",
  solarized_2: "solarized",
  solarized_2dark: "solarized",
  wsj: "wsj",
  hc: "observable10",
  hcdark: "flexoki",
  pander: "pander",
  base: "observable10",
  igray: "observable10",
  map: "colorblind",
  solid: "colorblind",
  test: "colorblind",
} as const satisfies Record<ThemeOptionName, keyof typeof CATEGORICAL_SCHEMES>;

/**
 * Picker/specimen themes only. Built from THEME_LABELS (not THEME_NAMES from
 * `@ggts-sh/spec`) so the client never loads the TypeBox schema graph.
 */
export const THEME_OPTIONS = (Object.keys(THEME_LABELS) as ThemeOptionName[]).map((name) => ({
  name,
  label: THEME_LABELS[name],
  scheme: THEME_DEMO_SCHEMES[name],
}));

/** Picker/specimen palettes only — API still accepts gray via the same GREY_PALETTE_10. */
export const CATEGORICAL_PALETTES = (
  Object.keys(CATEGORICAL_SCHEMES) as (keyof typeof CATEGORICAL_SCHEMES)[]
)
  .filter((name): name is PaletteOptionName => !(name in CATEGORICAL_SCHEME_DISPLAY_ALIASES))
  .map((name) => {
    const colors = CATEGORICAL_SCHEMES[name];
    return {
      name,
      label: PALETTE_LABELS[name],
      capacity: colors.length,
      colors,
    };
  });

/** Viridis reference colors — consumed by scripts/themes-page.test.ts. */
export const VIRIDIS_COLORS = VIRIDIS_RAMP_10;

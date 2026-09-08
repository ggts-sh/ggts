import type { ThemeName } from "@ggts-sh/spec";
import { CATEGORICAL_SCHEME_NAMES } from "@ggts-sh/spec";

// Relative import so bun unit tests (scripts/themes-page.test.ts) resolve without
// the SvelteKit `$lib` alias.
import { THEME_OPTIONS } from "../catalog/themes.js";

export type SchemeName = (typeof CATEGORICAL_SCHEME_NAMES)[number];

/**
 * Specimen chart kinds. Each maps to a real example corpus + geom stack that
 * showcases the theme's furniture personality (panel, grid, axes, type).
 */
export type ThemeSpecimenKind =
  | "temps-line"
  | "ridership-line"
  | "attendees-dodge"
  | "generation-area"
  | "long-run-line"
  | "penguins-scatter"
  | "countries-scatter"
  | "revenue-cols"
  | "cities-labels"
  /** Snow 1854 Soho pump-neighbourhood choropleth (geom_map + coord_fixed). */
  | "soho-choropleth";

export type ThemeSpecimenConfig = {
  readonly name: ThemeName;
  readonly label: string;
  readonly caption: string;
  readonly kind: ThemeSpecimenKind;
  readonly scheme: SchemeName;
  /** Discrete color/fill legend present — enable legendFocus. */
  readonly legendFocus: boolean;
};

const BY_NAME = Object.fromEntries(THEME_OPTIONS.map((theme) => [theme.name, theme])) as Record<
  (typeof THEME_OPTIONS)[number]["name"],
  (typeof THEME_OPTIONS)[number]
>;

/** Full-width theme portrait rows, catalog order (default → tufte). */
export const THEME_SPECIMENS: readonly ThemeSpecimenConfig[] = [
  {
    name: "default",
    label: BY_NAME.default.label,
    caption: "Hairline grids, no heavy frame — multi-series default hierarchy.",
    kind: "temps-line",
    scheme: BY_NAME.default.scheme,
    legendFocus: true,
  },
  {
    name: "light",
    label: BY_NAME.light.label,
    caption: "Fine ticks and a light panel border around categorical groups.",
    kind: "attendees-dodge",
    scheme: BY_NAME.light.scheme,
    legendFocus: true,
  },
  {
    name: "dark",
    label: BY_NAME.dark.label,
    caption: "Low-glare dark paper; large fills carry the series.",
    kind: "generation-area",
    scheme: BY_NAME.dark.scheme,
    legendFocus: true,
  },
  {
    name: "minimal",
    label: BY_NAME.minimal.label,
    caption: "Quiet grid and reduced type hierarchy on a single series.",
    kind: "long-run-line",
    scheme: BY_NAME.minimal.scheme,
    legendFocus: false,
  },
  {
    name: "ggplot2",
    label: BY_NAME.ggplot2.label,
    caption: "Gray panel and white grid — the classic R silhouette (also theme grey/gray).",
    kind: "penguins-scatter",
    scheme: BY_NAME.ggplot2.scheme,
    legendFocus: true,
  },
  {
    name: "classic",
    label: BY_NAME.classic.label,
    caption: "Black axes and ticks, no grid — framed research scatter.",
    kind: "countries-scatter",
    scheme: BY_NAME.classic.scheme,
    legendFocus: true,
  },
  {
    name: "bw",
    label: BY_NAME.bw.label,
    caption: "White panel, grey grid, dark border — print-friendly scatter.",
    kind: "countries-scatter",
    scheme: BY_NAME.bw.scheme,
    legendFocus: true,
  },
  {
    name: "hrbr",
    label: BY_NAME.hrbr.label,
    caption: "Same quiet hierarchy as default; ipsum series colors.",
    kind: "ridership-line",
    scheme: BY_NAME.hrbr.scheme,
    legendFocus: true,
  },
  {
    name: "few",
    label: BY_NAME.few.label,
    caption: "Panel border and ticks, no grid — business comparisons.",
    kind: "attendees-dodge",
    scheme: BY_NAME.few.scheme,
    legendFocus: true,
  },
  {
    name: "clean",
    label: BY_NAME.clean.label,
    caption: "Dashed grids, axis lines, and value labels.",
    kind: "revenue-cols",
    scheme: BY_NAME.clean.scheme,
    legendFocus: false,
  },
  {
    name: "fivethirtyeight",
    label: BY_NAME.fivethirtyeight.label,
    caption: "Gray paper and white grid — editorial stacked mix.",
    kind: "generation-area",
    scheme: BY_NAME.fivethirtyeight.scheme,
    legendFocus: true,
  },
  {
    name: "economist",
    label: BY_NAME.economist.label,
    caption: "Cool blue paper and magazine multi-series strokes.",
    kind: "ridership-line",
    scheme: BY_NAME.economist.scheme,
    legendFocus: true,
  },
  {
    name: "tufte",
    label: BY_NAME.tufte.label,
    caption: "No grid; labels carry the structure.",
    kind: "cities-labels",
    scheme: BY_NAME.tufte.scheme,
    legendFocus: false,
  },
  {
    name: "linedraw",
    label: BY_NAME.linedraw.label,
    caption: "Black grid and border on white paper — line-art monochrome chrome.",
    kind: "countries-scatter",
    scheme: BY_NAME.linedraw.scheme,
    legendFocus: true,
  },
  {
    name: "void",
    label: BY_NAME.void.label,
    caption: "No axes, grid, or panel — marks only (maps, logos, free-form).",
    kind: "cities-labels",
    scheme: BY_NAME.void.scheme,
    legendFocus: false,
  },
  {
    name: "stata",
    label: BY_NAME.stata.label,
    caption: "Stata s2color: bluish-gray plot region, white panel, y-grid.",
    kind: "countries-scatter",
    scheme: BY_NAME.stata.scheme,
    legendFocus: true,
  },
  {
    name: "stata_s1color",
    label: BY_NAME.stata_s1color.label,
    caption: "Stata s1color: white panel with black border, light y-grid.",
    kind: "attendees-dodge",
    scheme: BY_NAME.stata_s1color.scheme,
    legendFocus: true,
  },
  {
    name: "solarized",
    label: BY_NAME.solarized.label,
    caption: "Cream panel and precision accents — Schoonover's light lab.",
    kind: "generation-area",
    scheme: BY_NAME.solarized.scheme,
    legendFocus: true,
  },
  {
    name: "solarizeddark",
    label: BY_NAME.solarizeddark.label,
    caption: "Deep teal panel, same accents — Solarized after dark.",
    kind: "ridership-line",
    scheme: BY_NAME.solarizeddark.scheme,
    legendFocus: true,
  },
  {
    name: "economist_white",
    label: BY_NAME.economist_white.label,
    caption: "White panel and gray grid on light-gray paper — the Graphic Detail variant.",
    kind: "revenue-cols",
    scheme: BY_NAME.economist_white.scheme,
    legendFocus: false,
  },
  {
    name: "solarized_2",
    label: BY_NAME.solarized_2.label,
    caption: "Grey-style Solarized panel with light grid — base tones swapped, no frame.",
    kind: "penguins-scatter",
    scheme: BY_NAME.solarized_2.scheme,
    legendFocus: true,
  },
  {
    name: "solarized_2dark",
    label: BY_NAME.solarized_2dark.label,
    caption: "The grey-style Solarized variant on dark base tones.",
    kind: "generation-area",
    scheme: BY_NAME.solarized_2dark.scheme,
    legendFocus: true,
  },
  {
    name: "wsj",
    label: BY_NAME.wsj.label,
    caption: "Brown paper, dotted black y-grid — Wall Street Journal chrome.",
    kind: "revenue-cols",
    scheme: BY_NAME.wsj.scheme,
    legendFocus: false,
  },
  {
    name: "hc",
    label: BY_NAME.hc.label,
    caption: "Highcharts default: y-only #D8D8D8 grid on white, no border.",
    kind: "ridership-line",
    scheme: BY_NAME.hc.scheme,
    legendFocus: true,
  },
  {
    name: "hcdark",
    label: BY_NAME.hcdark.label,
    caption: "Highcharts darkunica: #2a2a2b paper, #707073 y-grid.",
    kind: "generation-area",
    scheme: BY_NAME.hcdark.scheme,
    legendFocus: true,
  },
  {
    name: "pander",
    label: BY_NAME.pander.label,
    caption: "Pander: dashed grey grid, grey ticks, bold title on white.",
    kind: "penguins-scatter",
    scheme: BY_NAME.pander.scheme,
    legendFocus: true,
  },
  {
    name: "base",
    label: BY_NAME.base.label,
    caption: "Base R: black frame and ticks, no grid, bold 19px title.",
    kind: "revenue-cols",
    scheme: BY_NAME.base.scheme,
    legendFocus: false,
  },
  {
    name: "igray",
    label: BY_NAME.igray.label,
    caption: "Inverse gray: white panel, gray90 surround and grid.",
    kind: "penguins-scatter",
    scheme: BY_NAME.igray.scheme,
    legendFocus: true,
  },
  {
    name: "map",
    label: BY_NAME.map.label,
    caption: "No axes, grid, or chrome — marks only, for maps.",
    kind: "soho-choropleth",
    scheme: BY_NAME.map.scheme,
    legendFocus: false,
  },
  {
    name: "solid",
    label: BY_NAME.solid.label,
    caption: "Nothing but marks — every non-geom element removed.",
    kind: "cities-labels",
    scheme: BY_NAME.solid.scheme,
    legendFocus: false,
  },
  {
    name: "test",
    label: BY_NAME.test.label,
    caption: "Pinned high-contrast chrome for package tests and VR.",
    kind: "long-run-line",
    scheme: BY_NAME.test.scheme,
    legendFocus: false,
  },
];

/** Year breaks shared by the Playfair 1824 multi-series chart. */
export const MONTH_BREAKS = [1770, 1780, 1790, 1800, 1810, 1820] as const;

/**
 * Continuous z on the Macdonell man-count raster (thumbnail 8×6 window).
 * Pinned domain uses a mid interval so extremes clip visibly.
 */
export const RASTER_Z_DOMAIN = [15, 40] as const;

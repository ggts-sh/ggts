/**
 * Named registries shared by the TypeBox schema graph and runtime catalogs.
 * Kept separate from the `$defs` object so scale/theme name lists can change
 * without editing the full declarations bag.
 */

/**
 * Hard cap on a binned position scale's bins (automatic or explicit). This is
 * the single shared source of truth: the TypeBox `breaks` `maxItems` below,
 * the core runtime boundary resolver, and the `binned-scale-break-limit`
 * pipeline error all key off it. `n` boundaries produce `n − 1` bins, so the
 * schema allows at most `MAX_BINNED_BREAKS + 1` break values.
 */
export const MAX_BINNED_BREAKS = 64;

/** Maximum gradient color stops in a portable paint (closed, bounded). */
export const MAX_PAINT_STOPS = 16;

/** Maximum glow blur radius in CSS px (bounded filter work). */
export const MAX_GLOW_RADIUS = 32;

/** Named categorical color schemes known to this schema version. */
export const CATEGORICAL_SCHEME_NAMES = [
  "observable10",
  "ipsum",
  "flexoki",
  "colorblind",
  // ggthemes ports (#1159): Stata s2color default
  "stata",
  /** ggthemes scale_colour/fill_economist — Economist blues/greens (fill order). */
  "economist",
  /** ggthemes scale_colour/fill_solarized — Solarized accents, blue first. */
  "solarized",
  // ggthemes ports (#1159): Few "Show Me the Numbers" variants + FiveThirtyEight
  "few",
  "few_light",
  "few_dark",
  "fivethirtyeight",
  // ggthemes ports (#1159): Paul Tol + Canva default
  "ptol",
  "canva",
  /** ggthemes wsj_pal — scale_colour/fill_wsj palette variants. */
  "wsj",
  "wsj_rgby",
  "wsj_red_green",
  "wsj_black_green",
  "wsj_dem_rep",
  // ggthemes tableau_color_pal regular variants (#1159)
  "tableau20",
  "tableau_colorblind",
  "tableau_seattle_grays",
  "tableau_jewel_bright",
  "tableau_hue_circle",
  // ggthemes ports (#1159): pander
  "pander",
  // ColorBrewer qualitative (#825)
  "Dark2",
  /** Even HSL hues — ggplot2-shaped scale_*_hue default discrete path (#829). */
  "hue",
  // Crameri Scientific colour maps v8.0.1 categorical (*S) 10-class prefixes
  "actonS",
  "bamakoS",
  "batlowS",
  "batlowWS",
  "batlowKS",
  "bilbaoS",
  "budaS",
  "davosS",
  "devonS",
  "glasgowS",
  "grayCS",
  "hawaiiS",
  "imolaS",
  "lajollaS",
  "lapazS",
  "lipariS",
  "naviaS",
  "nuukS",
  "osloS",
  "tokyoS",
  "turkuS",
] as const;

/**
 * Crameri cyclic (*O) sequential schemes. Periodic data only: wrap OOB and
 * an explicit [min, max] period. Not legal on ordinal or binned scales.
 */
export const CYCLIC_SCHEME_NAMES = ["bamO", "brocO", "corkO", "romaO", "vikO"] as const;

/**
 * Named sequential color schemes known to this schema version.
 * Viridis family maps (matplotlib/CC0 samples + Google turbo), ColorBrewer
 * sequential/diverging ramps (#825), and Crameri Scientific colour maps
 * v8.0.1 continuous suite plus cyclic (*O) ramps; used by continuous color
 * scales. Discrete even-sampling (viridis_d parity) covers viridis-family
 * and non-cyclic Crameri ramps only.
 */
export const SEQUENTIAL_SCHEME_NAMES = [
  "viridis",
  "plasma",
  "inferno",
  "cividis",
  "turbo",
  // ColorBrewer sequential + diverging ramps (#825)
  "Blues",
  "Greens",
  "Reds",
  "Oranges",
  "Purples",
  "Greys",
  "YlOrRd",
  "YlGnBu",
  "BuPu",
  "RdYlBu",
  "RdBu",
  "BrBG",
  "Spectral",
  "PuOr",
  // Crameri Scientific colour maps v8.0.1 continuous suite (seq / div / multi-seq)
  "acton",
  "bamako",
  "batlow",
  "batlowW",
  "batlowK",
  "bilbao",
  "buda",
  "davos",
  "devon",
  "glasgow",
  "grayC",
  "hawaii",
  "imola",
  "lajolla",
  "lapaz",
  "lipari",
  "navia",
  "naviaW",
  "nuuk",
  "oslo",
  "tokyo",
  "turku",
  "bam",
  "berlin",
  "broc",
  "cork",
  "lisbon",
  "managua",
  "roma",
  "tofino",
  "vanimo",
  "vik",
  "bukavu",
  "fes",
  "oleron",
  // Crameri cyclic (*O) — sequential family, wrap OOB, explicit period
  ...CYCLIC_SCHEME_NAMES,
] as const;

export const COLOR_SCHEME_NAMES = [
  ...CATEGORICAL_SCHEME_NAMES,
  ...SEQUENTIAL_SCHEME_NAMES,
] as const;

/** Audited finite point symbols, ordered by default assignment priority. */
export const POINT_SHAPE_NAMES = [
  "circle",
  "triangle",
  "square",
  "diamond",
  "plus",
  "cross",
  "circle-open",
] as const;
export type PointShapeName = (typeof POINT_SHAPE_NAMES)[number];

/** Audited finite stroke patterns, ordered by default assignment priority. */
export const LINETYPE_NAMES = [
  "solid",
  "dashed",
  "dotted",
  "dotdash",
  "longdash",
  "twodash",
] as const;
export type LinetypeName = (typeof LINETYPE_NAMES)[number];

/** Built-in theme names known to this schema version. */
export const THEME_NAMES = [
  "default",
  "light",
  "dark",
  "minimal",
  "ggplot2",
  "classic",
  "bw",
  "hrbr",
  "few",
  "clean",
  "fivethirtyeight",
  "economist",
  "tufte",
  "linedraw",
  "void",
  // ggthemes theme ports (#1158): Stata family
  "stata",
  "stata_s1color",
  // ggthemes theme_solarized: light (default) and dark (light = FALSE) variants.
  "solarized",
  "solarizeddark",
  // ggthemes theme ports (#1158)
  "economist_white",
  "solarized_2",
  "solarized_2dark",
  /** ggthemes theme_wsj (Wall Street Journal). */
  "wsj",
  "hc",
  "hcdark",
  "pander",
  // ggthemes minimalist family (#1158): theme_base / igray / map / solid
  "base",
  "igray",
  "map",
  "solid",
  "grey",
  "gray",
  // Snapshot/unit-test complete theme (#823). Last: ordered docs/VR rosters
  // append after product themes (and after name aliases).
  "test",
] as const;

type ThemeNameValue = (typeof THEME_NAMES)[number];

/**
 * Registered theme names that share another theme's token map / evidence.
 * Keys are first-class ThemeName values (PortableSpec accepts them); values
 * are the canonical theme that owns the built-in tokens and visual evidence.
 * UK `grey` and US `gray` both alias the grey-panel `ggplot2` look (#824).
 */
export const THEME_NAME_ALIASES = {
  grey: "ggplot2",
  gray: "ggplot2",
} as const satisfies Partial<Record<ThemeNameValue, ThemeNameValue>>;

/**
 * ggthemes-derived built-in themes: the Stata schemes, Solarized family, and
 * Economist white variant. Assembled in order by theme-builtins.ts.
 */
import type { ThemeName } from "@ggts-sh/spec";
import { themed, type ThemeTokens } from "./theme-construct.js";

export const SOLARIZED_BUILTIN_THEMES = Object.freeze({
  // ggthemes theme_stata(scheme = "s2color"): the default Stata look —
  // ltbluishgray (#eaf2f3) plot region around a white panel, matching
  // ltbluishgray y-major grid (major.x and minor blank), black axis lines
  // and ticks, no panel border. Sizes from stata_gsize ratios (base 11,
  // axis 10, title 14, axis title 10). R's dknavy title colour folds into
  // the single ink role (documented), and the bottom legend position is not
  // expressible. Accent is the s2color palette's navy.
  stata: themed({
    ink: "#000000",
    paper: "#eaf2f3",
    panel: "#ffffff",
    accent: "#1a476f",
    grid: "#eaf2f3",
    axisText: "#000000",
    axisLine: "#000000",
    tickColor: "#000000",
    fontSize: 11,
    axisTextSize: 10,
    fontWeight: 400,
    titleSize: 14,
    subtitleSize: 11,
    axisTitleSize: 10,
    captionSize: 8,
    stripSize: 12,
    axisLineWidth: 0.5,
    tickWidth: 0.5,
    tickLength: 4,
    gridWidth: 0.5,
    axisLineX: true,
    axisLineY: true,
    ticksX: true,
    ticksY: true,
    gridX: false,
  }),
  // ggthemes theme_stata(scheme = "s1color"): the older Stata s1 look —
  // white plot and panel, gs14 (#e0e0e0) y-grid, and Stata's black panel
  // border. Accent is the s1color palette's dkgreen.
  stata_s1color: themed({
    ink: "#000000",
    paper: "#ffffff",
    panel: "#ffffff",
    accent: "#006000",
    grid: "#e0e0e0",
    axisText: "#000000",
    axisLine: "#000000",
    tickColor: "#000000",
    panelBorder: "#000000",
    fontSize: 11,
    axisTextSize: 10,
    fontWeight: 400,
    titleSize: 14,
    subtitleSize: 11,
    axisTitleSize: 10,
    captionSize: 8,
    stripSize: 12,
    axisLineWidth: 0.5,
    tickWidth: 0.5,
    tickLength: 4,
    gridWidth: 0.5,
    panelBorderWidth: 0.5,
    axisLineX: true,
    axisLineY: true,
    ticksX: true,
    ticksY: true,
    gridX: false,
    showPanelBorder: true,
  }),
  // ggthemes theme_solarized (light = TRUE): theme_bw lineage on Schoonover's
  // light rebase — base3 panel (#fdf6e3), base2 grid, base1 chrome/text,
  // transparent plot background, blue accent. ggthemes draws the frame via
  // panel.background colour (panel.border is blank); here showPanelBorder
  // carries it. Single-ink model: R's darker title step (rebase0) flattens
  // into ink (rebase01), as with the other ports.
  solarized: themed({
    ink: "#93a1a1",
    paper: "none",
    panel: "#fdf6e3",
    accent: "#268bd2",
    grid: "#eee8d5",
    axisText: "#93a1a1",
    axisLine: "#93a1a1",
    tickColor: "#93a1a1",
    panelBorder: "#93a1a1",
    fontSize: 12,
    axisTextSize: 12,
    fontWeight: 400,
    titleSize: 14.4,
    subtitleSize: 12,
    axisTitleSize: 12,
    axisLineWidth: 0.5,
    tickWidth: 0.5,
    tickLength: 3.67,
    gridWidth: 0.5,
    panelBorderWidth: 0.5,
    // theme_bw lineage: frame is the panel border only (axisLineX/Y stay false).
    axisLineX: false,
    axisLineY: false,
    ticksX: true,
    ticksY: true,
    showPanelBorder: true,
    // Tip package: base2 card; tip ink intentionally stronger than axis ink
    // (base01 vs base1) for short-lived reading chrome.
    tooltipPaper: "#eee8d5",
    tooltipInk: "#586e75",
    tooltipBorder: "#93a1a1",
  }),
  // ggthemes theme_solarized (light = FALSE): same geometry on the dark
  // rebase — base03 panel (#002b36), base02 grid, base01 chrome. Accents are
  // shared across light/dark by Solarized's design (only base tones flip).
  solarizeddark: themed({
    ink: "#586e75",
    paper: "none",
    panel: "#002b36",
    accent: "#268bd2",
    grid: "#073642",
    axisText: "#586e75",
    axisLine: "#586e75",
    tickColor: "#586e75",
    panelBorder: "#586e75",
    fontSize: 12,
    axisTextSize: 12,
    fontWeight: 400,
    titleSize: 14.4,
    subtitleSize: 12,
    axisTitleSize: 12,
    axisLineWidth: 0.5,
    tickWidth: 0.5,
    tickLength: 3.67,
    gridWidth: 0.5,
    panelBorderWidth: 0.5,
    // theme_bw lineage: frame is the panel border only (axisLineX/Y stay false).
    axisLineX: false,
    axisLineY: false,
    ticksX: true,
    ticksY: true,
    showPanelBorder: true,
    // Tip package: base02 card; tip ink brightens from axis base01 to base1.
    tooltipPaper: "#073642",
    tooltipInk: "#93a1a1",
    tooltipBorder: "#586e75",
  }),
  // ggthemes theme_economist_white (gray_bg = TRUE): the Graphic Detail blog
  // variant of theme_economist — white panel on a light-gray (#ebebeb) plot
  // background with a dark-gray (#c9c9c9) major grid. R builds it as
  // theme_economist() + surface overrides, so this port keeps the economist
  // chrome (ink, ticks, sizes) and swaps exactly the three surfaces.
  economist_white: themed({
    ink: "#014d64",
    paper: "#ebebeb",
    panel: "#ffffff",
    accent: "#ed111a",
    grid: "#c9c9c9",
    axisText: "#014d64",
    tickColor: "#6794a7",
    tickWidth: 0.5,
    tickLength: 4,
    gridWidth: 0.5,
    ticksX: true,
  }),
  // ggthemes theme_solarized_2 (light = TRUE): the theme_grey-flavored
  // Solarized variant — base2 panel (#eee8d5) with base3 grid (#fdf6e3),
  // base1 chrome/text, transparent plot background. In ggthemes the axis
  // line colour reads a misspelled rebase key ("reabase01") and resolves to
  // NA, so no axis line is drawn; panel.border is blank, so no frame either.
  // Single-ink model: R's darker title step (rebase0) flattens into ink
  // (rebase01), as with the other ports.
  solarized_2: themed({
    ink: "#93a1a1",
    paper: "none",
    panel: "#eee8d5",
    accent: "#268bd2",
    grid: "#fdf6e3",
    axisText: "#93a1a1",
    tickColor: "#93a1a1",
    fontSize: 12,
    axisTextSize: 12,
    fontWeight: 400,
    titleSize: 14.4,
    subtitleSize: 12,
    axisTitleSize: 12,
    tickWidth: 0.5,
    tickLength: 3.67,
    gridWidth: 0.5,
    ticksX: true,
    ticksY: true,
    // Tip package: base3 card (lighter than base2 panel); tip ink base01.
    tooltipPaper: "#fdf6e3",
    tooltipInk: "#586e75",
    tooltipBorder: "#93a1a1",
  }),
  // ggthemes theme_solarized_2 (light = FALSE): same geometry on the dark
  // rebase — base02 panel (#073642), base03 grid (#002b36), base01 chrome.
  // Accents are shared across light/dark by Solarized's design.
  solarized_2dark: themed({
    ink: "#586e75",
    paper: "none",
    panel: "#073642",
    accent: "#268bd2",
    grid: "#002b36",
    axisText: "#586e75",
    tickColor: "#586e75",
    fontSize: 12,
    axisTextSize: 12,
    fontWeight: 400,
    titleSize: 14.4,
    subtitleSize: 12,
    axisTitleSize: 12,
    tickWidth: 0.5,
    tickLength: 3.67,
    gridWidth: 0.5,
    ticksX: true,
    ticksY: true,
    // Tip package: base03 card (darker than base02 panel); tip ink base1.
    tooltipPaper: "#002b36",
    tooltipInk: "#93a1a1",
    tooltipBorder: "#586e75",
  }),
} satisfies Partial<Record<ThemeName, ThemeTokens>>);

/**
 * Publication/journal-style built-in themes (ggthemes ports plus the pinned
 * test chrome): wsj, hc/hcdark, pander, base, igray, map, solid, test.
 * Assembled in order by theme-builtins.ts.
 */
import type { ThemeName } from "@ggts-sh/spec";
import { themed, type ThemeTokens } from "./theme-construct.js";

export const PUBLICATION_BUILTIN_THEMES = Object.freeze({
  // ggthemes theme_wsj: Wall Street Journal chrome — "brown" paper (#f8f2e4),
  // dotted black y-grid only, x axis line and ticks, no y line/ticks, big bold
  // title (rel(2) of base 12). R's title_family = "mono" has no single-family
  // token here, so the system sans stack carries both; axis.text bold and the
  // blank axis.title also flatten into the shared roles. Accent is colors6 red
  // so unmapped marks pair with the wsj palette.
  wsj: themed({
    ink: "#000000",
    paper: "#f8f2e4",
    panel: "#f8f2e4",
    accent: "#c72e29",
    grid: "#000000",
    axisText: "#000000",
    axisLine: "#000000",
    tickColor: "#000000",
    fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    fontSize: 12,
    axisTextSize: 12,
    fontWeight: 400,
    titleSize: 24,
    titleWeight: 700,
    subtitleSize: 12,
    subtitleWeight: 400,
    axisTitleSize: 12,
    axisTitleWeight: 400,
    axisLineWidth: 0.5,
    tickWidth: 0.5,
    tickLength: 3.67,
    gridWidth: 0.5,
    gridDasharray: "1.5 3",
    axisLineX: true,
    ticksX: true,
    gridX: false,
  }),
  // ggthemes theme_hc(style = "default"): Highcharts defaults — #D8D8D8
  // y-only major grid, no panel border (panel background blank over white
  // rect), theme_grey-lineage ticks and axis text. Accent is the first
  // Highcharts default color.
  hc: themed({
    ink: "#000000",
    paper: "#ffffff",
    panel: "#ffffff",
    accent: "#7cb5ec",
    grid: "#D8D8D8",
    axisText: "#4d4d4d",
    tickColor: "#333333",
    fontSize: 12,
    axisTextSize: 9.6,
    fontWeight: 400,
    titleSize: 14.4,
    subtitleSize: 12,
    axisTitleSize: 12,
    tickWidth: 0.5,
    tickLength: 3.67,
    gridWidth: 0.5,
    ticksX: true,
    ticksY: true,
    gridX: false,
  }),
  // ggthemes theme_hc(style = "darkunica"): Highcharts dark theme — #2a2a2b
  // paper, #707073 y-grid, #A0A0A3 text. R leaves axis.text at theme_grey's
  // dark grey (dark-on-dark); this port uses the style's text colour for
  // axis text and ticks (documented deviation). R's white title step
  // flattens into the single ink role, as with the other ports.
  hcdark: themed({
    ink: "#A0A0A3",
    paper: "#2a2a2b",
    panel: "#2a2a2b",
    accent: "#2b908f",
    grid: "#707073",
    axisText: "#A0A0A3",
    tickColor: "#A0A0A3",
    fontSize: 12,
    axisTextSize: 9.6,
    fontWeight: 400,
    titleSize: 14.4,
    subtitleSize: 12,
    axisTitleSize: 12,
    tickWidth: 0.5,
    tickLength: 3.67,
    gridWidth: 0.5,
    ticksX: true,
    ticksY: true,
    gridX: false,
    // Elevated neutral card; brighter tip ink; border stays grid-derived.
    tooltipPaper: "#353538",
    tooltipInk: "#E0E0E3",
  }),
  // ggthemes theme_pander() with its defaults (fc black, gc grey, gl dashed,
  // boxes FALSE): white panel (pc "transparent" over white), dashed #bebebe
  // grid both directions (R "grey" is #BEBEBE), grey ticks, bold 14.4 title,
  // no visible panel border. Accent is the first pander palette color.
  pander: themed({
    ink: "#000000",
    paper: "#ffffff",
    panel: "#ffffff",
    accent: "#56B4E9",
    grid: "#bebebe",
    axisText: "#000000",
    tickColor: "#bebebe",
    fontSize: 12,
    axisTextSize: 9.6,
    fontWeight: 400,
    titleSize: 14.4,
    titleWeight: 700,
    subtitleSize: 12,
    axisTitleSize: 12,
    tickWidth: 0.25,
    tickLength: 3.67,
    gridWidth: 0.25,
    gridDasharray: "3 3",
    ticksX: true,
    ticksY: true,
  }),
  // ggthemes theme_base: base-R graphics defaults — white panel with a black
  // frame (panel.border; axis.line is blank in the theme_grey lineage), black
  // ticks, no grid, black text, bold rel(1.2) title on base 16. Accent is
  // black, matching base R's monochrome line/fill defaults.
  base: themed({
    ink: "#000000",
    paper: "#ffffff",
    panel: "#ffffff",
    accent: "#000000",
    grid: "none",
    axisText: "#000000",
    tickColor: "#000000",
    panelBorder: "#000000",
    fontSize: 16,
    axisTextSize: 12.8,
    fontWeight: 400,
    titleSize: 19.2,
    titleWeight: 700,
    subtitleSize: 16,
    axisTitleSize: 16,
    tickWidth: 0.5,
    tickLength: 8,
    gridWidth: 0,
    panelBorderWidth: 0.5,
    ticksX: true,
    ticksY: true,
    gridX: false,
    gridY: false,
    showPanelBorder: true,
  }),
  // ggthemes theme_igray: the theme_gray inverse — white panel over a gray90
  // (#e5e5e5) surround with a matching gray90 major grid, so the plot sits
  // closer to the document's typographic color (Stata/Tableau style). Chrome
  // follows this port's theme_grey lineage (#333/#4d4d4d).
  igray: themed({
    ink: "#333333",
    paper: "#e5e5e5",
    panel: "#ffffff",
    grid: "#e5e5e5",
    axisText: "#4d4d4d",
    tickColor: "#333333",
    fontSize: 12,
    axisTextSize: 9.6,
    fontWeight: 400,
    titleSize: 14.4,
    subtitleSize: 12,
    axisTitleSize: 12,
    tickWidth: 0.5,
    tickLength: 3.67,
    gridWidth: 0.5,
    ticksX: true,
    ticksY: true,
  }),
  // ggthemes theme_map: every axis/panel/grid element blank — marks only, for
  // maps. Converges with `void` in this token model (both keep the title);
  // base 9 typography documented from theme_bw(base_size = 9).
  map: themed({
    paper: "none",
    panel: "none",
    grid: "none",
    fontSize: 9,
    axisTextSize: 9,
    axisTitleSize: 9,
    gridWidth: 0,
    gridX: false,
    gridY: false,
    axisLineX: false,
    axisLineY: false,
    ticksX: false,
    ticksY: false,
    labelsX: false,
    labelsY: false,
    showPanelBorder: false,
    tickLength: 0,
  }),
  // ggthemes theme_solid(fill = NA): removes every non-geom element — no
  // lines, no text, transparent background. This token model has no
  // suppress-title role, so R's blanked title flattens into the shared
  // void-like surface (documented); everything else matches.
  solid: themed({
    paper: "none",
    panel: "none",
    grid: "none",
    fontSize: 12,
    gridWidth: 0,
    gridX: false,
    gridY: false,
    axisLineX: false,
    axisLineY: false,
    ticksX: false,
    ticksY: false,
    labelsX: false,
    labelsY: false,
    showPanelBorder: false,
    tickLength: 0,
  }),
  // theme_test (#823): pinned high-contrast chrome for package tests / VR.
  // Explicit literals — not an alias of light/classic — so product sweeps
  // cannot retarget snapshot chrome. Stability over brand aesthetics.
  test: themed({
    ink: "#000000",
    paper: "#ffffff",
    panel: "#ffffff",
    accent: "#000000",
    grid: "#cccccc",
    axisText: "#000000",
    axisLine: "#000000",
    tickColor: "#000000",
    panelBorder: "#000000",
    fontFamily: "Helvetica, Arial, sans-serif",
    fontSize: 11,
    axisTextSize: 12,
    fontWeight: 400,
    titleSize: 14,
    titleWeight: 700,
    subtitleSize: 12,
    subtitleWeight: 400,
    axisTitleSize: 11,
    axisTitleWeight: 400,
    captionSize: 9,
    stripSize: 11,
    stripWeight: 400,
    axisLineWidth: 0.5,
    tickWidth: 0.5,
    tickLength: 4,
    gridWidth: 0.5,
    panelBorderWidth: 0.5,
    gridDasharray: "",
    axisLineX: true,
    axisLineY: true,
    ticksX: true,
    ticksY: true,
    gridX: true,
    gridY: true,
    showPanelBorder: true,
  }),
} satisfies Partial<Record<ThemeName, ThemeTokens>>);

/**
 * Theme resolution and CSS var helper. No named-theme catalog import.
 */
import type { ThemeName, ThemeSpec } from "@ggts-sh/spec";
import { THEME_NAMES } from "@ggts-sh/spec";

import { themed, type ThemeTokens } from "./theme-construct.js";

export type { ThemeTokens } from "./theme-construct.js";

/** Thrown for unknown theme names (tier-1 error per the plan). */
export class UnknownThemeError extends Error {
  readonly theme: string;

  constructor(theme: string) {
    super(
      `Unknown theme "${theme}". Registered themes: ${THEME_NAMES.join(", ")}. ` +
        "Pass a registered name or a theme object ({ name?, ink?, paper?, accent?, grid? }).",
    );
    this.name = "UnknownThemeError";
    this.theme = theme;
  }
}

type FoundationBag = {
  ink: string;
  paper: string;
  accent: string;
  grid: string;
  panel: string;
  letterboxFill?: string;
  axisText: string;
  axisLine: string;
  tickColor: string;
  panelBorder: string;
  fontFamily: string;
  fontSize: number;
  axisTextSize: number;
  fontWeight: number;
  titleSize: number;
  titleWeight: number;
  subtitleSize: number;
  subtitleWeight: number;
  axisTitleSize: number;
  axisTitleWeight: number;
  guideTitleSize: number;
  legendKeySize: number;
  legendKeyGap: number;
  legendRowGap: number;
  guideBlockGap: number;
  colorbarThickness: number;
  colorbarLengthMin: number;
  captionSize: number;
  stripSize: number;
  stripWeight: number;
  axisLineWidth: number;
  tickWidth: number;
  tickLength: number;
  gridWidth: number;
  panelBorderWidth: number;
  gridDasharray: string;
  axisLineX: boolean;
  axisLineY: boolean;
  ticksX: boolean;
  ticksY: boolean;
  labelsX: boolean;
  labelsY: boolean;
  gridX: boolean;
  gridY: boolean;
  showPanelBorder: boolean;
};

function foundationFromTokens(t: ThemeTokens): FoundationBag {
  return {
    ink: t.ink,
    paper: t.paper,
    accent: t.accent,
    grid: t.grid,
    panel: t.panel,
    letterboxFill: t.letterboxFill,
    axisText: t.axisText,
    axisLine: t.axisLine,
    tickColor: t.tickColor,
    panelBorder: t.panelBorder,
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    axisTextSize: t.axisTextSize,
    fontWeight: t.fontWeight,
    titleSize: t.titleSize,
    titleWeight: t.titleWeight,
    subtitleSize: t.subtitleSize,
    subtitleWeight: t.subtitleWeight,
    axisTitleSize: t.axisTitleSize,
    axisTitleWeight: t.axisTitleWeight,
    guideTitleSize: t.guideTitleSize,
    legendKeySize: t.legendKeySize,
    legendKeyGap: t.legendKeyGap,
    legendRowGap: t.legendRowGap,
    guideBlockGap: t.guideBlockGap,
    colorbarThickness: t.colorbarThickness,
    colorbarLengthMin: t.colorbarLengthMin,
    captionSize: t.captionSize,
    stripSize: t.stripSize,
    stripWeight: t.stripWeight,
    axisLineWidth: t.axisLineWidth,
    tickWidth: t.tickWidth,
    tickLength: t.tickLength,
    gridWidth: t.gridWidth,
    panelBorderWidth: t.panelBorderWidth,
    gridDasharray: t.gridDasharray,
    axisLineX: t.axisLineX,
    axisLineY: t.axisLineY,
    ticksX: t.ticksX,
    ticksY: t.ticksY,
    labelsX: t.labelsX,
    labelsY: t.labelsY,
    gridX: t.gridX,
    gridY: t.gridY,
    showPanelBorder: t.showPanelBorder,
  };
}

function mergeFoundationColors(
  theme: ThemeSpec,
  fromBase: FoundationBag,
): Pick<
  FoundationBag,
  | "ink"
  | "paper"
  | "accent"
  | "grid"
  | "panel"
  | "letterboxFill"
  | "axisText"
  | "axisLine"
  | "tickColor"
  | "panelBorder"
> {
  return {
    ink: theme.ink ?? fromBase.ink,
    paper: theme.paper ?? fromBase.paper,
    accent: theme.accent ?? fromBase.accent,
    grid: theme.grid ?? fromBase.grid,
    panel: theme.panel ?? fromBase.panel,
    ...(theme.letterboxFill !== undefined && { letterboxFill: theme.letterboxFill }),
    axisText: theme.axisText ?? fromBase.axisText,
    axisLine: theme.axisLine ?? fromBase.axisLine,
    tickColor: theme.tickColor ?? fromBase.tickColor,
    panelBorder: theme.panelBorder ?? fromBase.panelBorder,
  };
}

function mergeFoundationTypography(
  theme: ThemeSpec,
  fromBase: FoundationBag,
): Pick<
  FoundationBag,
  | "fontFamily"
  | "fontSize"
  | "axisTextSize"
  | "fontWeight"
  | "titleSize"
  | "titleWeight"
  | "subtitleSize"
  | "subtitleWeight"
  | "axisTitleSize"
  | "axisTitleWeight"
  | "guideTitleSize"
> {
  return {
    fontFamily: theme.fontFamily ?? fromBase.fontFamily,
    fontSize: theme.fontSize ?? fromBase.fontSize,
    axisTextSize: theme.axisTextSize ?? fromBase.axisTextSize,
    fontWeight: theme.fontWeight ?? fromBase.fontWeight,
    titleSize: theme.titleSize ?? fromBase.titleSize,
    titleWeight: theme.titleWeight ?? fromBase.titleWeight,
    subtitleSize: theme.subtitleSize ?? fromBase.subtitleSize,
    subtitleWeight: theme.subtitleWeight ?? fromBase.subtitleWeight,
    axisTitleSize: theme.axisTitleSize ?? fromBase.axisTitleSize,
    axisTitleWeight: theme.axisTitleWeight ?? fromBase.axisTitleWeight,
    guideTitleSize: theme.guideTitleSize ?? fromBase.guideTitleSize,
  };
}

function mergeFoundationLegendLayout(
  theme: ThemeSpec,
  fromBase: FoundationBag,
): Pick<
  FoundationBag,
  | "legendKeySize"
  | "legendKeyGap"
  | "legendRowGap"
  | "guideBlockGap"
  | "colorbarThickness"
  | "colorbarLengthMin"
  | "captionSize"
  | "stripSize"
  | "stripWeight"
> {
  return {
    legendKeySize: theme.legendKeySize ?? fromBase.legendKeySize,
    legendKeyGap: theme.legendKeyGap ?? fromBase.legendKeyGap,
    legendRowGap: theme.legendRowGap ?? fromBase.legendRowGap,
    guideBlockGap: theme.guideBlockGap ?? fromBase.guideBlockGap,
    colorbarThickness: theme.colorbarThickness ?? fromBase.colorbarThickness,
    colorbarLengthMin: theme.colorbarLengthMin ?? fromBase.colorbarLengthMin,
    captionSize: theme.captionSize ?? fromBase.captionSize,
    stripSize: theme.stripSize ?? fromBase.stripSize,
    stripWeight: theme.stripWeight ?? fromBase.stripWeight,
  };
}

function mergeFoundationMetrics(
  theme: ThemeSpec,
  fromBase: FoundationBag,
): Pick<
  FoundationBag,
  "axisLineWidth" | "tickWidth" | "tickLength" | "gridWidth" | "panelBorderWidth" | "gridDasharray"
> {
  return {
    axisLineWidth: theme.axisLineWidth ?? fromBase.axisLineWidth,
    tickWidth: theme.tickWidth ?? fromBase.tickWidth,
    tickLength: theme.tickLength ?? fromBase.tickLength,
    gridWidth: theme.gridWidth ?? fromBase.gridWidth,
    panelBorderWidth: theme.panelBorderWidth ?? fromBase.panelBorderWidth,
    gridDasharray: theme.gridDasharray ?? fromBase.gridDasharray,
  };
}

function mergeFoundationVisibility(
  theme: ThemeSpec,
  fromBase: FoundationBag,
): Pick<
  FoundationBag,
  | "axisLineX"
  | "axisLineY"
  | "ticksX"
  | "ticksY"
  | "labelsX"
  | "labelsY"
  | "gridX"
  | "gridY"
  | "showPanelBorder"
> {
  return {
    axisLineX: theme.axisLineX ?? fromBase.axisLineX,
    axisLineY: theme.axisLineY ?? fromBase.axisLineY,
    ticksX: theme.ticksX ?? fromBase.ticksX,
    ticksY: theme.ticksY ?? fromBase.ticksY,
    labelsX: theme.labelsX ?? fromBase.labelsX,
    labelsY: theme.labelsY ?? fromBase.labelsY,
    gridX: theme.gridX ?? fromBase.gridX,
    gridY: theme.gridY ?? fromBase.gridY,
    showPanelBorder: theme.showPanelBorder ?? fromBase.showPanelBorder,
  };
}

function mergeFoundation(theme: ThemeSpec, base: ThemeTokens): FoundationBag {
  const fromBase = foundationFromTokens(base);
  return {
    ...mergeFoundationColors(theme, fromBase),
    ...mergeFoundationTypography(theme, fromBase),
    ...mergeFoundationLegendLayout(theme, fromBase),
    ...mergeFoundationMetrics(theme, fromBase),
    ...mergeFoundationVisibility(theme, fromBase),
  };
}

function pickTooltipRole(
  explicit: string | undefined,
  baseTip: string,
  rederived: string,
  pureBaseTip: string,
): string {
  if (explicit !== undefined) return explicit;
  if (baseTip !== pureBaseTip) return baseTip;
  return rederived;
}

export type ThemeTable = Readonly<Partial<Record<ThemeName, ThemeTokens>>>;

/**
 * Resolve a spec theme (name or object override) against a provided table.
 * Missing names throw. Callers that want the full catalog pass BUILTIN_THEMES.
 */
export function resolveTheme(
  theme: ThemeName | ThemeSpec | undefined,
  builtins: ThemeTable,
): ThemeTokens {
  if (theme === undefined) {
    const tokens = builtins.default;
    if (tokens === undefined) throw new UnknownThemeError("default");
    return tokens;
  }
  if (typeof theme === "string") {
    const tokens = builtins[theme];
    if (tokens === undefined) throw new UnknownThemeError(theme);
    return tokens;
  }
  const base = resolveTheme(theme.name, builtins);
  const resolved = themed(mergeFoundation(theme, base));
  const pureFromBase = themed(foundationFromTokens(base));
  return {
    ...resolved,
    interactionInk: theme.interactionInk ?? resolved.interactionInk,
    interactionMuted: theme.interactionMuted ?? resolved.interactionMuted,
    focusRing: theme.focusRing ?? resolved.focusRing,
    crosshair: theme.crosshair ?? resolved.crosshair,
    selectionFill: theme.selectionFill ?? resolved.selectionFill,
    selectionStroke: theme.selectionStroke ?? resolved.selectionStroke,
    tooltipPaper: pickTooltipRole(
      theme.tooltipPaper,
      base.tooltipPaper,
      resolved.tooltipPaper,
      pureFromBase.tooltipPaper,
    ),
    tooltipInk: pickTooltipRole(
      theme.tooltipInk,
      base.tooltipInk,
      resolved.tooltipInk,
      pureFromBase.tooltipInk,
    ),
    tooltipBorder: pickTooltipRole(
      theme.tooltipBorder,
      base.tooltipBorder,
      resolved.tooltipBorder,
      pureFromBase.tooltipBorder,
    ),
    toolActive: theme.toolActive ?? resolved.toolActive,
  };
}

export type ThemeColorRole =
  | "ink"
  | "paper"
  | "accent"
  | "grid"
  | "panel"
  | "letterboxFill"
  | "axisText"
  | "axisLine"
  | "tickColor"
  | "panelBorder"
  | "interactionInk"
  | "focusRing"
  | "crosshair"
  | "selectionFill"
  | "selectionStroke"
  | "tooltipPaper"
  | "tooltipInk"
  | "tooltipBorder"
  | "toolActive";

export type ThemeRole = ThemeColorRole | "interactionMuted";

export function themeVar(role: ThemeRole, tokens: ThemeTokens): string {
  return `var(--gg-${role}, ${tokens[role]})`;
}

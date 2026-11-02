/**
 * Theme token construction. No named-theme catalog.
 *
 * Catalog tables live in theme-builtins.ts; resolution lives in theme-resolve.ts.
 */
/** Resolved theme role tokens (CSS colors; "currentColor"/"none" allowed). */
export interface ThemeTokens {
  /** Foreground: axis lines, tick labels, titles, unmapped stroke-ish marks. */
  ink: string;
  /** Background painted behind the whole plot ("none" = transparent). */
  paper: string;
  /** Default fill for unmapped bars / columns / areas. */
  accent: string;
  /** Panel grid lines. */
  grid: string;
  /** Panel background (separate from the plot-wide paper). */
  panel: string;
  /** Fixed-aspect gutter fill (defaults to paper). */
  letterboxFill: string;
  /** Axis tick-label color. */
  axisText: string;
  /** Axis baseline color. */
  axisLine: string;
  /** Tick-mark color. */
  tickColor: string;
  /** Panel-border color. */
  panelBorder: string;
  /** Primary ink for interaction controls and overlays. */
  interactionInk: string;
  /** Opacity applied to marks de-emphasized by an interaction. */
  interactionMuted: number;
  /** Keyboard-focus and active-mark halo color. */
  focusRing: string;
  /** Crosshair guide color. */
  crosshair: string;
  /** Translucent interval-selection fill. */
  selectionFill: string;
  /** Interval-selection and zoom-target stroke. */
  selectionStroke: string;
  /** Opaque tooltip surface. */
  tooltipPaper: string;
  /** Tooltip foreground. */
  tooltipInk: string;
  /** Tooltip keyline. */
  tooltipBorder: string;
  /** Active tool text and underline. */
  toolActive: string;
  /** Explicit chart typeface stack. */
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
  /** Default discrete legend title placement; absent = adaptive. */
  legendTitlePosition?: "top" | "bottom" | "left" | "right";
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
  /** When false, axis tick labels are suppressed (theme_void). Default true. */
  labelsX: boolean;
  labelsY: boolean;
  gridX: boolean;
  gridY: boolean;
  showPanelBorder: boolean;
}

const ROBOTO_CONDENSED = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

export type FoundationThemeTokens = Omit<
  ThemeTokens,
  | "interactionInk"
  | "interactionMuted"
  | "focusRing"
  | "crosshair"
  | "selectionFill"
  | "selectionStroke"
  | "tooltipPaper"
  | "tooltipInk"
  | "tooltipBorder"
  | "toolActive"
  | "letterboxFill"
>;

const HRBR_BASE: FoundationThemeTokens = {
  ink: "#262626",
  paper: "#ffffff",
  accent: "#4385be",
  grid: "#cccccc",
  panel: "#ffffff",
  axisText: "#4d4d4d",
  axisLine: "#cccccc",
  tickColor: "#cccccc",
  panelBorder: "#cccccc",
  fontFamily: ROBOTO_CONDENSED,
  fontSize: 11.5,
  axisTextSize: 11.5,
  fontWeight: 300,
  titleSize: 18,
  titleWeight: 700,
  subtitleSize: 13,
  subtitleWeight: 300,
  // Axis titles sit next to tick labels; keep them at least as large (#753).
  axisTitleSize: 11.5,
  axisTitleWeight: 400,
  guideTitleSize: 11,
  legendKeySize: 10,
  legendKeyGap: 6,
  legendRowGap: 0,
  guideBlockGap: 12,
  colorbarThickness: 12,
  colorbarLengthMin: 180,
  captionSize: 9,
  stripSize: 12,
  stripWeight: 400,
  axisLineWidth: 0.2,
  tickWidth: 0.2,
  tickLength: 5,
  gridWidth: 0.4,
  panelBorderWidth: 0.5,
  gridDasharray: "",
  axisLineX: false,
  axisLineY: false,
  ticksX: false,
  ticksY: false,
  labelsX: true,
  labelsY: true,
  gridX: true,
  gridY: true,
  showPanelBorder: false,
};

function translucent(color: string, alpha: number): string {
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (hex !== null) {
    return `rgba(${Number.parseInt(hex[1]!, 16)}, ${Number.parseInt(hex[2]!, 16)}, ${Number.parseInt(hex[3]!, 16)}, ${alpha})`;
  }
  return `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`;
}

/** Optional tooltip-role overrides accepted by themed() (not foundation). */
export type TooltipRoleOverrides = {
  tooltipPaper?: string;
  tooltipInk?: string;
  tooltipBorder?: string;
};

/**
 * Interaction colors are relationships, not a second palette. Keeping the
 * derivation here means every built-in and edition-specific theme gets a
 * coherent interaction treatment when its foundational roles change.
 *
 * Complete themes may pass optional tooltip* overrides when pure derivation
 * would leave the tip indistinguishable from the chart surface.
 */
export function themed(
  overrides: Partial<FoundationThemeTokens> & {
    letterboxFill?: string;
  } & TooltipRoleOverrides,
): ThemeTokens {
  const {
    letterboxFill,
    tooltipPaper: tooltipPaperOverride,
    tooltipInk: tooltipInkOverride,
    tooltipBorder: tooltipBorderOverride,
    ...foundationOverrides
  } = overrides;
  const foundation = { ...HRBR_BASE, ...foundationOverrides };
  const hasOpaqueSurface = foundation.paper !== "none" || foundation.panel !== "none";
  const derivedTooltipPaper =
    foundation.paper === "none"
      ? foundation.panel === "none"
        ? "#ffffff"
        : foundation.panel
      : foundation.paper;
  const derivedTooltipInk = hasOpaqueSurface
    ? foundation.ink
    : foundation.ink === "currentColor"
      ? "#1f2328"
      : foundation.ink;
  // Flat tooltip chrome only when the theme also draws no frame (#1069).
  // Tufte/void: grid none, no panel border, no axis lines → transparent keyline.
  // few/classic: grid none but framed (panel border or axis lines) → keep
  // panelBorder so boxed themes do not lose their tooltip outline + pin hint.
  const flatTooltipChrome =
    foundation.grid === "none" &&
    !foundation.showPanelBorder &&
    !foundation.axisLineX &&
    !foundation.axisLineY;
  const derivedTooltipBorder = flatTooltipChrome
    ? "transparent"
    : foundation.grid === "none"
      ? foundation.panelBorder
      : foundation.grid;
  return Object.freeze({
    ...foundation,
    letterboxFill: letterboxFill ?? foundation.paper,
    interactionInk: foundation.ink,
    interactionMuted: 0.36,
    focusRing: foundation.accent,
    crosshair: foundation.axisText,
    selectionFill: translucent(foundation.accent, 0.18),
    selectionStroke: foundation.accent,
    tooltipPaper: tooltipPaperOverride ?? derivedTooltipPaper,
    tooltipInk: tooltipInkOverride ?? derivedTooltipInk,
    tooltipBorder: tooltipBorderOverride ?? derivedTooltipBorder,
    toolActive: foundation.ink,
  });
}

/** Edition-1 foundation (no interaction/tooltip roles). */
export const LEGACY_BASE_FOUNDATION = {
  ink: "currentColor",
  paper: "none",
  panel: "none",
  accent: "#4269d0",
  grid: "rgba(128,128,128,0.25)",
  letterboxFill: "none",
  axisText: "currentColor",
  axisLine: "currentColor",
  tickColor: "currentColor",
  panelBorder: "currentColor",
  fontFamily: "Helvetica, Arial, sans-serif",
  fontSize: 11,
  axisTextSize: 11,
  fontWeight: 400,
  titleSize: 15,
  titleWeight: 700,
  subtitleSize: 12,
  subtitleWeight: 400,
  axisTitleSize: 11,
  axisTitleWeight: 400,
  captionSize: 9,
  stripSize: 11,
  stripWeight: 400,
  axisLineWidth: 1,
  tickWidth: 1,
  tickLength: 6,
  gridWidth: 1,
  panelBorderWidth: 1,
  axisLineX: true,
  axisLineY: true,
  ticksX: true,
  ticksY: true,
} as const satisfies Partial<FoundationThemeTokens> & { letterboxFill: string };

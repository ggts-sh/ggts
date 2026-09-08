/**
 * Theme API reference tables for /reference/themes.
 *
 * Role keys match ThemeSpec / NamedThemeLayerProps (factory.svelte.ts).
 * CSS custom properties match themeVar() (`--gg-*`) and interaction chrome
 * tokens from themeTokensToCss() (`--gg-theme-*`).
 */
import { THEME_NAME_ALIASES, THEME_NAMES, type ThemeName } from "@ggts-sh/spec";

export type ThemeRoleKind = "color" | "opacity" | "type" | "length" | "boolean" | "dash";

export interface ThemeRoleRef {
  readonly name: string;
  readonly kind: ThemeRoleKind;
  /** What this role paints or controls in the chart. */
  readonly affects: string;
  /**
   * CSS custom property(s) hosts may set on the plot root (or an ancestor).
   * Chart paint uses `--gg-{role}`; interaction chrome also publishes
   * `--gg-theme-{role}` for a subset of roles.
   */
  readonly css: string;
}

/** Color + interaction roles that feed marks, paper, axes, and recovery chrome. */
export const THEME_COLOR_ROLES = [
  {
    name: "ink",
    kind: "color",
    affects: "Axis lines, tick labels, titles, unmapped line/point/text marks, legend labels.",
    css: "--gg-ink",
  },
  {
    name: "paper",
    kind: "color",
    affects: 'Plot-wide background. Use "none" for transparent.',
    css: "--gg-paper",
  },
  {
    name: "accent",
    kind: "color",
    affects: "Default fill for unmapped bars, columns, and areas.",
    css: "--gg-accent",
  },
  {
    name: "grid",
    kind: "color",
    affects: "Panel major grid lines.",
    css: "--gg-grid",
  },
  {
    name: "panel",
    kind: "color",
    affects: "Panel background (separate from paper).",
    css: "--gg-panel",
  },
  {
    name: "letterboxFill",
    kind: "color",
    affects: "Fixed-aspect gutter fill. Defaults to paper when unset.",
    css: "--gg-letterboxFill",
  },
  {
    name: "axisText",
    kind: "color",
    affects: "Axis tick-label color.",
    css: "--gg-axisText",
  },
  {
    name: "axisLine",
    kind: "color",
    affects: "Axis baseline color.",
    css: "--gg-axisLine",
  },
  {
    name: "tickColor",
    kind: "color",
    affects: "Axis tick-mark color.",
    css: "--gg-tickColor",
  },
  {
    name: "panelBorder",
    kind: "color",
    affects: "Panel frame color when showPanelBorder is true.",
    css: "--gg-panelBorder",
  },
  {
    name: "interactionInk",
    kind: "color",
    affects: "Primary interaction-control and overlay ink (tool rail, clear, overlays).",
    css: "--gg-interactionInk / --gg-theme-interactionInk",
  },
  {
    name: "interactionMuted",
    kind: "opacity",
    affects:
      "Opacity for marks de-emphasized by legend focus or selection (0–1 number, not a color).",
    css: "--gg-interactionMuted / --gg-theme-interactionMuted (numeric alpha)",
  },
  {
    name: "focusRing",
    kind: "color",
    affects: "Keyboard-focus and active-mark halo.",
    css: "--gg-focusRing / --gg-theme-focusRing",
  },
  {
    name: "crosshair",
    kind: "color",
    affects: "Crosshair guide color.",
    css: "--gg-crosshair / --gg-theme-crosshair",
  },
  {
    name: "selectionFill",
    kind: "color",
    affects: "Interval-selection fill (normally translucent).",
    css: "--gg-selectionFill / --gg-theme-selectionFill",
  },
  {
    name: "selectionStroke",
    kind: "color",
    affects: "Interval-selection and zoom-target stroke.",
    css: "--gg-selectionStroke / --gg-theme-selectionStroke",
  },
  {
    name: "tooltipPaper",
    kind: "color",
    affects: "Opaque tooltip surface.",
    css: "--gg-tooltipPaper / --gg-theme-tooltipPaper",
  },
  {
    name: "tooltipInk",
    kind: "color",
    affects: "Tooltip foreground text.",
    css: "--gg-tooltipInk / --gg-theme-tooltipInk",
  },
  {
    name: "tooltipBorder",
    kind: "color",
    affects: "Tooltip keyline.",
    css: "--gg-tooltipBorder / --gg-theme-tooltipBorder",
  },
  {
    name: "toolActive",
    kind: "color",
    affects: "Active tool text and underline on the tool rail.",
    css: "--gg-toolActive / --gg-theme-toolActive",
  },
] as const satisfies readonly ThemeRoleRef[];

/** Typography, spacing, and chrome geometry roles (numbers unless noted). */
export const THEME_TYPE_AND_GEOMETRY_ROLES = [
  {
    name: "fontFamily",
    kind: "type",
    affects: "Chart typeface stack.",
    css: "via resolved tokens (SVG font-family attribute)",
  },
  {
    name: "fontSize",
    kind: "length",
    affects: "Base and tick-label size in px.",
    css: "resolved tokens",
  },
  {
    name: "axisTextSize",
    kind: "length",
    affects: "Axis tick-label size in px.",
    css: "resolved tokens",
  },
  {
    name: "fontWeight",
    kind: "length",
    affects: "Base font weight (1–1000).",
    css: "resolved tokens",
  },
  {
    name: "titleSize",
    kind: "length",
    affects: "Plot title size in px.",
    css: "resolved tokens",
  },
  {
    name: "titleWeight",
    kind: "length",
    affects: "Plot title weight.",
    css: "resolved tokens",
  },
  {
    name: "subtitleSize",
    kind: "length",
    affects: "Plot subtitle size in px.",
    css: "resolved tokens",
  },
  {
    name: "subtitleWeight",
    kind: "length",
    affects: "Plot subtitle weight.",
    css: "resolved tokens",
  },
  {
    name: "axisTitleSize",
    kind: "length",
    affects: "Axis title size in px.",
    css: "resolved tokens",
  },
  {
    name: "axisTitleWeight",
    kind: "length",
    affects: "Axis title weight.",
    css: "resolved tokens",
  },
  {
    name: "guideTitleSize",
    kind: "length",
    affects: "Legend / guide title size in px.",
    css: "resolved tokens",
  },
  {
    name: "legendKeySize",
    kind: "length",
    affects: "Legend swatch size in px.",
    css: "resolved tokens",
  },
  {
    name: "legendKeyGap",
    kind: "length",
    affects: "Gap between legend swatch and label.",
    css: "resolved tokens",
  },
  {
    name: "legendRowGap",
    kind: "length",
    affects: "Vertical gap between legend rows.",
    css: "resolved tokens",
  },
  {
    name: "guideBlockGap",
    kind: "length",
    affects: "Gap between stacked guide blocks.",
    css: "resolved tokens",
  },
  {
    name: "colorbarThickness",
    kind: "length",
    affects: "Continuous colorbar thickness in px.",
    css: "resolved tokens",
  },
  {
    name: "colorbarLengthMin",
    kind: "length",
    affects: "Minimum colorbar length in px.",
    css: "resolved tokens",
  },
  {
    name: "captionSize",
    kind: "length",
    affects: "Caption text size in px.",
    css: "resolved tokens",
  },
  {
    name: "stripSize",
    kind: "length",
    affects: "Facet strip label size in px.",
    css: "resolved tokens",
  },
  {
    name: "stripWeight",
    kind: "length",
    affects: "Facet strip label weight.",
    css: "resolved tokens",
  },
  {
    name: "axisLineWidth",
    kind: "length",
    affects: "Axis baseline stroke width.",
    css: "resolved tokens",
  },
  {
    name: "tickWidth",
    kind: "length",
    affects: "Tick-mark stroke width.",
    css: "resolved tokens",
  },
  {
    name: "tickLength",
    kind: "length",
    affects: "Tick-mark length in px.",
    css: "resolved tokens",
  },
  {
    name: "gridWidth",
    kind: "length",
    affects: "Grid-line stroke width.",
    css: "resolved tokens",
  },
  {
    name: "panelBorderWidth",
    kind: "length",
    affects: "Panel border stroke width.",
    css: "resolved tokens",
  },
  {
    name: "gridDasharray",
    kind: "dash",
    affects: "SVG stroke-dasharray for major grid lines.",
    css: "resolved tokens",
  },
  {
    name: "axisLineX",
    kind: "boolean",
    affects: "Draw the x-axis baseline.",
    css: "resolved tokens",
  },
  {
    name: "axisLineY",
    kind: "boolean",
    affects: "Draw the y-axis baseline.",
    css: "resolved tokens",
  },
  {
    name: "ticksX",
    kind: "boolean",
    affects: "Draw x-axis ticks.",
    css: "resolved tokens",
  },
  {
    name: "ticksY",
    kind: "boolean",
    affects: "Draw y-axis ticks.",
    css: "resolved tokens",
  },
  {
    name: "labelsX",
    kind: "boolean",
    affects: "Show x-axis tick labels (false for theme_void-style blanking).",
    css: "resolved tokens",
  },
  {
    name: "labelsY",
    kind: "boolean",
    affects: "Show y-axis tick labels.",
    css: "resolved tokens",
  },
  {
    name: "gridX",
    kind: "boolean",
    affects: "Draw vertical grid lines.",
    css: "resolved tokens",
  },
  {
    name: "gridY",
    kind: "boolean",
    affects: "Draw horizontal grid lines.",
    css: "resolved tokens",
  },
  {
    name: "showPanelBorder",
    kind: "boolean",
    affects: "Draw the panel frame.",
    css: "resolved tokens",
  },
] as const satisfies readonly ThemeRoleRef[];

export const ALL_THEME_ROLES = [
  ...THEME_COLOR_ROLES,
  ...THEME_TYPE_AND_GEOMETRY_ROLES,
] as const satisfies readonly ThemeRoleRef[];

/** PortableSpec theme name → Svelte shell component (ThemeDefault, …). */
export function themeComponentName(name: ThemeName): string {
  const body = name.replaceAll("_", "");
  return `Theme${body.charAt(0).toUpperCase()}${body.slice(1)}`;
}

export interface ThemeShellRef {
  readonly name: ThemeName;
  readonly component: string;
  /** When set, this name shares tokens with the canonical theme. */
  readonly aliasOf?: ThemeName;
}

/** Every registered theme shell, including grey/gray aliases of ggplot2. */
export const THEME_SHELLS: readonly ThemeShellRef[] = THEME_NAMES.map((name) => {
  const aliasOf = (THEME_NAME_ALIASES as Partial<Record<ThemeName, ThemeName>>)[name];
  return {
    name,
    component: themeComponentName(name),
    ...(aliasOf !== undefined && { aliasOf }),
  };
});

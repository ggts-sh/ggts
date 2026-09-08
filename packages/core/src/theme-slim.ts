/**
 * default + void token tables (both editions). No full named-theme catalog.
 */
import type { ThemeName } from "@ggts-sh/spec";

import { LEGACY_BASE_FOUNDATION, themed, type ThemeTokens } from "./theme-construct.js";

const THEME_DEFAULT = themed({});

const THEME_VOID = themed({
  paper: "none",
  panel: "none",
  grid: "none",
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
});

const THEME_DEFAULT_LEGACY = themed(LEGACY_BASE_FOUNDATION);

/** Edition-2 lean table: unnamed + void. Missing names throw at resolve time. */
export const SLIM_THEMES: Readonly<Partial<Record<ThemeName, ThemeTokens>>> = Object.freeze({
  default: THEME_DEFAULT,
  void: THEME_VOID,
});

/** Edition-1 lean table: legacy default + void. */
export const SLIM_THEMES_LEGACY: Readonly<Partial<Record<ThemeName, ThemeTokens>>> = Object.freeze({
  default: THEME_DEFAULT_LEGACY,
  void: THEME_VOID,
});

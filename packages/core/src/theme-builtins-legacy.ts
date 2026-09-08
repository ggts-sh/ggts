/**
 * Edition-1 (legacy) theme overlay. Kept apart from the cohort tables so the
 * legacy table can spread the fully-assembled catalog without an import cycle.
 */
import type { ThemeName } from "@ggts-sh/spec";
import { LEGACY_BASE_FOUNDATION, themed, type ThemeTokens } from "./theme-construct.js";

const LEGACY_BASE = themed(LEGACY_BASE_FOUNDATION);

/** Edition-1 color themes with their original typography and chrome. */
export function legacyBuiltinThemes(
  builtins: Readonly<Record<ThemeName, ThemeTokens>>,
): Readonly<Record<ThemeName, ThemeTokens>> {
  return Object.freeze({
    ...builtins,
    default: LEGACY_BASE,
    light: themed({
      ...LEGACY_BASE_FOUNDATION,
      ink: "#1f2328",
      paper: "#ffffff",
      panel: "none",
      axisText: "#1f2328",
      axisLine: "#1f2328",
      tickColor: "#1f2328",
      grid: "rgba(31,35,40,0.14)",
    }),
    dark: themed({
      ...LEGACY_BASE_FOUNDATION,
      ink: "#e6e8eb",
      paper: "#16181d",
      panel: "none",
      accent: "#7ea1f0",
      axisText: "#e6e8eb",
      axisLine: "#e6e8eb",
      tickColor: "#e6e8eb",
      grid: "rgba(230,232,235,0.16)",
      // Elevate fill only — border stays derived from legacy rgba grid.
      tooltipPaper: "#22262d",
    }),
    minimal: themed({
      ...LEGACY_BASE_FOUNDATION,
      accent: "#9498a0",
      grid: "rgba(128,128,128,0.12)",
    }),
  });
}

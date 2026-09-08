/**
 * Built-in theme tables and token construction.
 *
 * Holds the frozen BUILTIN_THEMES / LEGACY_BUILTIN_THEMES registries, assembled
 * from the cohort tables in theme-builtins-{core,ggthemes,publication}.ts; the
 * edition-1 overlay lives in theme-builtins-legacy.ts. Token construction is
 * theme-construct.ts; resolution is theme-resolve.ts.
 */
import type { ThemeName } from "@ggts-sh/spec";
import type { ThemeTokens } from "./theme-construct.js";
import { CORE_BUILTIN_THEMES } from "./theme-builtins-core.js";
import { SOLARIZED_BUILTIN_THEMES } from "./theme-builtins-ggthemes.js";
import { PUBLICATION_BUILTIN_THEMES } from "./theme-builtins-publication.js";
import { legacyBuiltinThemes } from "./theme-builtins-legacy.js";

export type { ThemeTokens } from "./theme-construct.js";
export { themed } from "./theme-construct.js";

/**
 * Built-in themes for edition 2, frozen in the documented registration order:
 * core defaults, ggthemes ports (Stata/Solarized/Economist), then publication
 * styles through the pinned test chrome.
 */
export const BUILTIN_THEMES: Readonly<Record<ThemeName, ThemeTokens>> = Object.freeze({
  ...CORE_BUILTIN_THEMES,
  ...SOLARIZED_BUILTIN_THEMES,
  ...PUBLICATION_BUILTIN_THEMES,
});

export const LEGACY_BUILTIN_THEMES: Readonly<Record<ThemeName, ThemeTokens>> =
  legacyBuiltinThemes(BUILTIN_THEMES);

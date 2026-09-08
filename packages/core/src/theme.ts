/**
 * Theme registry public path.
 *
 * Construction: theme-construct.ts. Catalog: theme-builtins.ts.
 * Resolution without the catalog: theme-resolve.ts. This module keeps the
 * stable `./theme.js` import and defaults resolveTheme to the full catalog.
 */
import type { ThemeName, ThemeSpec } from "@ggts-sh/spec";

import { BUILTIN_THEMES } from "./theme-builtins.js";
import { resolveTheme as resolveThemeAgainst, type ThemeTable } from "./theme-resolve.js";
import type { ThemeTokens } from "./theme-construct.js";

export { BUILTIN_THEMES, LEGACY_BUILTIN_THEMES, type ThemeTokens } from "./theme-builtins.js";
export {
  themeVar,
  UnknownThemeError,
  type ThemeColorRole,
  type ThemeRole,
  type ThemeTable,
} from "./theme-resolve.js";

export function resolveTheme(
  theme?: ThemeName | ThemeSpec,
  builtins: ThemeTable = BUILTIN_THEMES,
): ThemeTokens {
  return resolveThemeAgainst(theme, builtins);
}

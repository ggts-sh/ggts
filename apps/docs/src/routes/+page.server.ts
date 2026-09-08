import { palmerPenguins } from "@ggts-sh/core/data";

import { homeGrammarStaticSvgFromData } from "$lib/theme-specimens/static-svg";

/**
 * Prerender grammar shells so the home client does not need @ggts-sh/core
 * for first paint. Matches `contrastChartTheme()`: fivethirtyeight on the
 * light site, light on dark. CSS picks the shell from `data-theme` set by
 * static/theme.js before first paint.
 */
export function load() {
  const penguins = palmerPenguins as readonly Record<string, unknown>[];
  return {
    grammarStaticSvgLightSite: homeGrammarStaticSvgFromData(penguins, {
      theme: "fivethirtyeight",
      height: 400,
    }),
    grammarStaticSvgDarkSite: homeGrammarStaticSvgFromData(penguins, {
      theme: "light",
      height: 400,
    }),
  };
}

/**
 * Every example describes itself twice: spec.ts (the PortableSpec the docs
 * "Builder"/"Spec" tabs are built from) and Example.svelte (what the gallery
 * actually renders). Data, aes and labs have always been hand-duplicated that
 * way, but `theme` is the one attribute where drift is visible: the gallery
 * would render one theme while Spec JSON shows another.
 *
 * So the duplication is allowed, but it is not allowed to disagree. Guard for
 * #656, which is the first change to make theme load-bearing in examples/**.
 *
 * Theme is declared as a declaration-only child (`<ThemeDark />`,
 * `<Theme name="dark" />`, …). The GGPlot `theme` prop was removed in 0.13.0.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { PortableSpec } from "@ggts-sh/spec";

import { EXAMPLES } from "../examples/manifest.ts";

const ROOT = join(import.meta.dir, "..");

/** `<GGPlot {spec} …>` — the passthrough form, which cannot drift by design. */
const PASSTHROUGH = /<GGPlot\b[^>]*\{spec\}/g;
const GGPLOT_TAG = /<GGPlot\b/g;
const ANY_THEME_PROP = /\btheme=/g;

/** Named theme shells exported from `@ggts-sh/svelte` (ThemeName → component). */
const THEME_SHELL: Readonly<Record<string, string>> = {
  default: "ThemeDefault",
  light: "ThemeLight",
  dark: "ThemeDark",
  minimal: "ThemeMinimal",
  ggplot2: "ThemeGgplot2",
  classic: "ThemeClassic",
  bw: "ThemeBw",
  hrbr: "ThemeHrbr",
  few: "ThemeFew",
  clean: "ThemeClean",
  fivethirtyeight: "ThemeFivethirtyeight",
  economist: "ThemeEconomist",
  tufte: "ThemeTufte",
  linedraw: "ThemeLinedraw",
  void: "ThemeVoid",
  stata: "ThemeStata",
  stata_s1color: "ThemeStatas1color",
  solarized: "ThemeSolarized",
  solarizeddark: "ThemeSolarizeddark",
  economist_white: "ThemeEconomistwhite",
  solarized_2: "ThemeSolarized2",
  solarized_2dark: "ThemeSolarized2dark",
  wsj: "ThemeWsj",
  hc: "ThemeHc",
  hcdark: "ThemeHcdark",
  pander: "ThemePander",
  base: "ThemeBase",
  igray: "ThemeIgray",
  map: "ThemeMap",
  solid: "ThemeSolid",
  grey: "ThemeGrey",
  gray: "ThemeGray",
  test: "ThemeTest",
};

const ANY_THEME_SHELL = new RegExp(`<(?:${Object.values(THEME_SHELL).join("|")})\\b`, "g");
/**
 * Generic `<Theme …>` shell only. `<Theme\b` does not match `ThemeDark` etc.
 * because the next character after `Theme` is still a word char (no boundary).
 */
const ANY_GENERIC_THEME = /<Theme\b/g;

function countMatches(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

/** Every theme declaration form (prop, named shell, or generic `<Theme name>`). */
function totalThemeDeclarations(source: string): number {
  return (
    countMatches(source, ANY_THEME_PROP) +
    countMatches(source, ANY_THEME_SHELL) +
    countMatches(source, ANY_GENERIC_THEME)
  );
}

/** Count how many times `theme` is declared on hand-written plots (prop or child). */
function themeDeclarations(source: string, theme: string): number {
  const shell = THEME_SHELL[theme];
  const propForm = countMatches(source, new RegExp(`\\btheme="${theme}"`, "g"));
  const shellForm = shell === undefined ? 0 : countMatches(source, new RegExp(`<${shell}\\b`, "g"));
  const genericForm = countMatches(source, new RegExp(`<Theme\\b[^>]*\\bname="${theme}"`, "g"));
  return propForm + shellForm + genericForm;
}

async function loadSpec(id: string): Promise<PortableSpec> {
  const modulePath = pathToFileURL(join(ROOT, "examples", id, "spec.ts")).href;
  const module = (await import(modulePath)) as { default: PortableSpec };
  return module.default;
}

function svelteSource(id: string): string {
  return readFileSync(join(ROOT, "examples", id, "Example.svelte"), "utf8");
}

describe("example theme parity (spec.ts vs Example.svelte)", () => {
  for (const entry of EXAMPLES) {
    it(`${entry.id} declares the same theme on both surfaces`, async () => {
      const spec = await loadSpec(entry.id);
      const source = svelteSource(entry.id);
      const theme = spec.theme;

      if (theme === undefined) {
        // No theme in the spec means the renderer resolves the built-in
        // default; the component must not quietly assert something else.
        expect(totalThemeDeclarations(source)).toBe(0);
        return;
      }

      const plots = countMatches(source, GGPLOT_TAG);
      const passthrough = countMatches(source, PASSTHROUGH);
      const handWritten = plots - passthrough;

      if (typeof theme !== "string") {
        // Object-form theme (name + role overrides). Either pure {spec}
        // passthrough, or hand-written plots that declare the matching Theme
        // shell and every role key as a prop — so the Svelte tab still shows
        // the full chart instead of a thin {spec} shell.
        if (handWritten === 0) {
          expect(passthrough).toBeGreaterThan(0);
          return;
        }
        const name = typeof theme.name === "string" ? theme.name : "default";
        expect(themeDeclarations(source, name)).toBe(handWritten);
        for (const key of Object.keys(theme)) {
          if (key === "name") continue;
          expect(source).toMatch(new RegExp(`\\b${key}=`));
        }
        return;
      }

      // Every hand-written <GGPlot> must name the spec's theme (prop or child),
      // and no plot may carry a theme the spec does not declare. Both counters
      // include prop / named shell / generic `<Theme name="…">` so they agree.
      expect(themeDeclarations(source, theme)).toBe(handWritten);
      expect(totalThemeDeclarations(source)).toBe(handWritten);
    });
  }
});

/**
 * The repo composes its own charts the way it tells consumers to (#659 slices
 * 8 and 9).
 *
 * 0.11.0 deprecated the seven grammar props on `<GGPlot>` (facet, coord,
 * scales, guides, legend, theme, labs) in favour of declaration-only child
 * layers, and shipped `ggts-codemod` to migrate them. Documentation that
 * still passes them is the loudest possible counter-argument, so this asserts
 * two surfaces are on the child form: the docs app's own Svelte sources plus
 * the getting-started page the guide builds line by line (slice 8), and every
 * Svelte fence in the guide itself (slice 9).
 *
 * For the sources, the check IS the codemod: a file is migrated when running
 * it over that file rewrites nothing (`changes`) and refuses nothing
 * (`skipped`). Reusing the shipped transform rather than a bespoke regex means
 * the guard cannot drift from what `npx ggts-codemod` would tell a reader
 * to do. Guide fences are matched textually instead, because most of them are
 * deliberately incomplete and would not parse.
 */
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import lifecycle from "../lifecycle.json";
import { migratePlotProps } from "../packages/svelte/src/lib/codemod/migrate-plot-props.ts";
import { deprecatedGrammarPropPattern } from "../packages/svelte/src/lib/layers/grammar-families.ts";
import { guidePages, type LifecycleDoc } from "./gen-llms.ts";
import { codeBlocks } from "./guide-code-contract.ts";
import { foldSakura, QUICKSTART_PAGE_FILENAME, SAKURA_STEPS } from "./quickstart.ts";
import { SEQUENTIAL_RASTER_SNIPPET } from "../apps/docs/src/lib/theme-specimens/snippets.ts";

const ROOT = join(import.meta.dir, "..");

function svelteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : svelteFiles(path);
    return path.endsWith(".svelte") ? [path] : [];
  });
}

/**
 * Every authored `.svelte` in the docs app. `__perf` routes are in scope on
 * purpose: they are read as usage examples as readily as the gallery is.
 */
const DOCS_SVELTE = svelteFiles(join(ROOT, "apps/docs/src"));

describe("the repo's own charts use child layers, not deprecated grammar props", () => {
  it("finds docs Svelte sources to check", () => {
    // A broken walk would make every assertion below vacuously pass.
    expect(DOCS_SVELTE.length).toBeGreaterThan(20);
  });

  for (const path of DOCS_SVELTE) {
    const name = relative(ROOT, path);
    it(`${name} needs no migration`, () => {
      const result = migratePlotProps(readFileSync(path, "utf8"));
      expect({
        rewritable: result.changes.map((c) => `${c.prop} (line ${String(c.line)})`),
        manual: result.skipped.map((s) => `${s.prop} (line ${String(s.line)})`),
      }).toEqual({ rewritable: [], manual: [] });
    });
  }

  // Every fold, not just the first and last: the getting-started page shows
  // one of these per step, and a reader types whichever one is on screen.
  for (let step = 0; step <= SAKURA_STEPS.length; step += 1) {
    it(`the ${QUICKSTART_PAGE_FILENAME} at step ${String(step)} needs no migration`, () => {
      const result = migratePlotProps(foldSakura(step).source);
      expect({
        rewritable: result.changes.map((c) => c.prop),
        manual: result.skipped.map((s) => s.prop),
      }).toEqual({ rewritable: [], manual: [] });
    });
  }

  // Whole files the palettes page offers for copying, assembled as strings so
  // the Svelte compiler never sees their literal </script> tags — which also
  // puts them out of reach of the .svelte walk above.
  const SNIPPETS: readonly (readonly [string, string])[] = [
    ["SEQUENTIAL_RASTER_SNIPPET", SEQUENTIAL_RASTER_SNIPPET],
  ];

  for (const [name, source] of SNIPPETS) {
    it(`the ${name} the docs offer for copying needs no migration`, () => {
      const result = migratePlotProps(source);
      expect({
        rewritable: result.changes.map((c) => c.prop),
        manual: result.skipped.map((s) => s.prop),
      }).toEqual({ rewritable: [], manual: [] });
    });
  }
});

/**
 * The seven props deprecated in 0.11.0, as they appear in an authored fence.
 * Matched at the start of a line or straight after `<GGPlot` so `<Facet …>`,
 * `<Theme name=…>` and a `theme` key inside a JSON spec never trip it.
 * Derived from GRAMMAR_FAMILIES (#785) so the list cannot drift from the table.
 */
const DEPRECATED_PROP = deprecatedGrammarPropPattern();

/**
 * The upgrading guide is the one page that must show the deprecated form: its
 * whole job is a before/after table. Every other page teaches the child API.
 */
const SHOWS_THE_OLD_FORM = new Set(["upgrading"]);

describe("the guide teaches child layers, not deprecated grammar props", () => {
  const pages = guidePages(lifecycle as unknown as LifecycleDoc);

  it("finds guide pages to check", () => {
    expect(pages.length).toBeGreaterThan(10);
  });

  for (const page of pages) {
    if (SHOWS_THE_OLD_FORM.has(page.slug)) continue;
    it(`/guide/${page.slug} shows no deprecated grammar prop`, () => {
      const offenders = codeBlocks(page.markdown)
        .filter((block) => block.language === "svelte")
        .flatMap((block) => [...block.source.matchAll(DEPRECATED_PROP)].map((m) => m[1]!));
      expect(offenders).toEqual([]);
    });
  }

  it("the upgrading guide still shows the deprecated form it migrates away from", () => {
    // Guards the exemption above: if this page ever stops demonstrating the
    // old shape, the allowlist is dead weight hiding a real regression.
    const upgrading = pages.find((p) => p.slug === "upgrading");
    expect(upgrading).toBeDefined();
    const shown = codeBlocks(upgrading!.markdown)
      .filter((block) => block.language === "svelte")
      .flatMap((block) => [...block.source.matchAll(DEPRECATED_PROP)].map((m) => m[1]!));
    expect(shown.length).toBeGreaterThan(0);
  });
});

/**
 * Guards 3 & 4 — inventory completeness.
 *
 * Guard 3: the reference tables must have a structured row for every geom,
 * stat, position, theme, and color scheme the spec knows. Adding one upstream
 * turns the skill red until it is documented; this is the pre-changesets
 * lock-step guard.
 *
 * Guard 4: the SKILL.md lead-line inventory — the summary prose in
 * "Scales, palettes, themes" states totals (and for themes, the **full
 * product name list**) that agents see without opening references/. Format:
 *   `N named schemes — M categorical (…examples…) and K sequential…`
 *   `Themes: T names (`name`, `name`, … plus `grey`/`gray` alias note)`
 * N = COLOR_SCHEME_NAMES.length, M = CATEGORICAL_SCHEME_NAMES.length,
 * K = SEQUENTIAL_SCHEME_NAMES.length, T = THEME_NAMES without `test`.
 * Theme lead line must name every product theme (comprehensive — not a
 * representative subset). Full looks/shells live in references/themes.md.
 * Reference section headers `### Categorical schemes (M)` and
 * `### Sequential schemes (K)` must match the same M/K.
 *
 * The `test` theme is excluded from the theme inventory on purpose: it is the
 * internal snapshot theme, not a product surface.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  CATEGORICAL_SCHEME_NAMES,
  COLOR_SCHEME_NAMES,
  KNOWN_GEOMS,
  KNOWN_POSITIONS,
  KNOWN_STATS,
  SEQUENTIAL_SCHEME_NAMES,
  THEME_NAMES,
} from "@ggsvelte/spec";
import { ROOT, SKILL_DIR, tableCellNames } from "./test-helpers.ts";

/**
 * Product themes agents may name — every THEME_NAMES entry except the internal
 * snapshot theme `test`. Includes `grey`/`gray` aliases of `ggplot2`.
 */
const PRODUCT_THEME_NAMES = THEME_NAMES.filter((name) => name !== "test");

/**
 * #1200 postmortem: an agent read PortableSpec.layers[] (marks only) plus a
 * false "are not layers" comment and filed issues claiming Scale/Theme/Guide/
 * Labs/Coord/Facet/Legend were "non-layer grammar components." They are Layer
 * kinds in Svelte. Keep the skill and quickstart from reintroducing that claim.
 */
describe("layer ontology (grammar families are layers)", () => {
  it("SKILL.md states Svelte Layer union and PortableSpec dual vocabulary", () => {
    const skill = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
    expect(skill).toMatch(/Everything that composes a plot is a layer/i);
    expect(skill).toMatch(/layers\[\] = MARKS ONLY/);
    expect(skill).toMatch(/non-layer grammar component/);
    expect(skill).toMatch(/is wrong/);
    // Affirmative inverted claim must not reappear.
    expect(skill).not.toMatch(/that are not themselves/);
    expect(skill).not.toMatch(/because they are not layers/i);
  });

  it("composition-surfaces.md calls grammar surfaces layers", () => {
    const prose = readFileSync(join(SKILL_DIR, "references", "composition-surfaces.md"), "utf8");
    expect(prose).toMatch(/grammar layer/i);
    expect(prose).not.toMatch(/because they are not layers/i);
  });

  it("quickstart holds grammar children as plot layers, not non-layers", () => {
    const steps = readFileSync(join(ROOT, "scripts", "quickstart", "steps.ts"), "utf8");
    expect(steps).toMatch(/are\*\* plot layers|\*\*are\*\* plot layers|are plot layers/);
    expect(steps).not.toMatch(/because they are not layers/);
  });
});

const referenceFile = (name: string): string =>
  readFileSync(join(SKILL_DIR, "references", name), "utf8");

describe("reference inventories are complete", () => {
  const inventories: readonly {
    file: string;
    label: string;
    names: readonly string[];
  }[] = [
    { file: "geoms-and-stats.md", label: "geoms", names: KNOWN_GEOMS },
    { file: "geoms-and-stats.md", label: "stats", names: KNOWN_STATS },
    { file: "geoms-and-stats.md", label: "positions", names: KNOWN_POSITIONS },
    {
      file: "themes.md",
      label: "themes",
      // `test` is the internal snapshot theme — deliberately undocumented.
      names: THEME_NAMES.filter((name) => name !== "test"),
    },
    {
      file: "scales-and-palettes.md",
      label: "categorical schemes",
      names: CATEGORICAL_SCHEME_NAMES,
    },
    {
      file: "scales-and-palettes.md",
      label: "sequential schemes",
      names: SEQUENTIAL_SCHEME_NAMES,
    },
  ];

  for (const inventory of inventories) {
    it(`references/${inventory.file} documents every ${inventory.label}`, () => {
      const cells = tableCellNames(referenceFile(inventory.file));
      const missing = inventory.names.filter((name) => !cells.has(name));
      expect(missing).toEqual([]);
    });
  }
});

/**
 * Lead-line inventory in SKILL.md. Table rows in references/ are already
 * locked by the inventory suite above; this guards the counts (and the
 * comprehensive theme name list) agents see when they only load SKILL.md
 * (#1210).
 */
describe("SKILL.md lead-line scheme/theme inventory matches registries", () => {
  const skillMd = readFileSync(join(SKILL_DIR, "references", "grammar.md"), "utf8");
  const scalesRef = readFileSync(join(SKILL_DIR, "references", "scales-and-palettes.md"), "utf8");
  const themesRef = readFileSync(join(SKILL_DIR, "references", "themes.md"), "utf8");

  it("states named scheme totals that match COLOR/CATEGORICAL/SEQUENTIAL registries", () => {
    const match = skillMd.match(
      /(\d+) named schemes — (\d+) categorical[\s\S]*?and (\d+) sequential/,
    );
    expect(match).not.toBeNull();
    const [, total, categorical, sequential] = match!;
    expect({
      total: Number(total),
      categorical: Number(categorical),
      sequential: Number(sequential),
    }).toEqual({
      total: COLOR_SCHEME_NAMES.length,
      categorical: CATEGORICAL_SCHEME_NAMES.length,
      sequential: SEQUENTIAL_SCHEME_NAMES.length,
    });
  });

  it("states a theme total that matches product THEME_NAMES (excludes test)", () => {
    const match = skillMd.match(/Themes:\s*(\d+) names/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(PRODUCT_THEME_NAMES.length);
  });

  it("reference palette section headers carry the same categorical/sequential totals", () => {
    const cat = scalesRef.match(/### Categorical schemes \((\d+)\)/);
    const seq = scalesRef.match(/### Sequential schemes \((\d+)\)/);
    expect(cat).not.toBeNull();
    expect(seq).not.toBeNull();
    expect(Number(cat![1])).toBe(CATEGORICAL_SCHEME_NAMES.length);
    expect(Number(seq![1])).toBe(SEQUENTIAL_SCHEME_NAMES.length);
  });

  it("themes.md product-theme heading carries the product theme total", () => {
    const match = themesRef.match(/## Product themes \((\d+)\)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(PRODUCT_THEME_NAMES.length);
  });

  it("lead-line example scheme names are real registry members", () => {
    // Pull the two parenthetical example lists from the scheme lead line.
    const match = skillMd.match(
      /(\d+) named schemes — (\d+) categorical \(([^)]*)\)[\s\S]*?and (\d+) sequential[^(]*\(([^)]*)\)/,
    );
    expect(match).not.toBeNull();
    const known = new Set<string>(COLOR_SCHEME_NAMES);
    const examples = [...`${match![3]} ${match![5]}`.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
    expect(examples.length).toBeGreaterThan(0);
    const unknown = examples.filter((name) => !known.has(name));
    expect(unknown).toEqual([]);
  });

  it("SKILL.md theme lead lists every product theme name (comprehensive)", () => {
    // Themes: T names (`a`, `b`, … plus `grey`/`gray` aliasing `ggplot2`)
    // Allow multi-line parentheticals: stop at the first `) as` that closes
    // the lead (the alias note uses `grey`/`gray` without a bare `)`).
    const match = skillMd.match(/Themes:\s*\d+ names \(([\s\S]*?)\) as/);
    expect(match).not.toBeNull();
    const listed = new Set([...match![1]!.matchAll(/`([^`]+)`/g)].map((m) => m[1]!));
    const missing = PRODUCT_THEME_NAMES.filter((name) => !listed.has(name));
    expect(missing).toEqual([]);
  });
});

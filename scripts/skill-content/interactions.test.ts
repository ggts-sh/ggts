/**
 * Interaction-teaching contracts for the published agent skill.
 *
 * v0.20 host interaction API: teach <Inspect> and GuideLegend focus/filter,
 * not the deprecated plot-level inspect / legendFocus / legendFilter props.
 * Mark-level inspect={false} remains valid (hit-test opt-out).
 *
 * v0.21 row identity: default id-column / row-index; prefer identity on
 * Inspect / Select / createPlotInteraction. Plot-level key is deprecated.
 * SKILL.md must not teach key as a first-class prop or as the required
 * identity surface (#1286 / #1254 / #1257).
 *
 * #1530: Inspect mode selection + multi-layer hit hygiene. API surface
 * (mode options, inspect={false}) is already documented. Agents still ship
 * wrong modes (violin with mode="x", Minard with hit-testable rivers) because
 * the skill never said "do not do that." CLI SVG render cannot catch host
 * Inspect mode — only the skill + a real hover check can. These contracts
 * lock the design rules so skill content stays the gate.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ggplotOpenAttrs, plotLevelInteractionOffenders } from "../ggplot-open-attrs.ts";
import { codeBlocks } from "../guide-code-contract.ts";
import { FILES, SKILL_DIR } from "./test-helpers.ts";

describe("skill Svelte fences use v0.20 interaction children", () => {
  for (const file of FILES) {
    it(`${file.name} shows no plot-level inspect / legendFocus / legendFilter`, () => {
      const offenders = codeBlocks(file.markdown)
        .filter((block) => block.language === "svelte")
        .flatMap((block) =>
          ggplotOpenAttrs(block.source).flatMap((attrs) => plotLevelInteractionOffenders(attrs)),
        );
      expect(offenders).toEqual([]);
    });
  }

  it("interactions.md capability table prefers GuideLegend filter, not plot legendFilter", () => {
    const interactions = FILES.find((f) => f.name === "references/interactions.md");
    expect(interactions).toBeDefined();
    // Table row for filter should name GuideLegend, not GGPlot.
    expect(interactions!.markdown).toMatch(/`filter`\s*\|\s*`boolean[^`]*` on `<GuideLegend>`/);
    // Middle cell may contain markdown-escaped pipes (`\|`); do not use [^|].
    expect(interactions!.markdown).not.toMatch(/\| `legendFilter`\s*\|[^\n]*on `<GGPlot>`/);
  });
});

describe("skill teaches v0.21 row identity, not plot-level key", () => {
  const skill = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
  const interactions = FILES.find((f) => f.name === "references/interactions.md");

  it("SKILL.md nowhere recommends plot-level key without a deprecation note", () => {
    // Bare first-class listing from pre-0.21 skill (the #1286 bug).
    expect(skill).not.toMatch(/`layers`, `key`, `width`/);
    expect(skill).not.toMatch(/Always give a stable `key`/);
    // Every remaining backtick-key mention in SKILL.md is the deprecation note.
    const keyMentions = [...skill.matchAll(/`key`/g)];
    expect(keyMentions.length).toBeGreaterThan(0);
    for (const match of keyMentions) {
      const index = match.index ?? 0;
      const start = Math.max(0, index - 40);
      const end = Math.min(skill.length, index + match[0].length + 40);
      expect(skill.slice(start, end).toLowerCase()).toMatch(/deprecat/);
    }
  });

  it("SKILL.md Interactions section teaches identity defaults", () => {
    expect(skill).toMatch(/Row identity for selection/);
    expect(skill).toMatch(/`id` column when present/);
    expect(skill).toMatch(/`identity` on `<Inspect>`/);
    expect(skill).toMatch(/Plot-level `key` is deprecated/);
  });

  it("interactions.md marks plot-level key deprecated and prefers identity", () => {
    expect(interactions).toBeDefined();
    expect(interactions!.markdown).toMatch(/Plot-level `key` is deprecated/);
    expect(interactions!.markdown).toMatch(/\| `key`\s*\|[^\n]*\*\*deprecated\*\* since 0\.21/);
    expect(interactions!.markdown).toMatch(/Prefer this over plot-level `key`/);
  });
});

describe("skill teaches inspect mode selection and hit hygiene (#1530)", () => {
  const skill = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
  const interactions = FILES.find((f) => f.name === "references/interactions.md");

  it("interactions.md has a Choosing inspect mode section", () => {
    expect(interactions).toBeDefined();
    expect(interactions!.markdown).toMatch(/## Choosing inspect mode/i);
  });

  it("Choosing inspect mode prefers auto when product auto matches geometry", () => {
    const section = interactions!.markdown.match(/## Choosing inspect mode[\s\S]*?(?=\n## )/)?.[0];
    expect(section).toBeDefined();
    expect(section!).toMatch(/Prefer `mode="auto"` when library auto matches/);
    // Axis-group modes only when continuous shared-x (or y) series justify them.
    expect(section!).toMatch(/continuous shared-x|time series|multi-series/i);
  });

  it("pins exact on violin/boxplot/discrete intervals; forbids freescrolling axis guides", () => {
    const section = interactions!.markdown.match(/## Choosing inspect mode[\s\S]*?(?=\n## )/)?.[0];
    expect(section).toBeDefined();
    expect(section!).toMatch(/Anti-patterns/);
    // Discrete distribution/interval geoms: exact focus; never freescrolling x/y/xy (#1528).
    expect(section!).toMatch(/Pin `mode="exact"`/);
    expect(section!).toMatch(/Violin with `mode="x"`/);
    expect(section!).toMatch(/Boxplot with `mode="x"`/);
    expect(section!).toMatch(/errorbar/);
    expect(section!).toMatch(/pointrange/);
    expect(section!).toMatch(/linerange/);
    expect(section!).toMatch(/#1528/);
    // Auto now maps those geoms to exact — skill may recommend exact or leave auto.
    expect(section!).toMatch(/leave `auto`|auto → exact/);
    // Must not claim product auto still freescrolls those marks.
    expect(section!).not.toMatch(/auto still → `x`|auto still maps them to freescrolling/);
  });

  it("documents multi-layer hit hygiene with Minard-class furniture opt-out", () => {
    const section = interactions!.markdown.match(
      /## Multi-layer hit hygiene[\s\S]*?(?=\n## )/,
    )?.[0];
    expect(section).toBeDefined();
    expect(section!).toMatch(/inspect=\{false\}/);
    expect(section!).toMatch(/Minard/);
    expect(section!).toMatch(/path\/trajectory/);
    expect(section!).toMatch(/one primary[\s*]+story family/);
    expect(section!).toMatch(/troop path/);
    // Independent panels — do not invent ring anchors for false linked selection.
    expect(section!).not.toMatch(/ring-anchor|ring anchors/);
    expect(section!).toMatch(/independent|separate panel|shared longitude/i);
    expect(section!).toMatch(/summary/i);
  });

  it("notes that CLI SVG render does not validate host inspect behaviour", () => {
    const section = interactions!.markdown.match(
      /## CLI cannot catch host inspect behaviour[\s\S]*?(?=\n## )/,
    )?.[0];
    expect(section).toBeDefined();
    expect(section!).toMatch(/ggts render/);
    expect(section!).toMatch(
      /does \*\*not\*\* validate host Inspect mode|does not validate host Inspect mode/i,
    );
  });

  it("requires a real hover/pin check after changing interaction (not SVG-only)", () => {
    const section = interactions!.markdown.match(
      /## CLI cannot catch host inspect behaviour[\s\S]*?(?=\n## )/,
    )?.[0];
    expect(section).toBeDefined();
    expect(section!).toMatch(/real hover and pin/i);
    expect(section!).toMatch(/docs site|playground|browser/i);
  });

  it("SKILL.md Interactions section points at mode selection and hit hygiene rules", () => {
    // One short pointer, not a second full copy of the reference.
    const interactionsSection = skill.match(/## Interactions[\s\S]*?(?=\n## )/)?.[0] ?? "";
    expect(interactionsSection.length).toBeGreaterThan(100);
    expect(interactionsSection).toMatch(/references\/interactions\.md/);
    expect(interactionsSection).toMatch(/Choosing inspect\s+mode/);
    expect(interactionsSection).toMatch(/pin `mode="exact"` \(or leave auto\) on violin/i);
    expect(interactionsSection).toMatch(/inspect=\{false\}/);
    expect(interactionsSection).toMatch(/before enabling Inspect/);
  });

  it("records keep-single skill (no split) decision for #1530", () => {
    // Default remains one @ggts-sh/skill until progressive disclosure fails.
    // Recorded in interactions.md so the decision travels with the package.
    const section = interactions!.markdown.match(
      /## CLI cannot catch host inspect behaviour[\s\S]*?(?=\n## )/,
    )?.[0];
    expect(section).toBeDefined();
    expect(section!).toMatch(/Skill packaging decision \(#1530\)/);
    expect(section!).toMatch(/single skill/);
    expect(section!).toMatch(/Do not split/);
  });
});

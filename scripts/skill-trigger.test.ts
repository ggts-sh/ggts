/**
 * Trigger-surface and progressive-disclosure contracts for @ggts-sh/skill.
 *
 * August 2026 skill-eval practice (OpenAI eval-skills, Anthropic skill-creator,
 * philschmid testing-skills) splits work into two layers:
 *
 * 1. Deterministic static contracts — description quality, negative-scope
 *    fixtures, link integrity, progressive disclosure. Cheap, CI-gated,
 *    no model. That is this file.
 * 2. Agent-in-the-loop evals — load SKILL.md, run prompts, score traces with
 *    deterministic graders + optional LLM rubrics, multi-trial pass@k.
 *    Heavier; tracked separately (tests/evals today grades NL→spec without
 *    loading the skill).
 *
 * Fixtures live at packages/skill/evals/trigger-cases.json (not packed —
 * package.json files only lists SKILL.md + references/).
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SKILL_DIR = join(ROOT, "packages", "skill");
const SKILL_MD = join(SKILL_DIR, "SKILL.md");
const REFS_DIR = join(SKILL_DIR, "references");
const FIXTURES = join(SKILL_DIR, "evals", "trigger-cases.json");

interface TriggerCase {
  id: string;
  should_trigger: boolean;
  prompt: string;
  notes: string;
}

const skillMd = readFileSync(SKILL_MD, "utf8");
const frontmatter = skillMd.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
const descriptionLine = frontmatter.split("\n").find((line) => line.startsWith("description:"));
const description = descriptionLine?.slice("description:".length).trim() ?? "";

const cases = JSON.parse(readFileSync(FIXTURES, "utf8")) as TriggerCase[];

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return path.endsWith(".md") ? [path] : [];
  });
}

/** Relative markdown links: [text](path) or [text](path#hash), not http(s). */
function relativeMarkdownTargets(markdown: string): string[] {
  const targets: string[] = [];
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1]!.trim();
    if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("mailto:")) {
      continue;
    }
    if (raw.startsWith("#")) continue; // same-file anchor
    targets.push(raw.split("#")[0]!);
  }
  return targets;
}

describe("skill trigger fixtures", () => {
  it("ships a balanced positive/negative prompt set (10–20 scale)", () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
    expect(cases.length).toBeLessThanOrEqual(40);
    const positives = cases.filter((c) => c.should_trigger);
    const negatives = cases.filter((c) => !c.should_trigger);
    expect(positives.length).toBeGreaterThanOrEqual(5);
    expect(negatives.length).toBeGreaterThanOrEqual(3);
  });

  it("every case has a stable id, prompt, and notes", () => {
    const ids = new Set<string>();
    for (const c of cases) {
      expect(c.id.length).toBeGreaterThan(0);
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
      expect(c.prompt.length).toBeGreaterThan(10);
      expect(c.notes.length).toBeGreaterThan(10);
      expect(typeof c.should_trigger).toBe("boolean");
    }
  });
});

/**
 * The frontmatter description is the primary trigger signal for Claude Code,
 * Codex, and other skill loaders. Vague descriptions cause under- or
 * over-triggering (Langfuse skill-eval postmortem; OpenAI eval-skills §1–4).
 */
describe("SKILL.md frontmatter description (trigger surface)", () => {
  it("is present, non-trivial, and not a multi-line YAML block", () => {
    expect(description.length).toBeGreaterThan(200);
    // Keep the description on one YAML scalar so every loader parses it.
    expect(descriptionLine).toMatch(/^description: \S/);
    expect(description).not.toMatch(/^\|/);
  });

  it("names the product and the two authoring skins agents must choose", () => {
    expect(description.toLowerCase()).toMatch(/ggts/);
    expect(description).toMatch(/grammar-of-graphics|grammar of graphics/i);
    expect(description).toMatch(/Svelte/);
    expect(description).toMatch(/React/);
    expect(description).toMatch(/JSON|spec/i);
  });

  it("lists package import paths agents already have in code", () => {
    // Import-path triggers are high-precision; losing them is a silent regression.
    expect(description).toContain("@ggts-sh/svelte");
    expect(description).toContain("@ggts-sh/react");
    expect(description).toContain("@ggts-sh/spec");
    expect(description).toContain("@ggts-sh/core");
  });

  it("lists concrete chart kinds and composition hooks, not only abstract nouns", () => {
    for (const term of [
      "scatter",
      "bar",
      "histogram",
      "boxplot",
      "density",
      "heatmap",
      "map",
      "faceted",
      "GGPlot",
      "Geom",
    ] as const) {
      expect({ term, hit: description.includes(term) }).toEqual({ term, hit: true });
    }
  });

  it("covers validate/debug and headless render intents", () => {
    expect(description.toLowerCase()).toMatch(/validat/);
    expect(description.toLowerCase()).toMatch(/debug|editing/);
    expect(description).toMatch(/SVG|headless|server-side/i);
  });

  /**
   * Soft coverage: every *positive* fixture should share at least one
   * distinctive token with the description (case-insensitive). This is not a
   * substitute for agent-in-the-loop trigger evals — it only catches description
   * rewrites that drop the vocabulary the fixtures were written against.
   */
  it("positive fixtures share trigger vocabulary with the description", () => {
    const descLower = description.toLowerCase();
    // Tokens that are intentionally in the description and useful for routing.
    const vocab = [
      "ggts",
      "chart",
      "plot",
      "scatter",
      "bar",
      "histogram",
      "boxplot",
      "density",
      "heatmap",
      "map",
      "facet",
      "svelte",
      "spec",
      "json",
      "svg",
      "validate",
      "geom",
      "ggplot",
      "@ggts-sh/svelte",
      "@ggts-sh/spec",
      "@ggts-sh/core",
    ];
    const positives = cases.filter((c) => c.should_trigger);
    for (const c of positives) {
      const promptLower = c.prompt.toLowerCase();
      const shared = vocab.filter((t) => promptLower.includes(t) && descLower.includes(t));
      expect({ id: c.id, shared }).not.toEqual({ id: c.id, shared: [] });
    }
  });
});

/**
 * Progressive disclosure: SKILL.md is the always-loaded body; references/ are
 * on-demand. Every reference file must be linked from SKILL.md so agents can
 * find it, and every relative link in the skill surface must resolve.
 */
describe("skill progressive disclosure and link integrity", () => {
  it("SKILL.md links every references/*.md file", () => {
    const refFiles = readdirSync(REFS_DIR).filter((n) => n.endsWith(".md"));
    expect(refFiles.length).toBeGreaterThan(0);
    for (const file of refFiles) {
      const linked = skillMd.includes(`references/${file}`) || skillMd.includes(`](${file})`);
      expect({ file, linked }).toEqual({ file, linked: true });
    }
  });

  it("every relative markdown link in SKILL.md + references/ resolves on disk", () => {
    const files = [SKILL_MD, ...markdownFiles(REFS_DIR)];
    const broken: string[] = [];
    for (const file of files) {
      const markdown = readFileSync(file, "utf8");
      for (const target of relativeMarkdownTargets(markdown)) {
        const resolved = join(dirname(file), target);
        if (!existsSync(resolved)) {
          broken.push(`${relative(SKILL_DIR, file)} → ${target}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});

/**
 * Directives beat information (philschmid testing-skills §best practices).
 * The skill must instruct agents to use validate / CLI render, not merely
 * mention that those tools exist.
 */
describe("skill body uses directives for the validation feedback loop", () => {
  it("teaches validate() and the CLI render path as required steps", () => {
    expect(skillMd).toMatch(/validate\(spec\)/);
    expect(skillMd).toMatch(/ggts render/);
    // Section title is imperative in spirit ("use it").
    expect(skillMd).toMatch(/The validation contract \(use it!\)/i);
  });

  it("states the CLI install contract for agent sandboxes", () => {
    expect(skillMd).toMatch(/@ggts-sh\/cli/);
    expect(skillMd).toMatch(/install `@ggts-sh\/cli`|npm i -g @ggts-sh\/cli/);
  });

  it("documents registerAll for headless / spec-driven surfaces", () => {
    expect(skillMd).toMatch(/## Registration \(call these\)/);
    expect(skillMd).toMatch(/registerAll\(\)/);
    expect(skillMd).toMatch(/installTemporal\(\)/);
    expect(skillMd).toContain("references/registration.md");
  });
});

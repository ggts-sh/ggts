/**
 * Contract for npm package front-door READMEs under packages/<name>/README.md.
 *
 * npm shows each package's README on the package page. Relative monorepo links
 * break there; removed grammar props must not reappear as "current" examples;
 * TypeScript fences must actually run against the built packages.
 *
 * Root README showcase stays in scripts/readme-showcase.test.ts.
 */
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { deprecatedGrammarPropPattern } from "../packages/svelte/src/lib/layers/grammar-families.ts";
import { ggplotOpenAttrs, plotLevelInteractionOffenders } from "./ggplot-open-attrs.ts";

const ROOT = join(import.meta.dir, "..");
const PACKAGES = join(ROOT, "packages");

type Fence = {
  readonly language: string;
  readonly source: string;
};

function fences(markdown: string): Fence[] {
  return [...markdown.matchAll(/^```([^\n]*)\n([\s\S]*?)^```/gm)].map((match) => ({
    language: (match[1] ?? "").trim(),
    source: match[2] ?? "",
  }));
}

function packageReadmes(): { readonly name: string; readonly markdown: string }[] {
  return readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const path = join(PACKAGES, entry.name, "README.md");
      return { name: entry.name, markdown: readFileSync(path, "utf8") };
    });
}

/** Monorepo-relative markdown links that work in git but break on npmjs.com. */
function monorepoRelativeLinks(markdown: string): string[] {
  return [...markdown.matchAll(/\[[^\]]*\]\(((\.\.\/)[^)]+)\)/g)].map((m) => m[1]!);
}

describe("package README npm front doors", () => {
  const readmes = packageReadmes();

  it("covers every publishable package", () => {
    expect(readmes.map((r) => r.name).toSorted()).toEqual([
      "cli",
      "compose",
      "core",
      "react",
      "skill",
      "spec",
      "svelte",
    ]);
  });

  for (const { name, markdown } of readmes) {
    it(`${name}: no monorepo-relative links (they 404 on npmjs.com)`, () => {
      expect(monorepoRelativeLinks(markdown)).toEqual([]);
    });

    it(`${name}: no stale "planned removal in 0.13.0" wording`, () => {
      expect(markdown).not.toMatch(/planned removal in 0\.13\.0/i);
      expect(markdown).not.toMatch(/removable in 0\.13\.0/i);
    });
  }

  it("svelte: Svelte fences use child layers, not removed grammar props", () => {
    const svelte = readmes.find((r) => r.name === "svelte")!;
    const pattern = deprecatedGrammarPropPattern();
    const offenders = fences(svelte.markdown)
      .filter((block) => block.language === "svelte")
      .flatMap((block) => [...block.source.matchAll(pattern)].map((m) => m[1]!));
    expect(offenders).toEqual([]);
  });

  it("svelte: Svelte fences avoid plot-level inspect / legendFocus / legendFilter", () => {
    const svelte = readmes.find((r) => r.name === "svelte")!;
    const offenders = fences(svelte.markdown)
      .filter((block) => block.language === "svelte")
      .flatMap((block) =>
        ggplotOpenAttrs(block.source).flatMap((attrs) => plotLevelInteractionOffenders(attrs)),
      );
    expect(offenders).toEqual([]);
  });

  it("svelte: states grammar props were removed (not merely deprecated)", () => {
    const svelte = readmes.find((r) => r.name === "svelte")!;
    expect(svelte.markdown).toMatch(/removed in 0\.13\.0/i);
    // Do not teach the removed props as current dual-read surface.
    expect(svelte.markdown).not.toMatch(
      /grammar props on `<GGPlot>`[^\n]*are deprecated since 0\.11\.0/i,
    );
  });

  it("svelte: points at @ggts-sh/cli with an absolute npm URL", () => {
    const svelte = readmes.find((r) => r.name === "svelte")!;
    expect(svelte.markdown).toContain("https://www.npmjs.com/package/@ggts-sh/cli");
  });
});

describe("package README TypeScript fences run", () => {
  /**
   * Rewrite bare @ggts-sh/* imports to local dist file URLs so the fence
   * executes without a workspace install in /tmp.
   */
  function rewriteImports(source: string): string {
    const dist = {
      "@ggts-sh/spec/schema/v0.json": join(ROOT, "packages/spec/schema/v0.json"),
      "@ggts-sh/spec": join(ROOT, "packages/spec/dist/index.js"),
      "@ggts-sh/core/dom": join(ROOT, "packages/core/dist/dom/index.js"),
      "@ggts-sh/core": join(ROOT, "packages/core/dist/index.js"),
      "@ggts-sh/cli": join(ROOT, "packages/cli/dist/index.js"),
    } as const;
    let out = source;
    // Longer prefixes first so /schema wins over the package root.
    for (const [specifier, filePath] of Object.entries(dist).toSorted(
      (a, b) => b[0].length - a[0].length,
    )) {
      const url = pathToFileURL(filePath).href;
      out = out.replaceAll(`from "${specifier}"`, `from "${url}"`);
      out = out.replaceAll(`from '${specifier}'`, `from '${url}'`);
    }
    return out;
  }

  for (const pkg of ["spec", "core"] as const) {
    it(`${pkg}: every complete TypeScript fence executes`, async () => {
      const markdown = readFileSync(join(PACKAGES, pkg, "README.md"), "utf8");
      const tsBlocks = fences(markdown).filter(
        (block) => block.language === "ts" || block.language === "typescript",
      );
      expect(tsBlocks.length).toBeGreaterThan(0);

      for (const [index, block] of tsBlocks.entries()) {
        const source = rewriteImports(block.source);
        const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
        try {
          await import(dataUrl);
        } catch (error) {
          throw new Error(
            `${pkg} README.ts fence #${index} failed:\n${block.source}\n---\n${String(error)}`,
            { cause: error },
          );
        }
      }
    });
  }
});

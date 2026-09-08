/** Compile the complete examples shipped in the installed skill tarball. */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { codeBlocks } from "./guide-code-contract.js";

/** Fixture-wide dependencies must not hide undeclared imports in a documented recipe. */
export function assertRecipeImports(
  source: string,
  packages: readonly string[],
  label: string,
): void {
  for (const match of source.matchAll(
    /\b(?:from\s+|import\s*\(\s*|import\s*)["'](@ggsvelte\/[^"'/]+)(?:\/[^"']*)?["']/g,
  )) {
    const name = match[1]!;
    if (!packages.includes(name)) {
      throw new Error(`${label} imports ${name}, which its install recipe does not declare`);
    }
  }
}

export function writeInstalledSkillExamples(
  directory: string,
  framework: "react" | "svelte",
): void {
  const skill = join(directory, "node_modules", "@ggsvelte", "skill");
  const files = [
    "SKILL.md",
    ...readdirSync(join(skill, "references"), { recursive: true, encoding: "utf8" })
      .filter((path) => path.endsWith(".md"))
      .map((path) => `references/${path}`),
  ].toSorted();
  const destination =
    framework === "react" ? join(directory, "skill") : join(directory, "src", "lib", "skill");
  mkdirSync(destination, { recursive: true });
  let count = 0;
  for (const file of files) {
    for (const block of codeBlocks(readFileSync(join(skill, file), "utf8"))) {
      if (block.classification !== "complete") continue;
      const extension = block.language === "typescript" ? "ts" : block.language;
      const included =
        framework === "react" ? ["ts", "tsx"].includes(extension) : extension === "svelte";
      if (!included) continue;
      assertRecipeImports(
        block.source,
        framework === "react" ? ["@ggsvelte/react", "@ggsvelte/core"] : ["@ggsvelte/svelte"],
        `installed skill ${file}`,
      );
      writeFileSync(join(destination, `Example${count++}.${extension}`), block.source + "\n");
    }
  }
  if (count === 0) throw new Error(`installed skill has no complete ${framework} examples`);
  console.log(`consumer-compat: checking ${count} installed ${framework} skill examples`);
}

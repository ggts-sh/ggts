/**
 * Spike hosts for three remaining gallery examples: source is a composed
 * React tree, not the generic spec-host stub, and names the same grammar
 * family as the sibling Svelte example.
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const PICKS = ["col/basic", "histogram/basic", "point/scatter-color"] as const;

function grammarNames(source: string): string[] {
  const names = source.matchAll(/\b(GGPlot|Geom\w+|Theme\w+|Scale\w+|Guide\w+|Labs|Inspect)\b/g);
  return [...new Set([...names].map((match) => match[1]!))].toSorted();
}

describe("react host spike (basic remaining examples)", () => {
  for (const id of PICKS) {
    it(`${id} composes the same grammar as Svelte and is not a spec-host stub`, () => {
      const dir = join(ROOT, "examples", id);
      const svelte = readFileSync(join(dir, "Example.svelte"), "utf8");
      const react = readFileSync(join(dir, "Example.tsx"), "utf8");
      expect(existsSync(join(dir, "spec.ts"))).toBe(true);
      expect(react).not.toMatch(/registerAll\s*\(/);
      expect(react).not.toMatch(/normalize\s*\(/);
      expect(react).not.toMatch(/chart\.json/);
      expect(react).toContain('from "@ggts-sh/react"');
      expect(grammarNames(react)).toEqual(grammarNames(svelte));
    });
  }
});

/**
 * Guard 1 — fence contract: every code fence carries exactly one of
 * `complete`/`fragment`, and every `json complete` fence must normalize and
 * validate the way examples do (examples/define.ts).
 *
 * Guard 2 — deprecated grammar props: no Svelte fence (complete or fragment)
 * shows the seven props deprecated in 0.11.0. Same textual match as
 * repo-child-layers.test.ts uses for guide fences.
 */
import { describe, expect, it } from "bun:test";

import { normalize, validate } from "@ggts-sh/spec";
import type { SpecInput } from "@ggts-sh/spec";
import { deprecatedGrammarPropPattern } from "../../packages/svelte/src/lib/layers/grammar-families.ts";
import { codeBlocks } from "../guide-code-contract.ts";
import { FILES } from "./test-helpers.ts";

describe("skill fence contract", () => {
  it("finds skill markdown to check", () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it("checks only the skill surface (SKILL.md + references/), not package-root docs", () => {
    // A changesets-generated CHANGELOG.md or the npm README carrying an
    // unflagged fence must never fail this suite (Devin P1 on #1425).
    const names = FILES.map((f) => f.name);
    expect(names).toContain("SKILL.md");
    for (const name of names) {
      expect(name === "SKILL.md" || name.startsWith("references/")).toBe(true);
    }
  });

  for (const file of FILES) {
    it(`${file.name}: every fence is flagged complete or fragment`, () => {
      const unflagged = codeBlocks(file.markdown)
        .filter((block) => block.classification === undefined)
        .map((block) => block.language || "(none)");
      expect(unflagged).toEqual([]);
    });

    it(`${file.name}: every complete JSON fence normalizes and validates`, () => {
      for (const block of codeBlocks(file.markdown)) {
        if (block.language !== "json" || block.classification !== "complete") continue;
        const spec = normalize(JSON.parse(block.source) as SpecInput);
        // Tier 2 ({}): skill specs carry inline data, so data-aware checks
        // run too — the same bar examples/define.ts sets.
        const result = validate(spec, {});
        expect({ snippet: block.source, errors: result.ok ? [] : result.errors }).toEqual({
          snippet: block.source,
          errors: [],
        });
      }
    });
  }
});

describe("skill Svelte fences use child layers, not deprecated grammar props", () => {
  const pattern = deprecatedGrammarPropPattern();

  for (const file of FILES) {
    it(`${file.name} shows no deprecated grammar prop`, () => {
      const offenders = codeBlocks(file.markdown)
        .filter((block) => block.language === "svelte")
        .flatMap((block) => [...block.source.matchAll(pattern)].map((m) => m[1]!));
      expect(offenders).toEqual([]);
    });
  }
});

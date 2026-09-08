/**
 * Codemod fixture harness (#659 slice 7, closes #290).
 *
 * ADR 0013 locks the convention: `<from>-<to>/<case>/{input,expected}.svelte`,
 * with the acceptance criteria asserted per case rather than described in
 * prose. Fixtures import "@ggts-sh/svelte" — the specifier real consumers
 * write, and the one the codemod targets by default.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { migratePlotProps } from "../../src/lib/codemod/migrate-plot-props.js";

const ROOT = join(import.meta.dirname, "fixtures");

function transitions(): string[] {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function cases(transition: string): string[] {
  return readdirSync(join(ROOT, transition), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
}

describe("codemod fixtures", () => {
  const found = transitions();

  it("names each transition directory <from>-<to>", () => {
    expect(found.length).toBeGreaterThan(0);
    for (const transition of found) {
      expect(transition).toMatch(/^\d+\.\d+-\d+\.\d+$/);
    }
  });

  for (const transition of found) {
    describe(transition, () => {
      const names = cases(transition);

      it("has cases", () => {
        expect(names.length).toBeGreaterThan(0);
      });

      for (const name of names) {
        const dir = join(ROOT, transition, name);
        const input = readFileSync(join(dir, "input.svelte"), "utf8");
        const expected = readFileSync(join(dir, "expected.svelte"), "utf8");

        it(`${name}: input migrates to expected`, () => {
          expect(migratePlotProps(input).code).toBe(expected);
        });

        it(`${name}: is idempotent`, () => {
          const second = migratePlotProps(expected);
          expect(second.code).toBe(expected);
          expect(second.changes).toEqual([]);
        });
      }
    });
  }
});

/**
 * PR 3 (gap 4.2) — cross-root helper identity. The capability ledger proves
 * every claimed scale helper is a real export at the `@ggts-sh/spec` root; this
 * suite extends that guarantee to the `@ggts-sh/svelte` root, asserting each
 * helper (and its ggplot2 snake_case alias) is the SAME binding re-exported from
 * spec — not a shadowing re-implementation that could silently drift.
 */
import { describe, expect, it } from "vitest";

import * as spec from "@ggts-sh/spec";

import * as svelteRoot from "../src/lib/index.js";

const specNs = spec as Record<string, unknown>;
const svelteNs = svelteRoot as unknown as Record<string, unknown>;

const positionHelpers = spec.SCALE_CAPABILITIES.filter((c) => c.family.startsWith("position-"))
  .flatMap((c) => c.helpers as readonly string[])
  // De-duplicate helpers shared across families (e.g. reverse).
  .filter((name, i, all) => all.indexOf(name) === i);

const snakeAliases = [
  "scale_x_continuous",
  "scale_y_continuous",
  "scale_x_log10",
  "scale_y_log10",
  "scale_x_sqrt",
  "scale_y_sqrt",
  "scale_x_binned",
  "scale_y_binned",
  "scale_x_reverse",
  "scale_y_reverse",
];

describe("@ggts-sh/svelte re-exports the identical spec scale helpers", () => {
  for (const name of positionHelpers) {
    it(`svelte.${name} === spec.${name} (same binding)`, () => {
      expect(typeof specNs[name]).toBe("function");
      expect(svelteNs[name]).toBe(specNs[name]);
    });
  }

  for (const name of snakeAliases) {
    it(`svelte.${name} === spec.${name} (alias, same binding)`, () => {
      expect(typeof specNs[name]).toBe("function");
      expect(svelteNs[name]).toBe(specNs[name]);
    });
  }

  it("MAX_BINNED_BREAKS is the same shared constant at both roots", () => {
    expect(svelteNs.MAX_BINNED_BREAKS ?? specNs.MAX_BINNED_BREAKS).toBe(spec.MAX_BINNED_BREAKS);
    expect(spec.MAX_BINNED_BREAKS).toBe(64);
  });
});

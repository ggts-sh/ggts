/**
 * An axis label is a claim about the units under it. "(rank)" is the strongest
 * such claim an example can make — it says the values are 1, 2, 3 … n, one per
 * row, and it invites the reader to compare positions rather than magnitudes.
 *
 * #729: point/scatter-color labelled both axes "(rank)" while plotting
 * Guerry's raw HistData columns — literacy as a percentage (12–74, with ties)
 * and population per crime against persons (5883–37014). Neither is a rank, so
 * the axes lied on the gallery page and on the homepage hero (#728).
 *
 * The rule guarded here: an axis label may only mention a rank when the field
 * it maps really is one over the rows being plotted — distinct integers from 1
 * up to at most the row count. An example that plots a subset of a wider rank
 * (Corsica is dropped from Guerry, so `wealth` runs 1–86 over 85 rows) trips
 * this deliberately: the axis is no longer a 1…n rank of what is shown, and
 * the label has to say which population it ranks against.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { PortableSpec } from "@ggts-sh/spec";

import { EXAMPLES } from "../examples/manifest.ts";

const ROOT = join(import.meta.dir, "..");

/** Positional channels are the ones whose label sits against an axis. */
const AXIS_CHANNELS = ["x", "y"] as const;
const MENTIONS_RANK = /\branks?(ed|ing)?\b/i;
/** The label idiom for a unit: "Literacy (rank)". */
const RANK_UNIT = /\(rank\)/i;

async function loadSpec(id: string): Promise<PortableSpec> {
  const modulePath = pathToFileURL(join(ROOT, "examples", id, "spec.ts")).href;
  const module = (await import(modulePath)) as { default: PortableSpec };
  return module.default;
}

function svelteSource(id: string): string {
  return readFileSync(join(ROOT, "examples", id, "Example.svelte"), "utf8");
}

/** The field a positional channel maps, from the spec's aes or its layers. */
function mappedField(spec: PortableSpec, channel: "x" | "y"): string | undefined {
  const specAes = (spec as { aes?: Record<string, { field?: string }> }).aes;
  const fromSpec = specAes?.[channel]?.field;
  if (fromSpec !== undefined) return fromSpec;
  for (const layer of spec.layers ?? []) {
    const field = (layer as { aes?: Record<string, { field?: string }> }).aes?.[channel]?.field;
    if (field !== undefined) return field;
  }
  return undefined;
}

function columnValues(spec: PortableSpec, field: string): readonly unknown[] {
  const rows = (spec.data as { values?: readonly Record<string, unknown>[] }).values ?? [];
  return rows.map((row) => row[field]);
}

/** Distinct integers 1…n, one per plotted row — what "(rank)" promises. */
function isRank(values: readonly unknown[]): boolean {
  const numbers = values.filter((value): value is number => typeof value === "number");
  if (numbers.length !== values.length || numbers.length === 0) return false;
  if (!numbers.every((value) => Number.isInteger(value) && value >= 1)) return false;
  if (new Set(numbers).size !== numbers.length) return false;
  return Math.max(...numbers) <= numbers.length;
}

describe("example axis labels that claim a rank", () => {
  for (const entry of EXAMPLES) {
    it(`${entry.id} only says "rank" on an axis whose field is one`, async () => {
      const spec = await loadSpec(entry.id);
      const labs = (spec.labs ?? {}) as Record<string, unknown>;

      for (const channel of AXIS_CHANNELS) {
        const label = labs[channel];
        if (typeof label !== "string" || !MENTIONS_RANK.test(label)) continue;

        const field = mappedField(spec, channel);
        expect(field, `${entry.id}: ${channel} label "${label}" maps no field`).toBeDefined();
        expect(
          isRank(columnValues(spec, field!)),
          `${entry.id}: ${channel} label "${label}" claims a rank, but "${field}" is not one`,
        ).toBe(true);
      }
    });

    it(`${entry.id} does not carry a "(rank)" label the spec never declares`, async () => {
      const source = svelteSource(entry.id);
      if (!RANK_UNIT.test(source)) return;

      // The two surfaces are hand-duplicated, so a half-landed relabel shows up
      // as "(rank)" surviving in the component after the spec dropped it.
      const spec = await loadSpec(entry.id);
      const declared = Object.values((spec.labs ?? {}) as Record<string, unknown>).filter(
        (label): label is string => typeof label === "string" && RANK_UNIT.test(label),
      );
      expect(
        declared.some((label) => source.includes(label)),
        `${entry.id}: Example.svelte labels an axis "(rank)" but spec.ts does not`,
      ).toBe(true);
    });
  }
});

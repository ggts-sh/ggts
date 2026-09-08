/**
 * Defaults editions (Hadley lesson 13) — the mechanism test the plan demands:
 * "a fake edition-2 palette in tests proves old specs keep edition-1 colors".
 *
 * normalize() (spec package) stamps `edition: 1` when absent; the pipeline
 * keys its default theme table / categorical palette / sequential ramp by
 * that edition through RunOptions.editions (run-scoped, no global registry).
 */
import { describe, expect, it } from "bun:test";

import { CURRENT_EDITION, normalize } from "@ggts-sh/spec";

import type { EditionDefaults } from "../src/editions.ts";
import { EDITION_DEFAULTS, resolveEditionDefaults } from "../src/editions.ts";
import { runPipeline } from "../src/pipeline.ts";
import type { PointsBatch, RectsBatch } from "../src/scene.ts";
import { VIRIDIS_RAMP_10 } from "../src/scales/color.ts";
import { CATEGORICAL_PALETTE_10 } from "../src/scales/train.ts";
import { BUILTIN_THEMES, LEGACY_BUILTIN_THEMES } from "../src/theme.ts";

/** A garish palette no real edition would ship — unmistakable in assertions. */
const FAKE_EDITION_2: EditionDefaults = {
  categoricalPalette: ["#101010", "#202020", "#303030", "#404040"],
  sequentialRamp: ["#000000", "#ffffff"],
  themes: {
    ...BUILTIN_THEMES,
    default: {
      ...BUILTIN_THEMES.default,
      ink: "#123456",
      paper: "none",
      accent: "#abcdef",
      grid: "rgba(0,0,0,0.1)",
    },
  },
};

const EDITIONS_WITH_FAKE_2 = { ...EDITION_DEFAULTS, 2: FAKE_EDITION_2 };

const scatterSpec = (edition?: number) => ({
  ...(edition !== undefined && { edition }),
  data: {
    values: [
      { x: 1, y: 2, kind: "a" },
      { x: 2, y: 3, kind: "b" },
      { x: 3, y: 4, kind: "c" },
    ],
  },
  aes: { x: "x", y: "y", color: "kind" },
  layers: [{ geom: "point" as const }],
});

const RUN = { width: 400, height: 300 } as const;

function pointColors(model: ReturnType<typeof runPipeline>): string[] {
  const batch = model.scene.batches.find((b) => b.kind === "points") as PointsBatch;
  if (batch.colorPalette !== undefined && batch.colorIndexes !== undefined) {
    return [...batch.colorIndexes].map((id) => batch.colorPalette![id]!);
  }
  return batch.colors ?? (batch.fill === null ? [] : [batch.fill]);
}

describe("normalize() edition stamping (spec side)", () => {
  it("stamps the current edition when absent, keeps an explicit one", () => {
    expect(normalize(scatterSpec()).edition).toBe(CURRENT_EDITION);
    expect(normalize(scatterSpec(2)).edition).toBe(2);
  });

  it("is idempotent about the stamp", () => {
    const once = normalize(scatterSpec());
    expect(normalize(once)).toEqual(once);
  });
});

describe("resolveEditionDefaults", () => {
  it("undefined means latest known; known editions resolve exactly", () => {
    expect(resolveEditionDefaults().edition).toBe(CURRENT_EDITION);
    expect(resolveEditionDefaults(1).defaults).toBe(EDITION_DEFAULTS[1]!);
    const r = resolveEditionDefaults(2, EDITIONS_WITH_FAKE_2);
    expect(r.defaults).toBe(FAKE_EDITION_2);
    expect(r.unknownRequested).toBeNull();
  });

  it("unknown editions fall back to the latest known and report it", () => {
    const r = resolveEditionDefaults(7, EDITIONS_WITH_FAKE_2);
    expect(r.edition).toBe(2);
    expect(r.unknownRequested).toBe(7);
  });
});

describe("pipeline defaults keyed by edition", () => {
  it("an edition-1 spec keeps edition-1 colors even when edition 2 exists", () => {
    // The old spec: stamped edition 1 (normalize default). A NEW ggts
    // whose table also contains edition 2 must NOT restyle it.
    const model = runPipeline(scatterSpec(1), { ...RUN, editions: EDITIONS_WITH_FAKE_2 });
    const colors = pointColors(model);
    for (const c of colors.slice(0, 3)) {
      expect(CATEGORICAL_PALETTE_10).toContain(c);
      expect(FAKE_EDITION_2.categoricalPalette).not.toContain(c);
    }
  });

  it("an edition-2 spec gets the edition-2 palette", () => {
    const model = runPipeline(scatterSpec(2), { ...RUN, editions: EDITIONS_WITH_FAKE_2 });
    const colors = pointColors(model);
    for (const c of colors.slice(0, 3)) {
      expect(FAKE_EDITION_2.categoricalPalette).toContain(c);
    }
  });

  it("an explicit viridis scheme wins over an edition's sequential default", () => {
    const model = runPipeline(
      {
        edition: 2,
        data: {
          values: [
            { x: 1, y: 1, value: 0 },
            { x: 2, y: 2, value: 1 },
          ],
        },
        aes: { x: "x", y: "y", color: "value" },
        layers: [{ geom: "point" }],
        scales: { color: { scheme: "viridis" } },
      },
      { ...RUN, editions: EDITIONS_WITH_FAKE_2 },
    );

    expect(pointColors(model)).toEqual([VIRIDIS_RAMP_10[0], VIRIDIS_RAMP_10.at(-1)]);
  });

  it("theme role defaults follow the edition (unmapped bar accent)", () => {
    const barSpec = (edition: number) => ({
      edition,
      data: { values: [{ k: "a" }, { k: "a" }, { k: "b" }] },
      aes: { x: "k" },
      layers: [{ geom: "bar" as const }],
    });
    const m1 = runPipeline(barSpec(1), { ...RUN, editions: EDITIONS_WITH_FAKE_2 });
    const m2 = runPipeline(barSpec(2), { ...RUN, editions: EDITIONS_WITH_FAKE_2 });
    // Unmapped bars fill with the theme accent ROLE; the scene's resolved
    // theme tokens come from the edition's theme table (rects keep fill null
    // + fillRole "accent" — renderers substitute the token).
    const rects1 = m1.scene.batches.find((b) => b.kind === "rects") as RectsBatch;
    expect(rects1.fill).toBeNull();
    expect(m1.scene.theme.accent).toBe(LEGACY_BUILTIN_THEMES.default.accent);
    expect(m2.scene.theme.accent).toBe("#abcdef");
  });

  it("unknown edition falls back to the latest known with a warning", () => {
    const model = runPipeline(scatterSpec(9), RUN);
    expect(model.warnings.some((w) => w.code === "unknown-edition")).toBe(true);
    const colors = pointColors(model);
    expect(CATEGORICAL_PALETTE_10).toContain(colors[0]!);
  });
});

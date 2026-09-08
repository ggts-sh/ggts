/**
 * Crameri categorical *S resolution — fixtures pin the official 10-class
 * prefixes from Scientific Colour Maps v8.0.1.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import {
  CRAMERI_CATEGORICAL_SCHEME_NAMES,
  crameriCategoricalStops,
} from "../src/scales/crameri-categorical.ts";
import { crameriRampStops } from "../src/scales/crameri-ramps.ts";
import { resolveOrdinalPaletteStops } from "../src/scales/engine.ts";

const BATLOW_S: readonly string[] = [
  "#011959",
  "#faccfa",
  "#828231",
  "#226061",
  "#f19d6b",
  "#4d734d",
  "#114360",
  "#fdb4b4",
  "#c09036",
  "#175262",
];

describe("Crameri categorical *S palettes", () => {
  it("resolves every official *S name to a 10-colour table", () => {
    expect(CRAMERI_CATEGORICAL_SCHEME_NAMES).toHaveLength(21);
    for (const name of CRAMERI_CATEGORICAL_SCHEME_NAMES) {
      const stops = crameriCategoricalStops(name);
      expect(stops).toEqual(resolveOrdinalPaletteStops({ scheme: name }));
      expect(stops).toHaveLength(10);
      expect(stops.every((stop) => /^#[0-9a-f]{6}$/.test(stop))).toBe(true);
      expect(crameriRampStops(name)).toBeUndefined();
    }
  });

  it("pins the batlowS 10-class prefix", () => {
    expect(resolveOrdinalPaletteStops({ scheme: "batlowS" })).toEqual(BATLOW_S);
  });

  it("paints the first trained category with the first official stop", () => {
    const spec = gg(
      [
        { x: 1, y: 1, group: "a" },
        { x: 2, y: 2, group: "b" },
      ],
      aes({ x: "x", y: "y", color: "group" }),
    )
      .geomPoint()
      .scales({ color: { type: "ordinal", scheme: "batlowS" } })
      .spec();
    const model = runPipeline(spec, { width: 640, height: 400 });
    const scale = model.scales.color;
    if (scale?.kind !== "ordinal") throw new Error("expected ordinal color");
    expect(scale.scale.colorOf("a")).toBe(BATLOW_S[0]);
    expect(scale.scale.colorOf("b")).toBe(BATLOW_S[1]);
  });
});

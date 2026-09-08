/**
 * #785: GRAMMAR_FAMILIES is the single metadata home for grammar families.
 * Cross-checks against known constants and partitions — not self-tautologies.
 *
 * Browser lane: CI coverage is browser-only (SSR vitest does not collect).
 */
import { describe, expect, it } from "vitest";

import {
  GGPLOT_PROP_ORDER,
  GRAMMAR_DOC_URLS,
  GRAMMAR_FAMILIES,
  GRAMMAR_PROP_NAMES,
  MERGE_KEY_EMIT_ORDER,
  REPLACE_EMIT_ORDER,
  deprecatedGrammarPropPattern,
  grammarCodemodRules,
  grammarDocUrl,
} from "../../src/lib/layers/grammar-families.js";
import type { GrammarLayerKind, Layer } from "../../src/lib/layers/types.js";

const ALL_KINDS = Object.keys(GRAMMAR_FAMILIES) as GrammarLayerKind[];

/** Expected prop set (pre-#785 RULES keys / plot-props grammar props). */
const EXPECTED_PROPS = ["facet", "coord", "scales", "guides", "legend", "theme", "labs"] as const;

describe("GRAMMAR_FAMILIES completeness", () => {
  it("covers exactly the seven non-mark layer kinds", () => {
    expect(new Set(ALL_KINDS)).toEqual(
      new Set(["scale", "theme", "coord", "facet", "labs", "guides", "legend"]),
    );
    // Kind key equals row.kind for every entry.
    for (const kind of ALL_KINDS) {
      expect(GRAMMAR_FAMILIES[kind].kind).toBe(kind);
    }
  });

  it("GrammarLayerKind is Exclude<Layer['kind'], 'mark'> (type + runtime)", () => {
    type Expected = Exclude<Layer["kind"], "mark">;
    // Compile-time assignability: ALL_KINDS must be assignable to Expected[].
    const kinds: Expected[] = ALL_KINDS;
    expect(kinds.includes("mark" as GrammarLayerKind)).toBe(false);
  });

  it("propNames match the seven deprecated GGPlot props (scale → scales)", () => {
    expect(new Set(GRAMMAR_PROP_NAMES)).toEqual(new Set(EXPECTED_PROPS));
    expect(GRAMMAR_FAMILIES.scale.propName).toBe("scales");
  });

  it("composition partition matches pre-#785 MERGE/REPLACE taxonomy", () => {
    expect(GRAMMAR_FAMILIES.scale.composition).toBe("merge-by-channel");
    for (const kind of MERGE_KEY_EMIT_ORDER) {
      expect(GRAMMAR_FAMILIES[kind].composition).toBe("merge-by-key");
      expect(GRAMMAR_FAMILIES[kind].mergeKeyNoun).toBeTruthy();
      expect(GRAMMAR_FAMILIES[kind].mergeKeyChild).toBeTruthy();
    }
    for (const kind of REPLACE_EMIT_ORDER) {
      expect(GRAMMAR_FAMILIES[kind].composition).toBe("replace");
    }
  });

  it("order constants are complete permutations / composition subsets", () => {
    expect(new Set(GGPLOT_PROP_ORDER)).toEqual(new Set(ALL_KINDS));
    // GGPlotProps / codemod declaration order.
    expect([...GGPLOT_PROP_ORDER]).toEqual([
      "facet",
      "coord",
      "scale",
      "guides",
      "legend",
      "theme",
      "labs",
    ]);
    expect([...MERGE_KEY_EMIT_ORDER]).toEqual(["labs", "guides", "legend"]);
    expect([...REPLACE_EMIT_ORDER]).toEqual(["coord", "facet", "theme"]);
  });

  it("docUrls match the pre-#785 runtime advisory catalog list", () => {
    const expected = [
      "https://ggts.sh/guide/upgrading#compose-scales-as-child-layers",
      "https://ggts.sh/guide/upgrading#compose-the-theme-as-a-child-layer",
      "https://ggts.sh/guide/upgrading#compose-coord-as-a-child-layer",
      "https://ggts.sh/guide/upgrading#compose-facet-as-a-child-layer",
      "https://ggts.sh/guide/upgrading#compose-labs-as-a-child-layer",
      "https://ggts.sh/guide/upgrading#compose-guides-as-child-layers",
      "https://ggts.sh/guide/upgrading#compose-legend-as-a-child-layer",
    ];
    expect(new Set(GRAMMAR_DOC_URLS)).toEqual(new Set(expected));
    expect(grammarDocUrl("theme")).toBe(
      "https://ggts.sh/guide/upgrading#compose-the-theme-as-a-child-layer",
    );
  });

  it("codemod rules preserve GGPlotProps order and pre-#785 forms", () => {
    const rules = grammarCodemodRules();
    expect(Object.keys(rules)).toEqual([...EXPECTED_PROPS]);
    expect(rules.coord).toEqual({
      component: "Coord",
      form: "value",
      docUrl: "https://ggts.sh/guide/upgrading#compose-coord-as-a-child-layer",
    });
    expect(rules.theme?.form).toBe("theme");
    expect(rules.facet?.form).toBe("spread");
    expect(rules.labs?.form).toBe("spread");
    expect(rules.scales?.form).toBe("value");
  });
});

describe("deprecatedGrammarPropPattern", () => {
  it("matches the seven props the way repo-child-layers did", () => {
    const re = deprecatedGrammarPropPattern();
    const source = `<GGPlot\n  facet={{wrap:"g"}}\n  theme="dark"\n  scales={{}}\n/>`;
    const hits = [...source.matchAll(re)].map((m) => m[1]);
    expect(hits).toEqual(["facet", "theme", "scales"]);
    // Child components must not trip it.
    expect(`<Theme name="dark" />`.match(re)).toBeNull();
  });
});

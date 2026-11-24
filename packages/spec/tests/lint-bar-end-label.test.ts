import { describe, expect, it } from "bun:test";

import { LINT_CATALOG, lintSpec, type SpecAdvisory } from "../src/lint.ts";
import { normalize } from "../src/normalize.ts";
import { validate } from "../src/validate.ts";

const CODE = "bar-end-label-offset";
const codesOf = (advisories: readonly SpecAdvisory[]) => advisories.map((a) => a.code);
const matching = (advisories: readonly SpecAdvisory[]) => advisories.filter((a) => a.code === CODE);

const issue1966Repro = {
  width: 960,
  height: 480,
  layers: [
    { geom: "col", aes: { x: { field: "pathway" }, y: { field: "n" } } },
    {
      geom: "text",
      aes: { x: { field: "pathway" }, y: { field: "n" }, label: { field: "n" } },
      params: { anchor: "start", dx: 6, size: 11 },
    },
  ],
  scales: { x: { type: "band" }, y: { type: "linear" } },
  labs: { title: "Decisiones por vía", x: "Vía", y: "Normas" },
  data: { columns: { pathway: ["A4", "B2", "C1"], n: [42, 17, 5] } },
};

describe("bar-end-label-offset", () => {
  it("registers catalog entry with needs: 'spec' and the issue rationale", () => {
    const entry = LINT_CATALOG[CODE];
    expect(entry.needs).toBe("spec");
    expect(entry.rationale).toContain("A value label on a bar is read as belonging to the bar.");
  });

  it("emits on the Issue #1966 repro via lintSpec and validate({ lint: true })", () => {
    const advisories = matching(lintSpec(issue1966Repro));
    expect(advisories).toHaveLength(1);
    expect(advisories[0]!.path).toBe("/layers/1/params/anchor");
    expect(advisories[0]!.message).toContain("col layer 0");
    expect(advisories[0]!.message).toContain('anchor "start"');
    expect(advisories[0]!.message).toContain("dx: 6");
    expect(advisories[0]!.suggestion?.example).toEqual({ params: { anchor: "middle" } });
    expect(advisories[0]!.suggestion?.description).toContain("params.dy");
    expect(advisories[0]!.suggestion?.description).toContain("stacked segment");
    expect(advisories[0]!.suggestion?.description).not.toMatch(/params\.offset|\boffset\s*:/i);

    const validated = validate(issue1966Repro, { lint: true });
    expect(validated.ok).toBe(true);
    expect(codesOf(validated.advisories ?? [])).toContain(CODE);
  });

  it("emits without data, profile, scales, or labs (needs: 'spec') and with runtime-only data", () => {
    const noData = {
      layers: [
        { geom: "col", aes: { x: { field: "pathway" }, y: { field: "n" } } },
        {
          geom: "text",
          aes: { x: { field: "pathway" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    const advisories = matching(lintSpec(noData));
    expect(advisories).toHaveLength(1);
    expect(advisories[0]!.path).toBe("/layers/1/params/anchor");
    expect(advisories[0]!.message).not.toContain("with dx:");

    const runtimeData = { ...noData, data: { name: "runtime_ds" } };
    expect(codesOf(lintSpec(runtimeData))).toContain(CODE);
  });

  it("still emits when inline data exceeds maxRows or maxBytes limits", () => {
    expect(codesOf(lintSpec(issue1966Repro, { limits: { maxRows: 1 } }))).toContain(CODE);
    expect(codesOf(lintSpec(issue1966Repro, { limits: { maxBytes: 10 } }))).toContain(CODE);
  });

  it("emits for geom 'label' with params.anchor 'end'", () => {
    const spec = {
      data: { columns: { cat: ["a", "b"], val: [10, 20] } },
      layers: [
        { geom: "col", aes: { x: { field: "cat" }, y: { field: "val" } } },
        {
          geom: "label",
          aes: { x: { field: "cat" }, y: { field: "val" }, label: { field: "val" } },
          params: { anchor: "end" },
        },
      ],
    };
    const advisories = matching(lintSpec(spec));
    expect(advisories).toHaveLength(1);
    expect(advisories[0]!.path).toBe("/layers/1/params/anchor");
    expect(advisories[0]!.message).toContain("This label layer");
    expect(advisories[0]!.message).toContain('anchor "end"');
  });

  it("detects bar with count stat in both raw and normalized specs", () => {
    const raw = {
      data: { columns: { cat: ["a", "a", "b"], n: [2, 2, 1] } },
      layers: [
        { geom: "bar", aes: { x: { field: "cat" } } },
        {
          geom: "text",
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    const rawHits = matching(lintSpec(raw));
    expect(rawHits).toHaveLength(1);
    expect(rawHits[0]!.message).toContain("over bar layer 0");

    const normalized = normalize({
      ...raw,
      data: { columns: { cat: ["a", "a", "b"] } },
      layers: [
        { geom: "bar", aes: { x: { field: "cat" } } },
        {
          geom: "text",
          aes: { x: { field: "cat" }, y: { stat: "count" }, label: { stat: "count" } },
          params: { anchor: "end" },
        },
      ],
    });
    expect(codesOf(lintSpec(normalized))).toContain(CODE);
  });

  it("stays silent for bar count stat when text uses a constant y value (e.g., baseline)", () => {
    const spec = {
      layers: [
        { geom: "bar", aes: { x: { field: "cat" } } },
        {
          geom: "text",
          aes: { x: { field: "cat" }, y: { value: 0 }, label: { field: "cat" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(spec))).not.toContain(CODE);
  });

  it("resolves plot.aes inheritance and bare-string sugar, and respects layer null unsets", () => {
    const inherited = {
      aes: { x: "pathway", y: "n" },
      layers: [{ geom: "col" }, { geom: "text", aes: { label: "n" }, params: { anchor: "start" } }],
    };
    expect(codesOf(lintSpec(inherited))).toContain(CODE);

    const unsetX = {
      aes: { x: "pathway", y: "n" },
      layers: [
        { geom: "col" },
        { geom: "text", aes: { x: null, label: "n" }, params: { anchor: "start" } },
      ],
    };
    expect(codesOf(lintSpec(unsetX))).not.toContain(CODE);

    const unsetY = {
      aes: { x: "pathway", y: "n" },
      layers: [
        { geom: "col" },
        { geom: "text", aes: { y: null, label: "n" }, params: { anchor: "start" } },
      ],
    };
    expect(codesOf(lintSpec(unsetY))).not.toContain(CODE);
  });

  it("emits on horizontal bars via coord: { type: 'flip' }", () => {
    const flipped = {
      ...issue1966Repro,
      coord: { type: "flip" },
    };
    expect(codesOf(lintSpec(flipped))).toContain(CODE);
  });

  it("handles facet specs with no data, overlapping panels, disjoint panels, levels, and broadcast", () => {
    // 1. Facet without data (needs: "spec" -> assumes shared panel)
    const facetNoData = {
      facet: { wrap: { field: "panel" } },
      layers: [
        { geom: "col", aes: { x: { field: "cat" }, y: { field: "n" } } },
        {
          geom: "text",
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(facetNoData))).toContain(CODE);

    // 2. Shared inline facet panel
    const sharedPanel = {
      facet: { wrap: { field: "panel" } },
      layers: [
        {
          geom: "col",
          data: { columns: { cat: ["a"], n: [10], panel: ["p1"] } },
          aes: { x: { field: "cat" }, y: { field: "n" } },
        },
        {
          geom: "text",
          data: { columns: { cat: ["a"], n: [10], panel: ["p1"] } },
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(sharedPanel))).toContain(CODE);

    // 3. Disjoint inline facet panels -> silent
    const disjointPanel = {
      facet: { wrap: { field: "panel" } },
      layers: [
        {
          geom: "col",
          data: { columns: { cat: ["a"], n: [10], panel: ["p1"] } },
          aes: { x: { field: "cat" }, y: { field: "n" } },
        },
        {
          geom: "text",
          data: { columns: { cat: ["a"], n: [10], panel: ["p2"] } },
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(disjointPanel))).not.toContain(CODE);

    // 4. 2D grid (rows + cols) where marginal values overlap but (row, col) tuples are disjoint -> silent
    const disjointGridTuples = {
      facet: { rows: { field: "r" }, cols: { field: "c" } },
      layers: [
        {
          geom: "col",
          data: { columns: { cat: ["a", "b"], n: [10, 20], r: ["r1", "r2"], c: ["c1", "c2"] } },
          aes: { x: { field: "cat" }, y: { field: "n" } },
        },
        {
          geom: "text",
          data: { columns: { cat: ["a", "b"], n: [10, 20], r: ["r1", "r2"], c: ["c2", "c1"] } },
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "end" },
        },
      ],
    };
    expect(codesOf(lintSpec(disjointGridTuples))).not.toContain(CODE);

    // 5. Facet levels filter excludes bar's panel -> silent
    const filteredLevels = {
      facet: { wrap: { field: "panel", levels: ["p2"] } },
      layers: [
        {
          geom: "col",
          data: { columns: { cat: ["a"], n: [10], panel: ["p1"] } },
          aes: { x: { field: "cat" }, y: { field: "n" } },
        },
        {
          geom: "text",
          data: { columns: { cat: ["a"], n: [10], panel: ["p2"] } },
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(filteredLevels))).not.toContain(CODE);

    // 6. Layer missing facet field broadcasts to all panels -> emits
    const broadcastLayer = {
      facet: { wrap: { field: "panel" } },
      layers: [
        {
          geom: "col",
          data: { columns: { cat: ["a"], n: [10], panel: ["p1"] } },
          aes: { x: { field: "cat" }, y: { field: "n" } },
        },
        {
          geom: "text",
          data: { columns: { cat: ["a"], n: [10] } },
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(broadcastLayer))).toContain(CODE);
  });

  it("matches regardless of layer order and deduplicates across multiple bars", () => {
    const reversed = {
      layers: [
        {
          geom: "text",
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
        { geom: "col", aes: { x: { field: "cat" }, y: { field: "n" } } },
      ],
    };
    const revHits = matching(lintSpec(reversed));
    expect(revHits).toHaveLength(1);
    expect(revHits[0]!.path).toBe("/layers/0/params/anchor");
    expect(revHits[0]!.message).toContain("over col layer 1");

    const multiBar = {
      layers: [
        { geom: "col", aes: { x: { field: "cat" }, y: { field: "n" } } },
        { geom: "col", aes: { x: { field: "cat" }, y: { field: "n" } } },
        {
          geom: "text",
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "end" },
        },
      ],
    };
    const multiBarHits = matching(lintSpec(multiBar));
    expect(multiBarHits).toHaveLength(1);
    expect(multiBarHits[0]!.path).toBe("/layers/2/params/anchor");

    const multiText = {
      layers: [
        { geom: "col", aes: { x: { field: "cat" }, y: { field: "n" } } },
        {
          geom: "text",
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
        {
          geom: "label",
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "end" },
        },
      ],
    };
    expect(matching(lintSpec(multiText)).map((a) => a.path)).toEqual([
      "/layers/1/params/anchor",
      "/layers/2/params/anchor",
    ]);
  });

  it("stays silent for anchor 'middle', omitted anchor, or omitted params", () => {
    const withAnchor = (params?: Record<string, unknown>) => ({
      layers: [
        { geom: "col", aes: { x: { field: "cat" }, y: { field: "n" } } },
        {
          geom: "text",
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          ...(params !== undefined && { params }),
        },
      ],
    });
    expect(codesOf(lintSpec(withAnchor({ anchor: "middle" })))).not.toContain(CODE);
    expect(codesOf(lintSpec(withAnchor({ dx: 6 })))).not.toContain(CODE);
    expect(codesOf(lintSpec(withAnchor()))).not.toContain(CODE);
  });

  it("stays silent for point, line, histogram, and bar with stat 'bin' (raw and normalized)", () => {
    for (const geom of ["point", "line", "histogram"]) {
      const spec = {
        layers: [
          { geom, aes: { x: { field: "x" }, ...(geom !== "histogram" && { y: { field: "y" } }) } },
          {
            geom: "text",
            aes: { x: { field: "x" }, y: { field: "y" }, label: { field: "y" } },
            params: { anchor: "start" },
          },
        ],
      };
      expect(codesOf(lintSpec(spec))).not.toContain(CODE);
    }

    const barBin = {
      layers: [
        { geom: "bar", stat: "bin", aes: { x: { field: "x" } } },
        {
          geom: "text",
          aes: { x: { field: "x" }, y: { field: "count" }, label: { field: "count" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(barBin))).not.toContain(CODE);

    const normalizedHistogram = normalize({
      data: { columns: { x: [1, 2, 3, 4], y: [1, 1, 1, 1] } },
      layers: [
        { geom: "histogram", aes: { x: { field: "x" } } },
        {
          geom: "text",
          aes: { x: { field: "x" }, y: { field: "y" }, label: { field: "y" } },
          params: { anchor: "start" },
        },
      ],
    });
    expect(codesOf(lintSpec(normalizedHistogram))).not.toContain(CODE);
  });

  it("stays silent when x fields differ or col y fields differ", () => {
    const diffX = {
      layers: [
        { geom: "col", aes: { x: { field: "a" }, y: { field: "n" } } },
        {
          geom: "text",
          aes: { x: { field: "b" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(diffX))).not.toContain(CODE);

    const diffColY = {
      layers: [
        { geom: "col", aes: { x: { field: "a" }, y: { field: "n" } } },
        {
          geom: "text",
          aes: { x: { field: "a" }, y: { field: "mid" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(diffColY))).not.toContain(CODE);

    const constantColY = {
      layers: [
        { geom: "col", aes: { x: { field: "a" }, y: { field: "n" } } },
        {
          geom: "text",
          aes: { x: { field: "a" }, y: { value: 0 }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(constantColY))).not.toContain(CODE);

    const diffExplicitBarY = {
      layers: [
        { geom: "bar", aes: { x: { field: "a" }, y: { field: "n" } } },
        {
          geom: "text",
          aes: { x: { field: "a" }, y: { field: "other" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(diffExplicitBarY))).not.toContain(CODE);
  });

  it("handles malformed runtime inputs without throwing", () => {
    for (const malformed of [
      null,
      {},
      { layers: null },
      { layers: [null, "bad", { geom: "col", aes: { x: 123, y: 456 } }] },
      {
        aes: "bad",
        facet: { wrap: 123 },
        layers: [
          { geom: "col", aes: { x: 123, y: "n" } },
          { geom: "text", aes: { x: "a", y: 456 }, params: "bad" },
          { geom: "text", aes: { x: { field: "a" } }, params: { anchor: "start", dx: Number.NaN } },
        ],
      },
    ]) {
      expect(() => lintSpec(malformed)).not.toThrow();
      expect(codesOf(lintSpec(malformed))).not.toContain(CODE);
    }
  });

  it("emits before scale advisories in lintSpec ordering", () => {
    const spec = {
      data: { columns: { cat: ["a", "b"], n: [10, -1] } },
      scales: { y: { type: "log" } },
      layers: [
        { geom: "col", aes: { x: { field: "cat" }, y: { field: "n" } } },
        {
          geom: "text",
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    const codes = codesOf(lintSpec(spec));
    expect(codes.indexOf(CODE)).toBeGreaterThanOrEqual(0);
    expect(codes.indexOf("transform-domain-data")).toBeGreaterThan(codes.indexOf(CODE));
  });
});

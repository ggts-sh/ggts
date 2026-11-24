/** ordinal-color-times-alpha lint behavior (issue #1962). */
import { describe, expect, it } from "bun:test";

import { LINT_CATALOG, lintSpec, type SpecAdvisory } from "../src/lint.ts";
import { validate } from "../src/validate.ts";

const CODE = "ordinal-color-times-alpha" as const;

const codesOf = (advisories: SpecAdvisory[]) => advisories.map((a) => a.code);
const matching = (advisories: SpecAdvisory[]) => advisories.filter((a) => a.code === CODE);

const makeCategories = (count: number, prefix = "S") =>
  Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

const baseLabs = { title: "Chart title", x: "X axis", y: "Y axis" };

const tileSpec = (input: {
  n: number;
  scales?: Record<string, unknown>;
  aesExtra?: Record<string, unknown>;
  alphaAes?: unknown;
  includeAlpha?: boolean;
}) => {
  const sectors = makeCategories(input.n);
  const periods = sectors.map((_, i) => `P${(i % 3) + 1}`);
  const rows = sectors.map((_, i) => (i < 3 ? "A" : "B"));
  const passages = sectors.map((_, i) => (i + 1) * 3);
  const aes: Record<string, unknown> = {
    x: { field: "period" },
    y: { field: "row" },
    fill: { field: "sector" },
    ...(input.includeAlpha !== false && { alpha: input.alphaAes ?? { field: "passages" } }),
    ...input.aesExtra,
  };
  return {
    layers: [{ geom: "tile", aes }],
    ...(input.scales !== undefined && { scales: input.scales }),
    labs: baseLabs,
    data: {
      columns: { period: periods, row: rows, sector: sectors, passages },
    },
  };
};

const reproSpec = () => ({
  width: 960,
  height: 480,
  layers: [
    {
      geom: "tile",
      aes: {
        x: { field: "period" },
        y: { field: "row" },
        fill: { field: "sector" },
        alpha: { field: "passages" },
      },
    },
  ],
  scales: {
    x: { type: "band" },
    y: { type: "band" },
    fill: {
      type: "ordinal",
      range: ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948"],
    },
    alpha: { range: [0.08, 1] },
  },
  labs: { title: "Citas por sector y periodo", x: "Periodo", y: "Sector", fill: "Sector" },
  data: {
    columns: {
      period: ["2019", "2020", "2021", "2019", "2020", "2021"],
      row: ["A", "A", "A", "B", "B", "B"],
      sector: ["S1", "S2", "S3", "S4", "S5", "S6"],
      passages: [3, 12, 7, 20, 5, 9],
    },
  },
});

describe("ordinal-color-times-alpha", () => {
  it("registers catalog metadata with needs: data and verbatim rationale", () => {
    expect(LINT_CATALOG[CODE].needs).toBe("data");
    expect(LINT_CATALOG[CODE].rationale).toBe(
      "A hue scale and a continuous alpha ramp multiply into a grid of shades the reader cannot separate. Encode one variable with color and the other with position or small multiples.",
    );
  });

  it("fires on the issue #1962 verbatim repro in lintSpec and validate({ lint: true })", () => {
    const advisories = matching(lintSpec(reproSpec()));
    expect(advisories).toHaveLength(1);
    const hit = advisories[0]!;
    expect(hit.path).toBe("/scales/fill");
    expect(hit.message).toContain("6");
    expect(hit.message).toContain('"passages"');
    expect(hit.message).toMatch(/×|multiply|product/i);
    expect(hit.suggestion?.description).toMatch(/position or small multiples/i);
    expect(hit.suggestion?.description).toMatch(/constant/i);
    expect(hit.suggestion?.description).toMatch(/at most two steps/i);

    const validated = validate(reproSpec(), { lint: true });
    expect(validated.ok).toBe(true);
    expect(codesOf(validated.advisories ?? [])).toContain(CODE);
  });

  it("stays silent at 4 classes (including with null entries) and fires at 5 classes", () => {
    const four = lintSpec(tileSpec({ n: 4, scales: { alpha: { range: [0.1, 1] } } }));
    expect(matching(four)).toEqual([]);

    const fourPlusNull = lintSpec({
      layers: [
        {
          geom: "tile",
          aes: {
            x: { field: "x" },
            y: { field: "y" },
            fill: { field: "g" },
            alpha: { field: "a" },
          },
        },
      ],
      scales: { alpha: { range: [0.1, 1] } },
      labs: baseLabs,
      data: {
        columns: {
          x: ["p1", "p2", "p3", "p4", "p5"],
          y: ["r1", "r1", "r1", "r1", "r1"],
          g: ["S1", "S2", "S3", "S4", null],
          a: [1, 2, 3, 4, 5],
        },
      },
    });
    expect(matching(fourPlusNull)).toEqual([]);

    const five = matching(lintSpec(tileSpec({ n: 5, scales: { alpha: { range: [0.1, 1] } } })));
    expect(five).toHaveLength(1);
    expect(five[0]!.path).toBe("/scales/fill");
    expect(five[0]!.message).toContain("5");
  });

  it("stays silent with 6 fill classes when alpha is not mapped", () => {
    const spec = tileSpec({ n: 6, includeAlpha: false });
    expect(matching(lintSpec(spec))).toEqual([]);
  });

  it("stays silent for binned, ordinal, manual, and identity alpha scales", () => {
    for (const alpha of [
      { type: "binned", breaks: [0, 10, 20], range: [0.2, 1] },
      { type: "ordinal", range: [0.3, 0.9] },
      { type: "manual", domain: [3, 12], range: [0.2, 0.9] },
      { type: "identity" },
    ]) {
      const advisories = matching(lintSpec(tileSpec({ n: 6, scales: { alpha } })));
      expect(advisories).toEqual([]);
    }
  });

  it("stays silent when alpha is a constant value or non-quantitative field", () => {
    const constantAlpha = lintSpec(tileSpec({ n: 6, alphaAes: { value: 0.5 } }));
    expect(matching(constantAlpha)).toEqual([]);

    const nominalAlpha = lintSpec({
      layers: [
        {
          geom: "tile",
          aes: {
            x: { field: "x" },
            y: { field: "y" },
            fill: { field: "g" },
            alpha: { field: "a" },
          },
        },
      ],
      labs: baseLabs,
      data: {
        columns: {
          x: ["p1", "p2", "p3", "p4", "p5"],
          y: ["r1", "r1", "r1", "r1", "r1"],
          g: makeCategories(5),
          a: ["low", "high", "low", "high", "low"],
        },
      },
    });
    expect(matching(nominalAlpha)).toEqual([]);

    const temporalAlpha = lintSpec({
      layers: [
        {
          geom: "tile",
          aes: {
            x: { field: "x" },
            y: { field: "y" },
            fill: { field: "g" },
            alpha: { field: "a" },
          },
        },
      ],
      labs: baseLabs,
      data: {
        columns: {
          x: ["p1", "p2", "p3", "p4", "p5"],
          y: ["r1", "r1", "r1", "r1", "r1"],
          g: makeCategories(5),
          a: ["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-04", "2020-01-05"],
        },
      },
    });
    expect(matching(temporalAlpha)).toEqual([]);
  });

  it("stays silent on zero-span, constant-endpoint 3+ element, invalid alpha ranges, and non-record scale entries", () => {
    for (const alpha of [
      { range: [0.5, 0.5] },
      { type: "sequential", range: [0.4, 0.4] },
      { range: [0.2, 0.8, 0.2] },
      { type: "sequential", range: [0.2, 0.8, 0.2] },
      { range: [0.5] },
      { range: ["0.2", "1"] },
      { range: [Number.NaN, 1] },
      null,
      "sequential",
    ]) {
      const advisories = matching(lintSpec(tileSpec({ n: 6, scales: { alpha } })));
      expect(advisories).toEqual([]);
    }
    expect(
      matching(lintSpec(tileSpec({ n: 5, scales: { alpha: { range: [0.2, 0.8, 0.9] } } }))),
    ).toHaveLength(1);
    expect(matching(lintSpec({ ...tileSpec({ n: 6 }), scales: "bad" }))).toEqual([]);
    expect(matching(lintSpec(tileSpec({ n: 6, scales: { fill: "ordinal" } })))).toEqual([]);
  });

  it("fires when scales.alpha is omitted (defaults to continuous [0.2, 1]) or explicit sequential", () => {
    expect(matching(lintSpec(tileSpec({ n: 5 })))).toHaveLength(1);
    expect(
      matching(lintSpec(tileSpec({ n: 5, scales: { alpha: { type: "sequential" } } }))),
    ).toHaveLength(1);
  });

  it("respects explicit color/fill domain (<= 4 silent, > 4 fires, deduplicated, nulls excluded)", () => {
    const pinnedSmall = lintSpec(
      tileSpec({
        n: 6,
        scales: { fill: { type: "ordinal", domain: ["S1", "S2", "S3", "S4", "S4", null] } },
      }),
    );
    expect(matching(pinnedSmall)).toEqual([]);

    const pinnedLarge = matching(
      lintSpec(
        tileSpec({
          n: 3,
          scales: {
            fill: { type: "ordinal", domain: ["S1", "S2", "S3", "S4", "S5", "S5", null] },
          },
        }),
      ),
    );
    expect(pinnedLarge).toHaveLength(1);
    expect(pinnedLarge[0]!.message).toContain("5");
  });

  it("handles scales.color, manual/ordinal/scheme color scales, and skips sequential/binned/identity color", () => {
    const colorChannel = matching(
      lintSpec({
        layers: [
          {
            geom: "point",
            aes: {
              x: { field: "x" },
              y: { field: "y" },
              color: { field: "group" },
              alpha: { field: "weight" },
            },
          },
        ],
        labs: baseLabs,
        data: {
          columns: {
            x: [1, 2, 3, 4, 5],
            y: [2, 4, 6, 8, 10],
            group: makeCategories(5, "G"),
            weight: [10, 20, 30, 40, 50],
          },
        },
      }),
    );
    expect(colorChannel).toHaveLength(1);
    expect(colorChannel[0]!.path).toBe("/scales/color");
    expect(colorChannel[0]!.message).toContain('"weight"');

    // Explicit ordinal/manual or categorical scheme over numeric IDs fires.
    for (const colorScale of [
      { type: "ordinal" },
      { type: "manual", range: ["#111", "#222", "#333", "#444", "#555"] },
      { scheme: "observable10" },
    ]) {
      const numericIds = matching(
        lintSpec({
          layers: [
            {
              geom: "point",
              aes: {
                x: { field: "x" },
                y: { field: "y" },
                color: { field: "id" },
                alpha: { field: "weight" },
              },
            },
          ],
          scales: { color: colorScale },
          labs: baseLabs,
          data: {
            columns: {
              x: [1, 2, 3, 4, 5],
              y: [2, 3, 4, 5, 6],
              id: [1, 2, 3, 4, 5],
              weight: [10, 20, 30, 40, 50],
            },
          },
        }),
      );
      expect(numericIds).toHaveLength(1);
      expect(numericIds[0]!.path).toBe("/scales/color");
    }

    // Sequential, binned, identity, or omitted quantitative color scales stay silent.
    for (const fillScale of [
      { type: "sequential" },
      { type: "binned" },
      { type: "identity" },
      { scheme: "viridis" },
    ]) {
      const silent = matching(
        lintSpec({
          layers: [
            {
              geom: "tile",
              aes: {
                x: { field: "x" },
                y: { field: "y" },
                fill: { field: "score" },
                alpha: { field: "weight" },
              },
            },
          ],
          scales: { fill: fillScale },
          labs: baseLabs,
          data: {
            columns: {
              x: ["a", "b", "c", "d", "e"],
              y: ["1", "1", "1", "1", "1"],
              score: [1, 2, 3, 4, 5],
              weight: [10, 20, 30, 40, 50],
            },
          },
        }),
      );
      expect(silent).toEqual([]);
    }
  });

  it("emits for both color and fill when both independently qualify", () => {
    const advisories = matching(
      lintSpec({
        layers: [
          {
            geom: "point",
            aes: {
              x: { field: "x" },
              y: { field: "y" },
              color: { field: "c" },
              fill: { field: "f" },
              alpha: { field: "a" },
            },
          },
        ],
        labs: baseLabs,
        data: {
          columns: {
            x: [1, 2, 3, 4, 5],
            y: [1, 2, 3, 4, 5],
            c: makeCategories(5, "C"),
            f: makeCategories(6, "F").slice(0, 5),
            a: [1, 2, 3, 4, 5],
          },
        },
      }),
    );
    expect(advisories.map((a) => a.path)).toEqual(["/scales/color", "/scales/fill"]);
  });
});

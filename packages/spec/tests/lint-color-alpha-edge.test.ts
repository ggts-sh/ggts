/** ordinal-color-times-alpha edge, multi-layer, evidence, and regression tests (issue #1962). */
import { describe, expect, it } from "bun:test";

import { lintSpec, type SpecAdvisory } from "../src/lint.ts";

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

describe("ordinal-color-times-alpha (edge cases & regression)", () => {
  it("stays silent on split-channel layers and fires once for shared multi-layer union > 4", () => {
    const splitLayers = matching(
      lintSpec({
        labs: baseLabs,
        data: {
          columns: {
            x: [1, 2, 3, 4, 5, 6],
            y: [1, 2, 3, 4, 5, 6],
            sector: makeCategories(6),
            passages: [1, 2, 3, 4, 5, 6],
          },
        },
        layers: [
          {
            geom: "tile",
            aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "sector" } },
          },
          {
            geom: "point",
            aes: { x: { field: "x" }, y: { field: "y" }, alpha: { field: "passages" } },
          },
        ],
      }),
    );
    expect(splitLayers).toEqual([]);

    const unionLayers = matching(
      lintSpec({
        labs: baseLabs,
        datasets: {
          first: {
            columns: { x: [1, 2, 3], y: [1, 2, 3], g: ["A", "B", "C"], a: [1, 2, 3] },
          },
          second: {
            columns: { x: [4, 5, 6], y: [4, 5, 6], g: ["D", "E", "F"], a: [4, 5, 6] },
          },
        },
        layers: [
          {
            geom: "tile",
            data: { name: "first" },
            aes: {
              x: { field: "x" },
              y: { field: "y" },
              fill: { field: "g" },
              alpha: { field: "a" },
            },
          },
          {
            geom: "tile",
            data: { name: "second" },
            aes: {
              x: { field: "x" },
              y: { field: "y" },
              fill: { field: "g" },
              alpha: { field: "a" },
            },
          },
        ],
      }),
    );
    expect(unionLayers).toHaveLength(1);
    expect(unionLayers[0]!.path).toBe("/scales/fill");
    expect(unionLayers[0]!.message).toContain("6");

    // Shared plot aes across 2 layers emits once without double-counting.
    const sharedPlotAes = matching(
      lintSpec({
        ...tileSpec({ n: 5 }),
        aes: {
          x: { field: "period" },
          y: { field: "row" },
          fill: { field: "sector" },
          alpha: { field: "passages" },
        },
        layers: [{ geom: "tile" }, { geom: "point" }],
      }),
    );
    expect(sharedPlotAes).toHaveLength(1);
    expect(sharedPlotAes[0]!.message).toContain("5");
  });

  it("supports layer-local data and datasets, and skips unresolved runtime layer data", () => {
    const layerLocal = matching(
      lintSpec({
        labs: baseLabs,
        layers: [
          {
            geom: "tile",
            data: {
              columns: {
                x: [1, 2, 3, 4, 5],
                y: [1, 1, 1, 1, 1],
                sector: makeCategories(5),
                passages: [1, 2, 3, 4, 5],
              },
            },
            aes: {
              x: { field: "x" },
              y: { field: "y" },
              fill: { field: "sector" },
              alpha: { field: "passages" },
            },
          },
        ],
      }),
    );
    expect(layerLocal).toHaveLength(1);
    expect(layerLocal[0]!.path).toBe("/scales/fill");

    const runtimeLayerWithPlotData = matching(
      lintSpec({
        labs: baseLabs,
        data: {
          columns: {
            x: [1, 2, 3, 4, 5],
            y: [1, 1, 1, 1, 1],
            sector: makeCategories(5),
            passages: [1, 2, 3, 4, 5],
          },
        },
        layers: [
          {
            geom: "tile",
            data: { name: "runtime_only" },
            aes: {
              x: { field: "x" },
              y: { field: "y" },
              fill: { field: "sector" },
              alpha: { field: "passages" },
            },
          },
        ],
      }),
    );
    expect(runtimeLayerWithPlotData).toEqual([]);
  });

  it("handles bare-string aes and null channel unset on layers", () => {
    const bareStrings = matching(
      lintSpec({
        labs: baseLabs,
        data: {
          columns: {
            x: [1, 2, 3, 4, 5],
            y: [1, 1, 1, 1, 1],
            sector: makeCategories(5),
            passages: [1, 2, 3, 4, 5],
          },
        },
        aes: { x: "x", y: "y", fill: "sector", alpha: "passages" },
        layers: [{ geom: "tile" }],
      }),
    );
    expect(bareStrings).toHaveLength(1);

    const unsetAlpha = matching(
      lintSpec({
        labs: baseLabs,
        data: {
          columns: {
            x: [1, 2, 3, 4, 5],
            y: [1, 1, 1, 1, 1],
            sector: makeCategories(5),
            passages: [1, 2, 3, 4, 5],
          },
        },
        aes: { x: "x", y: "y", fill: "sector", alpha: "passages" },
        layers: [{ geom: "tile", aes: { alpha: null } }],
      }),
    );
    expect(unsetAlpha).toEqual([]);
  });

  it("skips silently on missing, null, over-limit, or profile-only evidence", () => {
    const noData = matching(
      lintSpec({
        labs: baseLabs,
        layers: [
          {
            geom: "tile",
            aes: {
              x: { field: "x" },
              y: { field: "y" },
              fill: { field: "sector" },
              alpha: { field: "passages" },
            },
          },
        ],
      }),
    );
    expect(noData).toEqual([]);

    expect(matching(lintSpec(reproSpec(), { limits: { maxRows: 3 } }))).toEqual([]);
    expect(matching(lintSpec(reproSpec(), { limits: { maxBytes: 20 } }))).toEqual([]);
    expect(matching(lintSpec(reproSpec(), undefined, null, null))).toEqual([]);

    const profileOnly = matching(
      lintSpec(
        {
          labs: baseLabs,
          scales: {
            fill: { type: "ordinal", domain: ["S1", "S2", "S3", "S4", "S5", "S6"] },
            alpha: { range: [0.08, 1] },
          },
          layers: [
            {
              geom: "tile",
              aes: {
                x: { field: "x" },
                y: { field: "y" },
                fill: { field: "sector" },
                alpha: { field: "passages" },
              },
            },
          ],
        },
        {
          profile: {
            fields: [
              { name: "x", type: "nominal" },
              { name: "y", type: "nominal" },
              { name: "sector", type: "nominal" },
              { name: "passages", type: "quantitative" },
            ],
          },
        },
      ),
    );
    expect(profileOnly).toEqual([]);
  });

  it("preserves many-discrete-colors (> 10) threshold and message without regression", () => {
    // At 6 classes + alpha: ordinal-color-times-alpha fires, many-discrete-colors stays silent.
    const sixAdvisories = lintSpec(reproSpec());
    expect(codesOf(sixAdvisories)).toContain(CODE);
    expect(codesOf(sixAdvisories)).not.toContain("many-discrete-colors");

    // At 11 classes + alpha: both advisories fire independently at their own paths.
    const elevenAdvisories = lintSpec(tileSpec({ n: 11 }));
    expect(codesOf(elevenAdvisories)).toContain(CODE);
    const many = elevenAdvisories.find((a) => a.code === "many-discrete-colors");
    expect(many).toBeDefined();
    expect(many!.path).toBe("/layers/0/aes/fill");
    expect(many!.message).toContain("11 distinct values");
  });
});

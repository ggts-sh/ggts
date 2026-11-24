import { describe, expect, it } from "bun:test";

import { lintSpec, type SpecAdvisory } from "../src/lint.ts";

const CODE = "bar-end-label-offset";
const codesOf = (advisories: readonly SpecAdvisory[]) => advisories.map((a) => a.code);
const matching = (advisories: readonly SpecAdvisory[]) => advisories.filter((a) => a.code === CODE);

const baseCartesian = {
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
  labs: { title: "Counts", x: "Pathway", y: "Count" },
  data: { columns: { pathway: ["A4", "B2", "C1"], n: [42, 17, 5] } },
};

function flippedSpec(textLayerOverrides: Record<string, unknown>) {
  return {
    ...baseCartesian,
    coord: { type: "flip" },
    layers: [
      baseCartesian.layers[0]!,
      {
        ...baseCartesian.layers[1]!,
        ...textLayerOverrides,
      },
    ],
  };
}

describe("bar-end-label-offset coord and facet handling", () => {
  it("stays silent on coord: flip with clean horizontal end offsets", () => {
    const startDy = flippedSpec({ params: { anchor: "start", dy: -6, size: 11 } });
    expect(codesOf(lintSpec(startDy))).not.toContain(CODE);

    const startZeroDxDy = flippedSpec({ params: { anchor: "start", dx: 0, dy: -6, size: 12 } });
    expect(codesOf(lintSpec(startZeroDxDy))).not.toContain(CODE);

    const endDy = flippedSpec({ params: { anchor: "end", dy: 6, size: 11 } });
    expect(codesOf(lintSpec(endDy))).not.toContain(CODE);

    const labelGeomDy = flippedSpec({
      geom: "label",
      params: { anchor: "start", dy: -6 },
    });
    expect(codesOf(lintSpec(labelGeomDy))).not.toContain(CODE);

    const nudgeStart = flippedSpec({
      position: "nudge",
      positionParams: { y: 2 },
      params: { anchor: "start" },
    });
    expect(codesOf(lintSpec(nudgeStart))).not.toContain(CODE);

    const nudgeEnd = flippedSpec({
      position: "nudge",
      positionParams: { y: -2 },
      params: { anchor: "end" },
    });
    expect(codesOf(lintSpec(nudgeEnd))).not.toContain(CODE);
  });

  it("stays silent on benchmarkChartSpec-style horizontal bar chart", () => {
    const benchmarkLike = {
      data: {
        values: [
          { lib: "ggsvelte", value: 75.5, kind: "ggsvelte", label: "75.5 ms" },
          { lib: "peer", value: 140.2, kind: "peer", label: "140.2 ms" },
        ],
      },
      aes: { x: { field: "lib" }, y: { field: "value" } },
      layers: [
        { geom: "col", aes: { fill: { field: "kind" } }, params: { width: 0.62 } },
        {
          geom: "text",
          aes: { label: { field: "label" } },
          params: { anchor: "start", dx: 0, dy: -6, size: 12 },
        },
      ],
      scales: {
        x: { type: "band", domain: ["ggsvelte", "peer"], reverse: true },
        y: { expand: { mult: 0.45, add: 0 } },
      },
      coord: { type: "flip" },
      labs: { title: "Cold mount", x: "", y: "ms" },
    };
    expect(codesOf(lintSpec(benchmarkLike))).not.toContain(CODE);
  });

  it("emits flip-accurate copy (never anchor: middle) on misplaced coord: flip labels", () => {
    const verticalShiftDx = flippedSpec({ params: { anchor: "start", dx: 6, size: 11 } });
    const dxHits = matching(lintSpec(verticalShiftDx));
    expect(dxHits).toHaveLength(1);
    expect(dxHits[0]!.message).toContain('coord: { type: "flip" }');
    expect(dxHits[0]!.message).toContain("params.dx shifts vertically");
    expect(dxHits[0]!.message).toContain("params.dy shifts horizontally");
    expect(dxHits[0]!.suggestion?.description).not.toMatch(/anchor.*middle/i);
    expect(dxHits[0]!.suggestion?.description).toContain("dy: -6");
    expect(dxHits[0]!.suggestion?.description).toContain("dy: 6");
    expect(dxHits[0]!.suggestion?.description).toContain("stacked segment");
    expect(dxHits[0]!.suggestion?.example).toEqual({ params: { anchor: "start", dy: -6 } });

    const missingDyEnd = flippedSpec({ params: { anchor: "end" } });
    const endHits = matching(lintSpec(missingDyEnd));
    expect(endHits).toHaveLength(1);
    expect(endHits[0]!.suggestion?.example).toEqual({ params: { anchor: "end", dy: 6 } });

    const wrongSignStart = flippedSpec({ params: { anchor: "start", dy: 6 } });
    expect(codesOf(lintSpec(wrongSignStart))).toContain(CODE);

    const wrongSignEnd = flippedSpec({ params: { anchor: "end", dy: -6 } });
    expect(codesOf(lintSpec(wrongSignEnd))).toContain(CODE);

    const verticalNudge = flippedSpec({
      position: "nudge",
      positionParams: { x: 0.2 },
      params: { anchor: "start", dy: -6 },
    });
    expect(codesOf(lintSpec(verticalNudge))).toContain(CODE);

    const mixedDxAndDy = flippedSpec({ params: { anchor: "start", dx: 4, dy: -6 } });
    expect(codesOf(lintSpec(mixedDxAndDy))).toContain(CODE);
  });

  it("handles combined dy and nudge positionParams.y under coord: flip", () => {
    const cleanStartCombined = flippedSpec({
      position: "nudge",
      positionParams: { y: 2 },
      params: { anchor: "start", dy: -6 },
    });
    expect(lintSpec(cleanStartCombined)).toEqual([]);

    const cleanStartZeroDy = flippedSpec({
      position: "nudge",
      positionParams: { y: 2 },
      params: { anchor: "start", dy: 0 },
    });
    expect(lintSpec(cleanStartZeroDy)).toEqual([]);

    const cleanEndCombined = flippedSpec({
      position: "nudge",
      positionParams: { y: -2 },
      params: { anchor: "end", dy: 6 },
    });
    expect(lintSpec(cleanEndCombined)).toEqual([]);

    const opposingStartPosDy = flippedSpec({
      position: "nudge",
      positionParams: { y: 5 },
      params: { anchor: "start", dy: 12 },
    });
    expect(codesOf(lintSpec(opposingStartPosDy))).toContain(CODE);

    const opposingStartNegNudge = flippedSpec({
      position: "nudge",
      positionParams: { y: -5 },
      params: { anchor: "start", dy: -6 },
    });
    expect(codesOf(lintSpec(opposingStartNegNudge))).toContain(CODE);

    const opposingEndNegDy = flippedSpec({
      position: "nudge",
      positionParams: { y: -5 },
      params: { anchor: "end", dy: -12 },
    });
    expect(codesOf(lintSpec(opposingEndNegDy))).toContain(CODE);

    const opposingEndPosNudge = flippedSpec({
      position: "nudge",
      positionParams: { y: 5 },
      params: { anchor: "end", dy: 6 },
    });
    expect(codesOf(lintSpec(opposingEndPosNudge))).toContain(CODE);
  });

  it("skips coord: radial and keeps upright-Cartesian rule for cartesian, fixed, sf, transform", () => {
    expect(codesOf(lintSpec({ ...baseCartesian, coord: { type: "radial" } }))).not.toContain(CODE);
    expect(
      codesOf(lintSpec({ ...baseCartesian, coord: { type: "radial", theta: "y" } })),
    ).not.toContain(CODE);

    for (const coord of [
      { type: "cartesian" },
      { type: "fixed", ratio: 0.05 },
      { type: "sf" },
      { type: "transform", y: { transform: "sqrt" } },
    ]) {
      const hits = matching(lintSpec({ ...baseCartesian, coord }));
      expect(hits).toHaveLength(1);
      expect(hits[0]!.suggestion?.example).toEqual({ params: { anchor: "middle" } });
    }
  });

  it("handles bare-string facet wrap, rows, and cols", () => {
    const bareWrapShared = {
      facet: { wrap: "panel" },
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
    expect(codesOf(lintSpec(bareWrapShared))).toContain(CODE);

    const bareWrapDisjoint = {
      ...bareWrapShared,
      layers: [
        bareWrapShared.layers[0]!,
        {
          ...bareWrapShared.layers[1]!,
          data: { columns: { cat: ["a"], n: [10], panel: ["p2"] } },
        },
      ],
    };
    expect(codesOf(lintSpec(bareWrapDisjoint))).not.toContain(CODE);

    const bareGridShared = {
      facet: { rows: "r", cols: "c" },
      layers: [
        {
          geom: "col",
          data: { columns: { cat: ["a"], n: [10], r: ["r1"], c: ["c1"] } },
          aes: { x: { field: "cat" }, y: { field: "n" } },
        },
        {
          geom: "text",
          data: { columns: { cat: ["a"], n: [10], r: ["r1"], c: ["c1"] } },
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "end" },
        },
      ],
    };
    expect(codesOf(lintSpec(bareGridShared))).toContain(CODE);

    const bareGridDisjoint = {
      ...bareGridShared,
      layers: [
        bareGridShared.layers[0]!,
        {
          ...bareGridShared.layers[1]!,
          data: { columns: { cat: ["a"], n: [10], r: ["r1"], c: ["c2"] } },
        },
      ],
    };
    expect(codesOf(lintSpec(bareGridDisjoint))).not.toContain(CODE);
  });

  it("handles bar count stat y matching for omitted y, null unset, constant y, and field y", () => {
    const omittedY = {
      layers: [
        { geom: "bar", aes: { x: { field: "cat" } } },
        {
          geom: "text",
          aes: { x: { field: "cat" }, label: { field: "cat" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(omittedY))).not.toContain(CODE);

    const unsetY = {
      aes: { x: "cat", y: "n" },
      layers: [
        { geom: "bar", aes: { y: null } },
        {
          geom: "text",
          aes: { y: null, label: "cat" },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(unsetY))).not.toContain(CODE);

    const constantY = {
      layers: [
        { geom: "bar", aes: { x: { field: "cat" } } },
        {
          geom: "text",
          aes: { x: { field: "cat" }, y: { value: 0 }, label: { field: "cat" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(constantY))).not.toContain(CODE);

    const preAggregatedY = {
      data: { columns: { cat: ["a", "a", "b"] } },
      layers: [
        { geom: "bar", aes: { x: { field: "cat" } } },
        {
          geom: "text",
          data: { columns: { cat: ["a", "b"], n: [2, 1] } },
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(preAggregatedY))).toContain(CODE);
  });

  it("filters non-shared facet levels even when the other layer broadcasts", () => {
    const wrapFilteredWithBroadcast = {
      facet: { wrap: { field: "panel", levels: ["p2"] } },
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
    expect(codesOf(lintSpec(wrapFilteredWithBroadcast))).not.toContain(CODE);

    const gridBroadcastFilteredOut = {
      facet: { rows: { field: "r" }, cols: { field: "c", levels: ["c2"] } },
      layers: [
        {
          geom: "col",
          data: { columns: { cat: ["a"], n: [10], r: ["r1"] } },
          aes: { x: { field: "cat" }, y: { field: "n" } },
        },
        {
          geom: "text",
          data: { columns: { cat: ["a"], n: [10], r: ["r1"], c: ["c1"] } },
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(gridBroadcastFilteredOut))).not.toContain(CODE);

    const gridDisjointAxesFilteredOut = {
      facet: { rows: { field: "r", levels: ["r2"] }, cols: { field: "c", levels: ["c2"] } },
      layers: [
        {
          geom: "col",
          data: { columns: { cat: ["a"], n: [10], r: ["r1"] } },
          aes: { x: { field: "cat" }, y: { field: "n" } },
        },
        {
          geom: "text",
          data: { columns: { cat: ["a"], n: [10], c: ["c2"] } },
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(gridDisjointAxesFilteredOut))).not.toContain(CODE);

    const gridBroadcastSurvives = {
      ...gridBroadcastFilteredOut,
      layers: [
        gridBroadcastFilteredOut.layers[0]!,
        {
          geom: "text",
          data: { columns: { cat: ["a"], n: [10], r: ["r1"], c: ["c2"] } },
          aes: { x: { field: "cat" }, y: { field: "n" }, label: { field: "n" } },
          params: { anchor: "start" },
        },
      ],
    };
    expect(codesOf(lintSpec(gridBroadcastSurvives))).toContain(CODE);
  });
});

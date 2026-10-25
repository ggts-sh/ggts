/** Group results do not depend on whether pointer queries ran first. */
import { describe, expect, it } from "bun:test";

import { buildCandidateStore } from "../../../src/candidate-store.ts";

import { sceneWithPoints } from "../fixtures.ts";

const POINTS: readonly (readonly [number, number])[] = [
  [10, 10],
  [10, 50],
  [10, 30],
  [40, 20],
  [40, 60],
];

function groupingStore() {
  return buildCandidateStore(sceneWithPoints(POINTS), {
    datum: ({ primitiveIndex }) => ({
      xValue: primitiveIndex < 3 ? "a" : "b",
      yValue: primitiveIndex * 10,
      seriesId: primitiveIndex === 1 ? 1 : 0,
      seriesRank: primitiveIndex === 1 ? 1 : 0,
    }),
  });
}

describe("lazy axis-group tables", () => {
  it("returns identical group() results whether or not hit queries ran first", () => {
    const groupedFirst = groupingStore();
    const direct = groupedFirst.group(0, "x");

    const hitFirst = groupingStore();
    hitFirst.hitTest(10, 10);
    hitFirst.nearest(10, 10, { mode: "xy", maxDistance: 32 });
    hitFirst.traverse(0, "next");
    const afterQueries = hitFirst.group(0, "x");

    expect(direct?.memberIds).toEqual(new Uint32Array([0, 1]));
    expect(afterQueries).toEqual(direct);
  });
});

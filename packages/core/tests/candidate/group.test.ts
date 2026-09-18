import { describe, expect, it } from "bun:test";

import { buildCandidateStore } from "../../src/candidate-store.ts";
import { sceneWithPoints } from "./fixtures.ts";

describe("candidate grouping hot path", () => {
  it("orders series representatives by series rank", () => {
    const plotScene = sceneWithPoints([
      [10, 30],
      [10, 10],
      [10, 20],
    ]);
    const store = buildCandidateStore(plotScene, {
      datum: ({ primitiveIndex }) => ({
        xValue: 1,
        yValue: primitiveIndex,
        seriesId: primitiveIndex,
        seriesRank: 2 - primitiveIndex,
      }),
    });
    expect(store.group(0, "x")?.memberIds).toEqual(new Uint32Array([2, 1, 0]));
  });

  it("does not produce an axis target for an invalid logical bucket", () => {
    const plotScene = sceneWithPoints([[10, 10]]);
    const store = buildCandidateStore(plotScene, {
      datum: () => ({ xValue: Number.NaN, yValue: 1 }),
    });
    expect(store.group(0, "x")).toBeNull();
    expect(store.nearest(10, 10, { mode: "x", maxDistance: 100 })).toBeNull();
  });

  it("chooses the closest series member when rank order is not coordinate order", () => {
    const store = buildCandidateStore(
      sceneWithPoints([
        [10, 50],
        [10, 90],
        [10, 49],
        [10, 10],
      ]),
      {
        datum: ({ primitiveIndex }) => ({
          xValue: "shared",
          seriesId: primitiveIndex === 0 ? 0 : 1,
          seriesRank: primitiveIndex,
        }),
      },
    );
    expect(store.group(0, "x")?.memberIds).toEqual(new Uint32Array([0, 2]));
  });

  it("resolves y groups on the orthogonal screen axis under coordinate flip", () => {
    const plotScene = sceneWithPoints([
      [50, 20],
      [51, 100],
      [100, 21],
    ]);
    const options = {
      datum: ({ primitiveIndex }: { primitiveIndex: number }) => ({
        yValue: "shared",
        seriesId: primitiveIndex === 0 ? 0 : 1,
      }),
    };
    const normal = buildCandidateStore(plotScene, options);
    const flipped = buildCandidateStore(plotScene, { ...options, flip: true });
    expect(normal.group(0, "y")?.memberIds).toEqual(new Uint32Array([0, 1]));
    expect(flipped.group(0, "y")?.memberIds).toEqual(new Uint32Array([0, 2]));
  });

  it("keeps a tied seed as its series representative within its own panel", () => {
    const plotScene = sceneWithPoints([
      [10, 20],
      [10, 20],
      [10, 40],
    ]);
    plotScene.panels.push({ ...plotScene.panels[0]!, id: "panel:second", x: 200 });
    plotScene.batches.push({ ...plotScene.batches[0]!, panelIndex: 1 });
    const store = buildCandidateStore(plotScene, {
      datum: ({ primitiveIndex }) => ({
        xValue: "shared",
        yValue: primitiveIndex === 2 ? 40 : 20,
        seriesId: primitiveIndex === 2 ? 1 : 0,
      }),
    });
    // The lower-source sibling would win a generic nearest tie, but each
    // seed must remain the representative of its own series and panel.
    expect(store.group(1, "x")).toMatchObject({
      focusId: 1,
      axisValue: "shared",
      memberIds: new Uint32Array([1, 2]),
      range: { panelIndex: 0 },
    });
    expect(store.group(4, "x")).toMatchObject({
      focusId: 4,
      axisValue: "shared",
      memberIds: new Uint32Array([4, 5]),
      range: { panelIndex: 1 },
    });
  });
});

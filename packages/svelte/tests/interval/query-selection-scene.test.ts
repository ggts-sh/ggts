import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";

import type { SemanticViewport } from "@ggts-sh/core";

import {
  buildIntervalSelectionFromScene,
  intervalQuerySceneFromModel,
} from "../../src/lib/interval/query.js";
import { scene } from "./query-fixtures.js";

describe("buildIntervalSelectionFromScene", () => {
  it("builds a frozen event from viewport candidates and lineage", () => {
    const event = buildIntervalSelectionFromScene({
      phase: "end",
      mode: "x",
      source: "pointer",
      pixels: { x0: 0, y0: 0, x1: 50, y1: 50 },
      scene: scene({
        candidates: [{ lineage: 1, x0: 10, y0: 90, x1: 11, y1: 91 }],
      }),
      keyForRow: (rowIndex) => (rowIndex === 11 ? null : `r${String(rowIndex)}`),
    });

    expect(event).toMatchObject({
      phase: "end",
      mode: "x",
      panelId: "p0",
      keys: ["r10"],
      lineageCount: 2,
    });
    expect(event.domain.x).toEqual([0, 5]);
    expect(event.domain.y).toBeUndefined();
    expect(Object.isFrozen(event)).toBe(true);
  });

  it("preserves start phase with an empty scene", () => {
    const event = buildIntervalSelectionFromScene({
      phase: "start",
      mode: "xy",
      source: "keyboard",
      pixels: { x0: 1, y0: 2, x1: 3, y1: 4 },
      scene: null,
      keyForRow: () => "k",
    });
    expect(event).toMatchObject({ phase: "start", keys: [], panelId: null });
  });
});

describe("intervalQuerySceneFromModel", () => {
  it("preserves the model-owned viewport and delegates lineage", () => {
    const viewport = fromPartial<SemanticViewport>({ panels: [] });
    const adapted = intervalQuerySceneFromModel({
      viewport,
      lineage: { keys: (lineageId) => (lineageId === 2 ? [20, 21] : []) },
    });

    expect(adapted.viewport).toBe(viewport);
    expect([...adapted.lineageKeys(2)]).toEqual([20, 21]);
  });
});

import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";

import type { CandidateFacts, SemanticViewportPanel } from "@ggts-sh/core";

import { resolveIntervalQueryParts } from "../../src/lib/interval/query.js";
import { scene } from "./query-fixtures.js";

describe("resolveIntervalQueryParts", () => {
  it("returns empty parts when the viewport has no panel", () => {
    expect(
      resolveIntervalQueryParts({
        pixels: { x0: 0, y0: 0, x1: 10, y1: 10 },
        mode: "xy",
        scene: scene({ panel: null }),
      }),
    ).toEqual({ rowIndexes: new Set(), panelId: null, invertedDomain: {} });
  });

  it("delegates query and inversion to the viewport panel", () => {
    const rect = { x0: 10, y0: 10, x1: 40, y1: 40 };
    const query = vi.fn(() => [fromPartial<CandidateFacts>({ lineage: 1 })]);
    const invert = vi.fn(() => ({ x: [1, 4] as const }));
    const panel = fromPartial<SemanticViewportPanel>({
      id: "p0",
      bounds: { x0: 0, y0: 0, x1: 100, y1: 100 },
      query,
      invert,
    });
    const parts = resolveIntervalQueryParts({
      pixels: rect,
      mode: "x",
      scene: scene({ panel, lineage: { 1: [10, 11] } }),
    });

    expect(query).toHaveBeenCalledWith(rect, "x");
    expect(invert).toHaveBeenCalledWith(rect);
    expect([...parts.rowIndexes]).toEqual([10, 11]);
    expect(parts.invertedDomain).toEqual({ x: [1, 4] });
  });

  it("uses a requested facet and suppresses ambiguous inversion without one", () => {
    const west = fromPartial<SemanticViewportPanel>({
      id: "west",
      query: () => [],
      invert: () => ({ x: [0, 1] }),
    });
    const east = fromPartial<SemanticViewportPanel>({
      id: "east",
      query: () => [],
      invert: () => ({ x: [100, 200] }),
    });
    const viewportScene = scene({ panels: [west, east] });
    const pixels = { x0: 0, y0: 0, x1: 10, y1: 10 };

    expect(
      resolveIntervalQueryParts({ pixels, mode: "xy", scene: viewportScene }).invertedDomain,
    ).toEqual({});
    expect(
      resolveIntervalQueryParts({
        pixels,
        mode: "xy",
        scene: viewportScene,
        panelId: "east",
      }).invertedDomain,
    ).toEqual({ x: [100, 200] });
  });
});

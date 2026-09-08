/** Shared SemanticViewport-backed IntervalQueryScene test builder. */
import { fromPartial } from "@total-typescript/shoehorn";

import type { CandidateFacts, PlotRect, SemanticViewportPanel } from "@ggts-sh/core";

import type { IntervalQueryScene } from "../../src/lib/interval/query.js";

type Candidate = Readonly<{
  lineage: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}>;

export function scene(partial: {
  panel?: SemanticViewportPanel | null;
  panels?: readonly SemanticViewportPanel[];
  candidates?: readonly Candidate[];
  lineage?: Record<number, number[]>;
}): IntervalQueryScene {
  const candidates = partial.candidates ?? [];
  const lineage = partial.lineage ?? { 1: [10, 11], 2: [11, 12] };
  const defaultPanel = fromPartial<SemanticViewportPanel>({
    id: "p0",
    bounds: { x0: 0, y0: 0, x1: 100, y1: 100 },
    invert: (rect: PlotRect) => ({ x: [rect.x0 / 10, rect.x1 / 10], y: [0, 20] }),
    query(rect: PlotRect, mode: "x" | "y" | "xy") {
      const expanded =
        mode === "x"
          ? { ...rect, y0: 0, y1: 100 }
          : mode === "y"
            ? { ...rect, x0: 0, x1: 100 }
            : rect;
      return candidates
        .filter(
          (candidate) =>
            candidate.x1 >= expanded.x0 &&
            candidate.x0 <= expanded.x1 &&
            candidate.y1 >= expanded.y0 &&
            candidate.y0 <= expanded.y1,
        )
        .map((candidate) => fromPartial<CandidateFacts>({ lineage: candidate.lineage }));
    },
  });
  const panel = partial.panel === undefined ? defaultPanel : partial.panel;
  const panels = partial.panels ?? (panel === null ? [] : [panel]);
  return {
    viewport: {
      panels,
      panel(id) {
        return panels.find((candidate) => candidate.id === id) ?? null;
      },
      panelAt() {
        return null;
      },
      panelAtOrOnly() {
        return panels.length === 1 ? (panels[0] ?? null) : null;
      },
    },
    lineageKeys(id) {
      return lineage[id] ?? [];
    },
  };
}

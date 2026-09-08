import { describe, expect, it } from "vitest";

import type { CandidateFacts } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

import { createSemanticCandidateProjection } from "../../src/lib/runtime/semantic-candidate-projection.svelte.js";
import { withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { modelFor } from "../helpers/model.js";

describe("createSemanticCandidateProjection", () => {
  it("density-gates emphasis rings on dense point series but keeps selection rings", () => {
    // EMPHASIS_RING_DENSITY_LIMIT is 48 — 50 co-emphasized points drop rings;
    // selecting the same 50 keys still draws rings (D2).
    const denseRows = Array.from({ length: 50 }, (_, i) => ({
      id: String(i),
      x: i,
      y: i % 7,
    }));
    const denseModel = modelFor(
      gg(denseRows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .spec(),
    );
    const allKeys = denseRows.map((row) => row.id);
    const keysForDense = (candidate: CandidateFacts): PropertyKey[] => {
      if (candidate.rowIndex === null) return [];
      const row = denseRows[candidate.rowIndex];
      return row === undefined ? [] : [row.id];
    };
    const { value, destroy } = withFlushedEffectRoot(() =>
      createSemanticCandidateProjection({
        model: () => denseModel,
        candidateSemanticKeys: keysForDense,
        selectedKeys: () => allKeys,
        intervalKeys: () => [],
        intervals: () => [],
        emphasisKeys: () => allKeys,
        inspectionFocus: () => null,
      }),
    );

    expect(value.emphasizedAnchors.length).toBe(50);
    expect(value.emphasizedAnchors.every((a) => a.chrome === "none")).toBe(true);
    expect(value.selectedAnchors.length).toBe(50);
    expect(value.selectedAnchors.every((a) => a.chrome === "ring")).toBe(true);
    destroy();
  });

  it("uses mute-only chrome for path (line) emphasis anchors", () => {
    const lineModel = modelFor(
      gg(
        [
          { id: "a1", series: "A", x: 1, y: 1 },
          { id: "a2", series: "A", x: 2, y: 3 },
          { id: "b1", series: "B", x: 1, y: 2 },
          { id: "b2", series: "B", x: 2, y: 4 },
        ],
        aes({ x: "x", y: "y", color: "series" }),
      )
        .geomLine()
        .spec(),
    );
    const keysForLine = (candidate: CandidateFacts): PropertyKey[] => {
      if (candidate.rowIndex === null) return [];
      const rows = [
        { id: "a1", series: "A" },
        { id: "a2", series: "A" },
        { id: "b1", series: "B" },
        { id: "b2", series: "B" },
      ];
      const row = rows[candidate.rowIndex];
      return row === undefined ? [] : [row.id];
    };
    const { value, destroy } = withFlushedEffectRoot(() =>
      createSemanticCandidateProjection({
        model: () => lineModel,
        candidateSemanticKeys: keysForLine,
        selectedKeys: () => [],
        intervalKeys: () => [],
        intervals: () => [],
        emphasisKeys: () => ["a1", "a2"],
        inspectionFocus: () => null,
      }),
    );

    expect(value.emphasizedAnchors.length).toBeGreaterThan(0);
    expect(value.emphasizedAnchors.every((a) => a.chrome === "none")).toBe(true);
    expect(value.interactionMasks.some((mask) => mask !== null)).toBe(true);
    destroy();
  });
});

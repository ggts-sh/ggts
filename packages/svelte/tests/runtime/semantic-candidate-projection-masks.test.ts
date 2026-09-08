import { describe, expect, it } from "vitest";

import type { CandidateFacts } from "@ggts-sh/core";
import { aes, gg } from "@ggts-sh/spec";

import { createSemanticCandidateProjection } from "../../src/lib/runtime/semantic-candidate-projection.svelte.js";
import { withFlushedEffectRoot } from "../helpers/effect-root.svelte.js";
import { modelFor } from "../helpers/model.js";

describe("createSemanticCandidateProjection", () => {
  it("does not mute siblings from rect inspection by default (#633)", () => {
    const colModel = modelFor(
      gg(
        [
          { category: "A", count: 10 },
          { category: "B", count: 20 },
          { category: "C", count: 15 },
        ],
        aes({ x: "category", y: "count" }),
      )
        .geomCol()
        .spec(),
    );
    const first = (() => {
      for (let id = 0; id < colModel.candidates.size; id++) {
        const candidate = colModel.candidates.candidate(id);
        if (candidate?.rowIndex === 0) return candidate;
      }
      throw new Error("missing col candidate");
    })();
    const { value, destroy } = withFlushedEffectRoot(() =>
      createSemanticCandidateProjection({
        model: () => colModel,
        candidateSemanticKeys: () => [],
        selectedKeys: () => [],
        intervalKeys: () => [],
        intervals: () => [],
        emphasisKeys: () => [],
        muteSiblingsOnInspect: () => false,
        inspectionFocus: () => ({
          sourceKeys: [],
          key: null,
          kind: first.kind,
          primitives: [
            {
              batchIndex: first.batchIndex,
              primitiveIndex: first.primitiveIndex,
            },
          ],
        }),
      }),
    );

    expect(first.kind).toBe("rects");
    expect(value.interactionMasks).toEqual([]);
    destroy();
  });

  it("builds interaction masks from keyless rect inspection when muteSiblings is on", () => {
    const colModel = modelFor(
      gg(
        [
          { category: "A", count: 10 },
          { category: "B", count: 20 },
          { category: "C", count: 15 },
        ],
        aes({ x: "category", y: "count" }),
      )
        .geomCol()
        .spec(),
    );
    const first = (() => {
      for (let id = 0; id < colModel.candidates.size; id++) {
        const candidate = colModel.candidates.candidate(id);
        if (candidate?.rowIndex === 0) return candidate;
      }
      throw new Error("missing col candidate");
    })();
    const { value, destroy } = withFlushedEffectRoot(() =>
      createSemanticCandidateProjection({
        model: () => colModel,
        candidateSemanticKeys: () => [],
        selectedKeys: () => [],
        intervalKeys: () => [],
        intervals: () => [],
        emphasisKeys: () => [],
        muteSiblingsOnInspect: () => true,
        inspectionFocus: () => ({
          sourceKeys: [],
          key: null,
          kind: first.kind,
          primitives: [
            {
              batchIndex: first.batchIndex,
              primitiveIndex: first.primitiveIndex,
            },
          ],
        }),
      }),
    );

    expect(first.kind).toBe("rects");
    expect(value.interactionMasks.some((mask) => mask !== null)).toBe(true);
    const mask = value.interactionMasks.find((entry) => entry !== null);
    expect(mask?.focusedCount).toBe(1);
    destroy();
  });

  it("layers keyless rect seed primitives under legend emphasis when muteSiblings is off (#633)", () => {
    const colModel = modelFor(
      gg(
        [
          { category: "A", count: 10 },
          { category: "B", count: 20 },
          { category: "C", count: 15 },
        ],
        aes({ x: "category", y: "count" }),
      )
        .geomCol()
        .spec(),
    );
    const first = (() => {
      for (let id = 0; id < colModel.candidates.size; id++) {
        const candidate = colModel.candidates.candidate(id);
        if (candidate?.rowIndex === 0) return candidate;
      }
      throw new Error("missing col candidate");
    })();
    const { value, destroy } = withFlushedEffectRoot(() =>
      createSemanticCandidateProjection({
        model: () => colModel,
        // No candidate has the emphasis key — only the rect seed should focus.
        candidateSemanticKeys: () => [],
        selectedKeys: () => [],
        intervalKeys: () => [],
        intervals: () => [],
        emphasisKeys: () => ["legend-only"],
        // Emphasis alone still layers rect seeds (#386); muteSiblings stays off.
        muteSiblingsOnInspect: () => false,
        inspectionFocus: () => ({
          sourceKeys: [],
          key: null,
          kind: first.kind,
          primitives: [
            {
              batchIndex: first.batchIndex,
              primitiveIndex: first.primitiveIndex,
            },
          ],
        }),
      }),
    );

    const mask = value.interactionMasks.find((entry) => entry !== null);
    expect(mask).toBeDefined();
    expect(mask?.isFocused(first.primitiveIndex)).toBe(true);
    expect(mask?.focusedCount).toBe(1);
    destroy();
  });

  it("unions key-based masks with rect inspection seed primitives", () => {
    // When legend emphasis matches real candidates AND inspection seeds a
    // different rect, both stay focused (OR merge of the two mask sources).
    const colModel = modelFor(
      gg(
        [
          { category: "A", count: 10 },
          { category: "B", count: 20 },
          { category: "C", count: 15 },
        ],
        aes({ x: "category", y: "count" }),
      )
        .geomCol()
        .spec(),
    );
    const byRow = (rowIndex: number) => {
      for (let id = 0; id < colModel.candidates.size; id++) {
        const candidate = colModel.candidates.candidate(id);
        if (candidate?.rowIndex === rowIndex) return candidate;
      }
      throw new Error(`missing col candidate for row ${String(rowIndex)}`);
    };
    const first = byRow(0);
    const second = byRow(1);
    const keysForCol = (candidate: CandidateFacts): PropertyKey[] =>
      candidate.rowIndex === null ? [] : [String(candidate.rowIndex)];
    const { value, destroy } = withFlushedEffectRoot(() =>
      createSemanticCandidateProjection({
        model: () => colModel,
        candidateSemanticKeys: keysForCol,
        selectedKeys: () => [],
        intervalKeys: () => [],
        intervals: () => [],
        // Emphasis key matches row 0; inspection seeds row 1's primitive.
        emphasisKeys: () => ["0"],
        muteSiblingsOnInspect: () => true,
        inspectionFocus: () => ({
          sourceKeys: [],
          key: null,
          kind: second.kind,
          primitives: [
            {
              batchIndex: second.batchIndex,
              primitiveIndex: second.primitiveIndex,
            },
          ],
        }),
      }),
    );

    expect(first.kind).toBe("rects");
    const mask = value.interactionMasks.find((entry) => entry !== null);
    expect(mask).toBeDefined();
    expect(mask?.isFocused(first.primitiveIndex)).toBe(true);
    expect(mask?.isFocused(second.primitiveIndex)).toBe(true);
    expect(mask?.focusedCount).toBeGreaterThanOrEqual(2);
    destroy();
  });

  it("keeps key masks for batches that rect inspection does not touch", () => {
    // Dual-geom scene: emphasis keys land on points; rect seed is only on cols.
    // unionInteractionMasks must preserve the key-only batch (b === null path).
    const dualModel = modelFor(
      gg(
        [
          { category: "A", count: 10, y2: 1 },
          { category: "B", count: 20, y2: 2 },
          { category: "C", count: 15, y2: 3 },
        ],
        aes({ x: "category", y: "count" }),
      )
        .geomCol()
        .geomPoint({ aes: { y: "y2" } })
        .spec(),
    );
    const rectCandidate = (() => {
      for (let id = 0; id < dualModel.candidates.size; id++) {
        const candidate = dualModel.candidates.candidate(id);
        if (candidate?.kind === "rects" && candidate.rowIndex === 0) return candidate;
      }
      throw new Error("missing rect candidate");
    })();
    const pointCandidate = (() => {
      for (let id = 0; id < dualModel.candidates.size; id++) {
        const candidate = dualModel.candidates.candidate(id);
        if (candidate?.kind === "points" && candidate.rowIndex === 1) return candidate;
      }
      throw new Error("missing point candidate");
    })();
    const keysForDual = (candidate: CandidateFacts): PropertyKey[] => {
      if (candidate.kind === "points" && candidate.rowIndex === 1) return ["point-1"];
      return [];
    };
    const { value, destroy } = withFlushedEffectRoot(() =>
      createSemanticCandidateProjection({
        model: () => dualModel,
        candidateSemanticKeys: keysForDual,
        selectedKeys: () => [],
        intervalKeys: () => [],
        intervals: () => [],
        emphasisKeys: () => ["point-1"],
        muteSiblingsOnInspect: () => true,
        inspectionFocus: () => ({
          sourceKeys: [],
          key: null,
          kind: rectCandidate.kind,
          primitives: [
            {
              batchIndex: rectCandidate.batchIndex,
              primitiveIndex: rectCandidate.primitiveIndex,
            },
          ],
        }),
      }),
    );

    expect(pointCandidate.batchIndex).not.toBe(rectCandidate.batchIndex);
    const pointMask = value.interactionMasks[pointCandidate.batchIndex];
    const rectMask = value.interactionMasks[rectCandidate.batchIndex];
    expect(pointMask?.isFocused(pointCandidate.primitiveIndex)).toBe(true);
    expect(rectMask?.isFocused(rectCandidate.primitiveIndex)).toBe(true);
    destroy();
  });
});

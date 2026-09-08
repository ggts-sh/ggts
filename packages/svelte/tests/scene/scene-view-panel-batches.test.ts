/**
 * SceneView routes batches to panels by bucketing once, not by testing every
 * batch against every panel. Batch count itself grows with panel count (the
 * pipeline emits per layer per panel), so the nested form was ~O(L x P^2).
 */
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";

import type { GeometryBatch, Scene } from "@ggts-sh/core";

import SceneView from "../../src/lib/scene/SceneView.svelte";
import { render } from "../helpers/render.js";

function pointsBatch(panelIndex: number, layerIndex: number): GeometryBatch {
  return fromAny<GeometryBatch>({
    kind: "points",
    layerIndex,
    panelIndex,
    positions: Float32Array.from([1, 1]),
    rowIndex: Uint32Array.from([0]),
    size: 2,
    alpha: 1,
    shape: "circle",
    fill: "red",
  });
}

function panel(index: number): unknown {
  return {
    id: `panel-${index}`,
    x: index * 20,
    y: 0,
    width: 18,
    height: 18,
    strip: "",
    axisX: null,
    axisY: null,
    grid: { x: [], y: [] },
    clip: false,
  };
}

function sceneWith(panelCount: number, batches: GeometryBatch[]): Scene {
  return fromAny<Scene>({
    width: panelCount * 20,
    height: 20,
    panels: Array.from({ length: panelCount }, (_, i) => panel(i)),
    batches,
    legends: [],
    theme: {
      ink: "black",
      accent: "blue",
      paper: "none",
      panel: "none",
      interactionMuted: 0.35,
      fontFamily: "sans-serif",
      fontSize: 12,
      fontWeight: 400,
      gridX: false,
      gridY: false,
      showPanelBorder: false,
    },
    axes: { x: { ticks: [], title: "" }, y: { ticks: [], title: "" } },
    title: "",
    subtitle: "",
    caption: "",
  });
}

/** Marks actually rendered under each `data-panel` group, in document order. */
function markLayersByPanel(container: HTMLElement): number[][] {
  return [...container.querySelectorAll("[data-panel]")].map((group) =>
    [...group.querySelectorAll<HTMLElement>(".gg-batch")].map((node) =>
      Number(node.dataset["layer"]),
    ),
  );
}

describe("SceneView panel routing", () => {
  it("places each batch under its own panel, keeping global order within a panel", () => {
    // Interleaved so per-panel order cannot be read off the input order alone.
    const batches = [
      pointsBatch(1, 0),
      pointsBatch(0, 1),
      pointsBatch(1, 2),
      pointsBatch(0, 3),
      pointsBatch(2, 4),
    ];
    const { container } = render(SceneView, { props: { scene: sceneWith(3, batches) } });
    expect(markLayersByPanel(container)).toEqual([[1, 3], [0, 2], [4]]);
  });

  it("renders nothing for a batch whose panelIndex is out of range or not an index", () => {
    const batches = [
      pointsBatch(0, 0),
      pointsBatch(5, 1), // beyond the panel count
      pointsBatch(-1, 2),
      pointsBatch(Number.NaN, 3),
      fromAny<GeometryBatch>({ ...pointsBatch(0, 4), panelIndex: 1.5 }),
    ];
    const { container } = render(SceneView, { props: { scene: sceneWith(2, batches) } });
    expect(markLayersByPanel(container)).toEqual([[0], []]);
  });

  /** Batch-list element reads taken while rendering `panelCount` panels. */
  function readsForPanelCount(panelCount: number, batchCount: number): number {
    const raw = Array.from({ length: batchCount }, (_, i) => pointsBatch(i % panelCount, i));
    let reads = 0;
    const counted = new Proxy(raw, {
      get(target, prop) {
        if (typeof prop === "string" && /^\d+$/.test(prop)) reads += 1;
        return Reflect.get(target, prop) as unknown;
      },
    });
    const { container } = render(SceneView, {
      props: { scene: sceneWith(panelCount, counted) },
    });
    expect(container.querySelectorAll(".gg-batch")).toHaveLength(batchCount);
    return reads;
  }

  it("reads the batch list the same number of times however many panels there are", () => {
    // This is the property, not a magic bound: the nested form read the list
    // once per (panel, batch) pair, so reads tracked panel count exactly
    // (2 panels 48, 4 panels 96, 24 panels 576 for 24 batches). Bucketing
    // walks it once, so the count must not move with panel count.
    const few = readsForPanelCount(2, 24);
    const many = readsForPanelCount(24, 24);
    expect(few).toBeGreaterThan(0);
    expect(many).toBe(few);
    // One pass over the list, so reads track batch count rather than panels.
    expect(few).toBeLessThanOrEqual(2 * 24);
  });

  it("reuses mark nodes when the scene object is replaced with the same batches", () => {
    // Only the wrapper Scene changes; the batch objects survive. The keyed each
    // holds the batch itself, so a rebucket must not remount anything.
    const batches = [pointsBatch(0, 0), pointsBatch(1, 1), pointsBatch(0, 2)];
    const { container, rerender } = render(SceneView, {
      props: { scene: sceneWith(2, batches) },
    });
    const before = [...container.querySelectorAll(".gg-batch")];
    expect(before).toHaveLength(3);

    void rerender({ scene: sceneWith(2, batches) });

    const after = [...container.querySelectorAll(".gg-batch")];
    expect(after).toHaveLength(3);
    expect(after.every((node, i) => node === before[i])).toBe(true);
  });

  it("aligns focus masks with the original batch index for a reordered subset", () => {
    // The bucket carries original indices precisely so masks stay aligned when
    // the batches prop is a reordered subset of scene.batches.
    const a = pointsBatch(0, 0);
    const b = pointsBatch(1, 1);
    const c = pointsBatch(0, 2);
    const scene = sceneWith(2, [a, b, c]);
    const mask = (focused: boolean) =>
      fromAny({ primitiveCount: 1, focusedCount: focused ? 1 : 0, isFocused: () => focused });
    // Masks are given in scene order (a, b, c) and projected onto the rendered
    // list by identity; only c is focused. Render order b,c,a puts panel 0's
    // batches at positions 1 and 2, so the original index and the position
    // within the panel cannot coincide.
    const focusMasks = [mask(false), mask(false), mask(true)];
    const { container } = render(SceneView, {
      props: { scene, mode: "marks", batches: [b, c, a], focusMasks },
    });
    const rendered = [...container.querySelectorAll<HTMLElement>(".gg-batch")];
    // Panel 0 first (c then a), then panel 1 (b).
    expect(rendered.map((node) => Number(node.dataset["layer"]))).toEqual([2, 0, 1]);
    // Batch stamps data-gg-focused per mark from its mask. c is focused and a
    // is not; reading the mask by render position rather than original index
    // reports both unfocused.
    const focusedFlags = rendered.map((node) =>
      [...node.querySelectorAll<HTMLElement>("[data-gg-focused]")].map(
        (mark) => mark.dataset["ggFocused"],
      ),
    );
    expect(focusedFlags).toEqual([["true"], ["false"], ["false"]]);
  });
});

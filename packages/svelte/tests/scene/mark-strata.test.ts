import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";

import type { GeometryBatch, RenderModel, Stratum } from "@ggts-sh/core";

import MarkStrata from "../../src/lib/scene/MarkStrata.svelte";
import { render } from "../helpers/render.js";

function model(partial: {
  runId?: number;
  width?: number;
  height?: number;
  batches?: GeometryBatch[];
}): RenderModel {
  return fromAny<RenderModel>({
    runId: partial.runId ?? 1,
    scene: {
      width: partial.width ?? 80,
      height: partial.height ?? 40,
      theme: {
        interactionMuted: 0.35,
        paper: "none",
        fontFamily: "sans-serif",
        fontSize: 12,
        fontWeight: 400,
      },
      panels: [],
      batches: partial.batches ?? [],
      axes: {
        x: { ticks: [], title: "" },
        y: { ticks: [], title: "" },
      },
      legends: [],
      title: "",
      subtitle: "",
      caption: "",
    },
    layerBackends: [],
    candidates: { size: 0, candidate: () => null },
  });
}

const emptySvgStratum: Stratum = {
  backend: "svg",
  batches: [],
};

const emptyCanvasStratum: Stratum = {
  backend: "canvas",
  batches: [],
};

describe("MarkStrata", () => {
  it("renders a single full SceneView for svg-only strata (no canvas sandwich)", () => {
    const { container } = render(MarkStrata, {
      model: model({}),
      strata: [emptySvgStratum],
      markLabel: () => "m",
      interactionMasks: [],
      a11yTableOpen: false,
      onA11yToggle: () => {},
      onPainted: () => {},
    });
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".gg-svg-chrome-bottom")).toBeNull();
    expect(container.querySelector(".gg-plot")).not.toBeNull();
  });

  it("preserves document-order sandwich for interleaved canvas/svg strata", () => {
    const { container } = render(MarkStrata, {
      model: model({}),
      strata: [emptyCanvasStratum, emptySvgStratum, emptyCanvasStratum],
      markLabel: () => "m",
      interactionMasks: [],
      a11yTableOpen: false,
      onA11yToggle: () => {},
      onPainted: () => {},
    });
    const root = container;
    const ordered = [
      ...root.querySelectorAll(
        ".gg-svg-chrome-bottom, canvas.gg-canvas, .gg-svg-marks, .gg-svg-chrome-top",
      ),
    ].map((el) => {
      if (el instanceof HTMLCanvasElement) return "canvas";
      if (el.classList.contains("gg-svg-chrome-bottom")) return "chrome-bottom";
      if (el.classList.contains("gg-svg-marks")) return "marks";
      if (el.classList.contains("gg-svg-chrome-top")) return "chrome-top";
      return el.className;
    });
    expect(ordered).toEqual(["chrome-bottom", "canvas", "marks", "canvas", "chrome-top"]);
    expect(root.querySelectorAll("canvas.gg-canvas").length).toBe(2);
    expect(root.querySelectorAll(".gg-canvas-a11y").length).toBe(2);
  });

  it("does not call onPainted when canvas 2d context is unavailable", () => {
    const onPainted = vi.fn();
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    try {
      render(MarkStrata, {
        model: model({ runId: 9 }),
        strata: [emptyCanvasStratum],
        markLabel: () => "m",
        interactionMasks: [],
        a11yTableOpen: false,
        onA11yToggle: () => {},
        onPainted,
      });
      expect(onPainted).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("notifies onPainted with canvas:${si} keys after successful paint", async () => {
    const onPainted = vi.fn<(runId: number, stratumKey: string) => void>();
    render(MarkStrata, {
      model: model({ runId: 3 }),
      strata: [emptyCanvasStratum, emptySvgStratum, emptyCanvasStratum],
      markLabel: () => "m",
      interactionMasks: [],
      a11yTableOpen: false,
      onA11yToggle: () => {},
      onPainted,
    });
    // Attachment runs synchronously in testing-library render for attach.
    await Promise.resolve();
    expect(onPainted).toHaveBeenCalled();
    const keys = onPainted.mock.calls.map((call) => call[1]);
    expect(keys).toContain("canvas:0");
    expect(keys).toContain("canvas:2");
    expect(keys).not.toContain("canvas:1");
    for (const [runId] of onPainted.mock.calls) {
      expect(runId).toBe(3);
    }
  });

  it("repaints canvas when document theme attributes flip", async () => {
    const onPainted = vi.fn<(runId: number, stratumKey: string) => void>();
    try {
      render(MarkStrata, {
        model: model({ runId: 1 }),
        strata: [emptyCanvasStratum],
        markLabel: () => "m",
        interactionMasks: [],
        a11yTableOpen: false,
        onA11yToggle: () => {},
        onPainted,
      });
      await Promise.resolve();
      const afterMount = onPainted.mock.calls.length;
      expect(afterMount).toBeGreaterThan(0);
      document.documentElement.dataset["theme"] = "dark";
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
      await Promise.resolve();
      // Theme observer bumps themeEpoch → attachment re-runs → successful paint notifies.
      expect(onPainted.mock.calls.length).toBeGreaterThan(afterMount);
    } finally {
      delete document.documentElement.dataset["theme"];
    }
  });
});

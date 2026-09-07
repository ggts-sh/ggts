import { describe, expect, it, vi } from "vitest";

import type { RenderModel } from "@ggsvelte/core";
import GGPlot from "../../src/lib/GGPlot.svelte";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";
import { requireModel, rows, size } from "./interaction-harness.js";

describe("hover + tooltip (overlays, never a pipeline re-run)", () => {
  /**
   * Map plot-pixel coordinates onto the capture surface. Uses the live SVG
   * width/height so container-responsive and non-`size` plots hit correctly
   * under exact inspection (hardcoded 480×320 scaled misses after layout
   * chrome changes).
   */
  function pointerMoveAt(capture: Element, x: number, y: number): void {
    const rect = capture.getBoundingClientRect();
    const svg = capture.ownerDocument?.querySelector("svg.gg-plot");
    const plotW = Number(svg?.getAttribute("width")) || size.width;
    const plotH = Number(svg?.getAttribute("height")) || size.height;
    capture.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: rect.left + (x / plotW) * rect.width,
        clientY: rect.top + (y / plotH) * rect.height,
        bubbles: true,
      }),
    );
  }

  it("hover resolves the correct row across strata; tooltip shows mapped values", async () => {
    let model: RenderModel | null = null;
    const onrender = vi.fn((m: RenderModel) => {
      model = m;
    });
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y", color: "cls" },
      // The SAME data drawn twice: svg line UNDER canvas points — the hit
      // index resolves canvas-painted marks through the capture layer, and
      // topmost-wins picks the point layer over the line beneath it.
      layers: [
        {
          geom: "line",
          render: "svg",
          aes: { color: null },
          params: { linewidth: 0.5 },
        },
        { geom: "point", render: "canvas", params: { size: 5 } },
      ],
      inspect: true,
      onrender,
      ...size,
    });
    const renderCount = onrender.mock.calls.length;
    const m: RenderModel = model!;
    const scene = m.scene;
    const panel = scene.panels[0];
    if (panel === undefined) throw new Error("expected a panel");
    const batch = scene.batches.find((b) => b.kind === "points");
    if (batch === undefined || batch.kind !== "points") throw new Error("unreachable");
    const capture = container.querySelector(".gg-capture")!;

    // Hover the third point (source row 2: x 3, y 15, cls a).
    const px = panel.x + (batch.positions[4] ?? 0);
    const py = panel.y + (batch.positions[5] ?? 0);
    pointerMoveAt(capture, px, py);
    await until(() => container.querySelector(".gg-tooltip") !== null);
    const tooltip = container.querySelector(".gg-tooltip")!;
    expect(tooltip.textContent).toContain("x");
    expect(tooltip.textContent).toContain("3");
    expect(tooltip.textContent).toContain("15");
    expect(tooltip.textContent).toContain("a");
    // Hover highlight overlay is present…
    expect(container.querySelector(".gg-hover-ring")).not.toBeNull();
    // …and the pipeline did NOT re-run for hover (overlay-only contract).
    expect(onrender.mock.calls.length).toBe(renderCount);
    expect(model).toBe(m);

    // Miss: move to empty corner -> tooltip clears.
    pointerMoveAt(capture, -100, -100);
    await until(() => container.querySelector(".gg-tooltip") === null);
  });

  it("geom_col hover shows tooltip without sibling mute by default (#633)", async () => {
    let model: RenderModel | null = null;
    const colRows = [
      { category: "A", count: 7030 },
      { category: "B", count: 2100 },
      { category: "C", count: 1800 },
    ];
    const { container } = render(GGPlot, {
      data: colRows,
      aes: { x: "category", y: "count" },
      layers: [{ geom: "col" }],
      inspect: true,
      onrender: (m: RenderModel) => {
        model = m;
      },
      ...size,
    });
    const m = requireModel(model);
    let seed = m.candidates.candidate(0);
    for (let id = 0; id < m.candidates.size; id++) {
      const candidate = m.candidates.candidate(id);
      if (candidate?.kind === "rects") {
        seed = candidate;
        break;
      }
    }
    if (seed === null || seed.kind !== "rects") throw new Error("expected rect candidate");
    const capture = container.querySelector(".gg-capture")!;
    pointerMoveAt(capture, seed.x, seed.y);
    await until(() => container.querySelector(".gg-tooltip") !== null);
    // #386: still no point ring on rects
    expect(container.querySelector(".gg-hover-ring")).toBeNull();
    // #633: default is tooltip-only — no focus-mask de-emphasis flicker
    expect(container.querySelectorAll(".gg-rects rect[data-gg-focused]")).toHaveLength(0);
    for (const rect of container.querySelectorAll(".gg-rects rect")) {
      expect(rect.getAttribute("opacity")).toBeNull();
    }
  });

  it("geom_col hover mutes siblings when inspect.muteSiblings is true (#633)", async () => {
    let model: RenderModel | null = null;
    const colRows = [
      { category: "A", count: 7030 },
      { category: "B", count: 2100 },
      { category: "C", count: 1800 },
    ];
    const { container } = render(GGPlot, {
      data: colRows,
      aes: { x: "category", y: "count" },
      layers: [{ geom: "col" }],
      inspect: { muteSiblings: true },
      onrender: (m: RenderModel) => {
        model = m;
      },
      ...size,
    });
    const m = requireModel(model);
    let seed = m.candidates.candidate(0);
    for (let id = 0; id < m.candidates.size; id++) {
      const candidate = m.candidates.candidate(id);
      if (candidate?.kind === "rects") {
        seed = candidate;
        break;
      }
    }
    if (seed === null || seed.kind !== "rects") throw new Error("expected rect candidate");
    const capture = container.querySelector(".gg-capture")!;
    pointerMoveAt(capture, seed.x, seed.y);
    await until(() => container.querySelector(".gg-tooltip") !== null);
    expect(container.querySelector(".gg-hover-ring")).toBeNull();
    await until(
      () => container.querySelectorAll(".gg-rects rect[data-gg-focused='true']").length === 1,
    );
    const focused = container.querySelectorAll(".gg-rects rect[data-gg-focused='true']");
    const muted = container.querySelectorAll(".gg-rects rect[data-gg-focused='false']");
    expect(focused).toHaveLength(1);
    expect(muted).toHaveLength(2);
    expect(focused[0]?.getAttribute("opacity")).toBeNull();
    for (const rect of muted) {
      expect(Number(rect.getAttribute("opacity"))).toBeLessThan(1);
    }
  });

  it("stacked area hover shows no point ring — closed fills are region marks (#1270)", async () => {
    let model: RenderModel | null = null;
    const areaRows = [
      { x: 0, y: 3, g: "a" },
      { x: 1, y: 3, g: "a" },
      { x: 2, y: 3, g: "a" },
      { x: 0, y: 2, g: "b" },
      { x: 1, y: 2, g: "b" },
      { x: 2, y: 2, g: "b" },
    ];
    const { container } = render(GGPlot, {
      data: areaRows,
      aes: { x: "x", y: "y", fill: "g" },
      layers: [{ geom: "area" }],
      inspect: true,
      onrender: (m: RenderModel) => {
        model = m;
      },
      ...size,
    });
    const m = requireModel(model);
    let seed = null;
    for (let id = 0; id < m.candidates.size; id++) {
      const candidate = m.candidates.candidate(id);
      if (candidate?.kind === "paths") {
        seed = candidate;
        break;
      }
    }
    if (seed === null) throw new Error("expected a paths candidate");
    const capture = container.querySelector(".gg-capture")!;
    pointerMoveAt(capture, seed.x, seed.y);
    await until(() => container.querySelector(".gg-tooltip") !== null);
    expect(container.querySelector(".gg-hover-ring")).toBeNull();
    // Pinning the same band must not resurrect the point ring either.
    capture.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await until(() => container.querySelector(".gg-tooltip-pinned") !== null);
    expect(container.querySelector(".gg-hover-ring")).toBeNull();
  });

  it("line hover keeps the point ring — open strokes anchor at a vertex (#1270)", async () => {
    let model: RenderModel | null = null;
    const lineRows = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 2 },
    ];
    const { container } = render(GGPlot, {
      data: lineRows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "line" }],
      inspect: true,
      onrender: (m: RenderModel) => {
        model = m;
      },
      ...size,
    });
    const m = requireModel(model);
    let seed = null;
    for (let id = 0; id < m.candidates.size; id++) {
      const candidate = m.candidates.candidate(id);
      if (candidate?.kind === "paths") {
        seed = candidate;
        break;
      }
    }
    if (seed === null) throw new Error("expected a paths candidate");
    const capture = container.querySelector(".gg-capture")!;
    pointerMoveAt(capture, seed.x, seed.y);
    await until(() => container.querySelector(".gg-tooltip") !== null);
    expect(container.querySelector(".gg-hover-ring")).not.toBeNull();
  });

  it("exact stacked bars show a Total row when tooltipTotal is bottom", async () => {
    let model: RenderModel | null = null;
    const stacked = [
      { bag: "A", count: 1, type: "Orden" },
      { bag: "A", count: 2, type: "Resolución" },
      { bag: "A", count: 3, type: "Decreto" },
    ];
    const { container } = render(GGPlot, {
      data: stacked,
      aes: { x: "bag", y: "count", fill: "type" },
      layers: [{ geom: "col", position: "stack" }],
      inspect: { mode: "exact", tooltipTotal: "bottom" },
      onrender: (m: RenderModel) => {
        model = m;
      },
      ...size,
    });
    const m = requireModel(model);
    let seed = m.candidates.candidate(0);
    for (let id = 0; id < m.candidates.size; id++) {
      const candidate = m.candidates.candidate(id);
      if (candidate?.kind === "rects") {
        seed = candidate;
        break;
      }
    }
    if (seed === null || seed.kind !== "rects") throw new Error("expected rect candidate");
    const capture = container.querySelector(".gg-capture")!;
    pointerMoveAt(capture, seed.x, seed.y);
    await until(() => container.querySelector(".gg-tooltip") !== null);
    expect(container.querySelector(".gg-tooltip-axis")).toBeNull();
    const total = container.querySelector(".gg-tooltip-total");
    expect(total).not.toBeNull();
    expect(total?.textContent).toContain("Total");
    expect(total?.textContent).toContain("6");
    const members = container.querySelector(".gg-tooltip-members")!;
    expect(members.lastElementChild).toBe(total);
  });

  it("exact stacked bars omit Total under auto without forcing mode x", async () => {
    let model: RenderModel | null = null;
    const stacked = [
      { bag: "A", count: 1, type: "Orden" },
      { bag: "A", count: 2, type: "Resolución" },
    ];
    const { container } = render(GGPlot, {
      data: stacked,
      aes: { x: "bag", y: "count", fill: "type" },
      layers: [{ geom: "col", position: "stack" }],
      inspect: { mode: "exact" },
      onrender: (m: RenderModel) => {
        model = m;
      },
      ...size,
    });
    const m = requireModel(model);
    const seed = m.candidates.candidate(0);
    if (seed === null) throw new Error("expected candidate");
    pointerMoveAt(container.querySelector(".gg-capture")!, seed.x, seed.y);
    await until(() => container.querySelector(".gg-tooltip") !== null);
    expect(container.querySelector(".gg-tooltip-total")).toBeNull();
  });
});

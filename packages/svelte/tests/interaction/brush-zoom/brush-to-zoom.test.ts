import { describe, expect, it } from "vitest";
import { withGrammarAsSpec } from "../../helpers/ggplot-input.js";

import type { RenderModel } from "@ggts-sh/core";
import GGPlot from "../../../src/lib/GGPlot.svelte";
import { render } from "../../helpers/render.js";
import { until } from "../../helpers/until.js";
import { drag, rows, size, requireModel } from "../interaction-harness.js";

describe("brush-to-zoom", () => {
  it("starts zoom from precise bounds and preserves pointer modality", async () => {
    const zooms: Array<{ source: string; domains: unknown }> = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      zoom: { mode: "x" },
      onzoom: (event: { source: string; domains: unknown }) => zooms.push(event),
      ...size,
    });
    const setBounds = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent?.trim() === "Set x zoom bounds")!;
    setBounds.click();
    await until(() => container.querySelector('.gg-bounds-editor input[id$="-lower"]') !== null);
    const [lower, upper] = [
      ...container.querySelectorAll<HTMLInputElement>(".gg-bounds-editor input"),
    ];
    lower.value = "1.5";
    lower.dispatchEvent(new InputEvent("input", { bubbles: true }));
    upper.value = "2.5";
    upper.dispatchEvent(new InputEvent("input", { bubbles: true }));
    const apply = container.querySelector<HTMLButtonElement>(
      '.gg-bounds-editor button[type="submit"]',
    )!;
    apply.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerType: "touch",
      }),
    );
    apply.click();
    await until(() => zooms.length === 1);

    expect(zooms[0]).toEqual({
      type: "zoom",
      phase: "end",
      source: "touch",
      domains: { x: [1.5, 2.5] },
    });
  });

  it("brush zoom replaces explicit coordinate limits with the brushed viewport", async () => {
    let model: RenderModel | null = null;
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: [1, 10, 100, 1000].map((x) => ({ x, y: 1 })),
        aes: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
        scales: { x: { type: "linear", domain: [1, 1000], expand: { mult: 0, add: 0 } } },
        coord: {
          type: "transform",
          x: { transform: "log10", limits: [1, 1000], expand: false },
        },
        zoom: { mode: "x" },
        onrender: (next: RenderModel) => {
          model = next;
        },
        ...size,
      }),
    );
    await until(() => model !== null);
    const before = requireModel(model);
    const panel = before.scene.panels[0];
    const capture = container.querySelector(".gg-capture")!;
    const zoomArea = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent === "Zoom area")!;
    zoomArea.click();
    await until(() => zoomArea.getAttribute("aria-pressed") === "true");
    drag(
      capture,
      panel.x + panel.width / 3,
      panel.y,
      panel.x + (panel.width * 2) / 3,
      panel.y + panel.height,
    );
    await until(() => model !== before);

    const after = requireModel(model);
    if (after.scales.x.type === "band") throw new Error("expected continuous x scale");
    expect(after.scales.x.domain[0]).toBeCloseTo(10, 4);
    expect(after.scales.x.domain[1]).toBeCloseTo(100, 4);
    expect(after.coordProjectors[0].x.coordinateDomain[0]).toBeCloseTo(1, 4);
    expect(after.coordProjectors[0].x.coordinateDomain[1]).toBeCloseTo(2, 4);
  });

  it("brush-to-zoom respecs explicit domains; colors NEVER shift; double-click resets", async () => {
    let model: RenderModel | null = null;
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y", color: "cls" },
      layers: [{ geom: "point" }],
      zoom: true,
      inspect: true,
      onrender: (m: RenderModel) => {
        model = m;
      },
      ...size,
    });
    const before = model!;
    // Mark circles only — colour legends also draw circle keys.
    const markCircles = () => [...container.querySelectorAll(".gg-points circle")];
    const fillsByClass = () => {
      const fills = markCircles().map((c) => c.getAttribute("fill") ?? "");
      return fills;
    };
    const initialFills = fillsByClass();
    expect(new Set(initialFills).size).toBe(2);

    const panel = before.scene.panels[0];
    const capture = container.querySelector(".gg-capture")!;
    [...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button")]
      .find((button) => button.textContent === "Zoom area")!
      .click();
    // Zoom into the right half (x in ~[2.5, 4]) -> rows 0 (x=1) drops out.
    drag(
      capture,
      panel.x + panel.width * 0.55,
      panel.y,
      panel.x + panel.width,
      panel.y + panel.height,
    );
    await until(() => model !== before && model !== null);
    const after = model!;
    expect(after.runId).toBeGreaterThan(before.runId);
    expect(after.domains.baseline).toEqual(before.domains.effective);
    expect(after.domains.effective).not.toEqual(after.domains.baseline);
    // The x domain narrowed (explicit domain respec via scale inversion).
    const beforeX = (before.scales.x as { domain: [number, number] }).domain;
    const afterX = (after.scales.x as { domain: [number, number] }).domain;
    expect(afterX[0]).toBeGreaterThan(beforeX[0]);
    // Scale limits now censor before stats, so out-of-domain points are
    // removed rather than retained at clipped negative pixels.
    expect(markCircles().length).toBeLessThan(initialFills.length);
    // Every surviving series keeps its existing assignment (prevScales flows
    // through the natural-baseline and effective runs).
    const initialFillSet = new Set(initialFills);
    expect(fillsByClass().every((fill) => initialFillSet.has(fill))).toBe(true);

    // Double-click resets the zoom.
    capture.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await until(() => markCircles().every((c) => Number(c.getAttribute("cx")) >= 0));
    expect(fillsByClass()).toEqual(initialFills);
  });
});

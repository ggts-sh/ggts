import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";
import GGPlot from "../../src/lib/GGPlot.svelte";
import { withGrammarAsSpec } from "../helpers/ggplot-input.js";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";
import { rows, size } from "./interaction-harness.js";

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

  it("clears transient inspection when a new layout model commits", async () => {
    let model: RenderModel | null = null;
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      inspect: true,
      width: "container",
      height: 300,
      onrender: (next: RenderModel) => (model = next),
    });
    container.style.width = "400px";
    await until(() => container.querySelector("svg.gg-plot")?.getAttribute("width") === "400");
    const seed = model!.candidates.candidate(0)!;
    pointerMoveAt(container.querySelector(".gg-capture")!, seed.x, seed.y);
    await until(() => container.querySelector(".gg-tooltip") !== null);
    const priorModel = model;
    container.style.width = "600px";
    await until(
      () =>
        container.querySelector("svg.gg-plot")?.getAttribute("width") === "600" &&
        model !== priorModel,
    );
    await until(() => container.querySelector(".gg-tooltip") === null);
  });

  it("keeps a transient tooltip open while the pointer moves into it", async () => {
    let model: RenderModel | null = null;
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      inspect: true,
      onrender: (next: RenderModel) => (model = next),
      ...size,
    });
    const candidate = model!.candidates.candidate(0)!;
    const capture = container.querySelector(".gg-capture")!;
    pointerMoveAt(capture, candidate.x, candidate.y);
    await until(() => container.querySelector(".gg-tooltip") !== null);
    const tooltip = container.querySelector(".gg-tooltip")!;
    capture.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    tooltip.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
    expect(container.querySelector(".gg-tooltip")).not.toBeNull();
  });

  // #1069 — ThemeTufte is gridless: flat tooltip chrome (no keyline invent, no
  // "Click to pin" affordance). Default themes keep the instructional footer.
  // Theme is children/spec-only after #704 — fold via withGrammarAsSpec.
  it("tufte tooltips stay silent; default themes keep the pin affordance (#1069)", async () => {
    let tufteModel: RenderModel | null = null;
    const tuftePlot = render(
      GGPlot,
      withGrammarAsSpec({
        data: rows,
        aes: { x: "x", y: "y" },
        layers: [{ geom: "point", params: { size: 5 } }],
        theme: "tufte",
        inspect: true,
        onrender: (m: RenderModel) => {
          tufteModel = m;
        },
        ...size,
      }),
    );
    expect(tufteModel!.scene.theme.tooltipBorder).toBe("transparent");
    const tufteCandidate = tufteModel!.candidates.candidate(0)!;
    pointerMoveAt(
      tuftePlot.container.querySelector(".gg-capture")!,
      tufteCandidate.x,
      tufteCandidate.y,
    );
    await until(() => tuftePlot.container.querySelector(".gg-tooltip") !== null);
    const tufteTooltip = tuftePlot.container.querySelector(".gg-tooltip")!;
    expect(tufteTooltip.querySelector(".gg-tooltip-hint")).toBeNull();
    expect(tufteTooltip.textContent).not.toContain("Click to pin");

    let defaultModel: RenderModel | null = null;
    const defaultPlot = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point", params: { size: 5 } }],
      inspect: true,
      onrender: (m: RenderModel) => {
        defaultModel = m;
      },
      ...size,
    });
    expect(defaultModel!.scene.theme.tooltipBorder).not.toBe("transparent");
    const defaultCandidate = defaultModel!.candidates.candidate(0)!;
    pointerMoveAt(
      defaultPlot.container.querySelector(".gg-capture")!,
      defaultCandidate.x,
      defaultCandidate.y,
    );
    await until(() => defaultPlot.container.querySelector(".gg-tooltip") !== null);
    const defaultTooltip = defaultPlot.container.querySelector(".gg-tooltip")!;
    expect(defaultTooltip.querySelector(".gg-tooltip-hint")).not.toBeNull();
    expect(defaultTooltip.textContent).toContain("Click to pin");
  });

  it("omits pin affordance when inspect.pin is false (#1069)", async () => {
    let model: RenderModel | null = null;
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point", params: { size: 5 } }],
      inspect: { pin: false },
      onrender: (m: RenderModel) => {
        model = m;
      },
      ...size,
    });
    const candidate = model!.candidates.candidate(0)!;
    pointerMoveAt(container.querySelector(".gg-capture")!, candidate.x, candidate.y);
    await until(() => container.querySelector(".gg-tooltip") !== null);
    const tooltip = container.querySelector(".gg-tooltip")!;
    expect(tooltip.querySelector(".gg-tooltip-hint")).toBeNull();
    expect(tooltip.textContent).not.toContain("Click to pin");
  });
});

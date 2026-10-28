import { describe, expect, it } from "vitest";
import { withGrammarAsSpec } from "../helpers/ggplot-input.js";

import GGPlot from "../../src/lib/GGPlot.svelte";
import "../../src/lib/host-init.js";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";
import { rows, size } from "./interaction-harness.js";

describe("canvas strata (decision 0006 graduated)", () => {
  const canvasProps = {
    data: rows,
    aes: { x: "x", y: "y" },
    layers: [
      {
        geom: "point" as const,
        render: "canvas" as const,
        params: { size: 6 },
      },
    ],
    theme: "light" as const,
    ...size,
  };

  it("builds the strata sandwich and paints marks onto the canvas (readback)", async () => {
    const { container } = render(GGPlot, canvasProps);
    const root = container.querySelector<HTMLElement>(".gg-plot-root")!;
    const canvas = container.querySelector("canvas.gg-canvas");
    expect(canvas).not.toBeNull();
    // Sandwich: chrome-bottom svg BEFORE the canvas, chrome-top svg after.
    const kids = [...root.children].map((el) => el.getAttribute("class") ?? "");
    const canvasIdx = kids.findIndex((c) => c.includes("gg-canvas"));
    expect(kids.slice(0, canvasIdx).some((c) => c.includes("gg-svg-chrome-bottom"))).toBe(true);
    expect(kids.slice(canvasIdx + 1).some((c) => c.includes("gg-svg-chrome-top"))).toBe(true);
    // No SVG mark elements for the canvas layer.
    expect(container.querySelectorAll("circle")).toHaveLength(0);
    // Readiness waits for the canvas first paint.
    await until(() => root.dataset["ggReady"] === "true");
    // Pixel readback at a mark position (points batch panel-local coords).
    const el = canvas as HTMLCanvasElement;
    const ctx = el.getContext("2d", { willReadFrequently: true })!;
    const dpr = window.devicePixelRatio || 1;
    let painted = 0;
    const data = ctx.getImageData(0, 0, el.width, el.height).data;
    for (let i = 3; i < data.length; i += 4) painted += (data[i] ?? 0) > 0 ? 1 : 0;
    // Four points of radius 6 -> at least ~4 * pi * 36 device px painted.
    expect(painted).toBeGreaterThan(4 * 3 * 36 * dpr * dpr * 0.5);
  });

  it("no z-index anywhere; strata are pointer-inert", () => {
    const { container } = render(GGPlot, { ...canvasProps, inspect: true });
    const root = container.querySelector<HTMLElement>(".gg-plot-root")!;
    for (const el of root.querySelectorAll(".gg-stratum, canvas")) {
      expect(getComputedStyle(el).zIndex).toBe("auto");
      expect(getComputedStyle(el).pointerEvents).toBe("none");
    }
    const capture = root.querySelector(".gg-capture")!;
    expect(getComputedStyle(capture).pointerEvents).toBe("auto");
    expect([...root.children].indexOf(capture)).toBeGreaterThan(
      [...root.children].indexOf(root.querySelector("canvas.gg-canvas")!),
    );
  });

  it("canvas a11y block: role img + label + data table behind a toggle", async () => {
    const { container } = render(GGPlot, canvasProps);
    const block = container.querySelector(".gg-canvas-a11y")!;
    expect(block.getAttribute("role")).toBe("img");
    expect(block.getAttribute("aria-label")).toContain("canvas-rendered marks");
    const style = getComputedStyle(block);
    expect(style.display).not.toBe("none");
    expect(style.visibility).not.toBe("hidden");
    const toggle = container.querySelector<HTMLButtonElement>(".gg-a11y-toggle")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    toggle.click();
    await until(() => container.querySelector(".gg-a11y-table") !== null);
    const table = container.querySelector(".gg-a11y-table")!;
    expect(table.querySelectorAll("tbody tr")).toHaveLength(4);
    expect([...table.querySelectorAll("th")].map((t) => t.textContent)).toEqual(["x", "y"]);
  });

  it("canvas a11y open state is shared across interleaved canvas strata", async () => {
    // canvas → svg → canvas yields two canvas strata (contiguous same-backend merges).
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: rows,
        aes: { x: "x", y: "y" },
        layers: [
          { geom: "point" as const, render: "canvas" as const, params: { size: 6 } },
          { geom: "line" as const },
          { geom: "point" as const, render: "canvas" as const, params: { size: 4 } },
        ],
        theme: "light" as const,
        ...size,
      }),
    );
    const toggles = [...container.querySelectorAll<HTMLButtonElement>(".gg-a11y-toggle")];
    expect(toggles).toHaveLength(2);
    expect(toggles.every((t) => t.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(container.querySelectorAll(".gg-a11y-table")).toHaveLength(0);
    toggles[0]?.click();
    await until(() => container.querySelectorAll(".gg-a11y-table").length === 2);
    expect(
      [...container.querySelectorAll(".gg-a11y-toggle")].every(
        (t) => t.getAttribute("aria-expanded") === "true",
      ),
    ).toBe(true);
  });

  it('a11y "force-svg" keeps marks in SVG with one virtual-navigation surface', () => {
    const { container } = render(GGPlot, {
      ...canvasProps,
      a11y: "force-svg",
      inspect: true,
    });
    expect(container.querySelector("canvas")).toBeNull();
    const circles = container.querySelectorAll("circle[tabindex='0']");
    expect(circles).toHaveLength(0);
    expect(container.querySelectorAll(".gg-capture[tabindex='0']")).toHaveLength(1);
  });
});

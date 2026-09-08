import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";
import GGPlot from "../../src/lib/GGPlot.svelte";
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

  it("keyboard navigation on the single chart surface shows the tooltip", async () => {
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      inspect: true,
      ...size,
    });
    const surface = container.querySelector<HTMLElement>(".gg-capture[tabindex='0']")!;
    surface.focus();
    surface.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await until(() => container.querySelector(".gg-tooltip") !== null);
    surface.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await until(() => container.querySelector(".gg-tooltip") === null);
  });

  it("grouped x inspection emits one legend-ordered member per derived series", async () => {
    let model: RenderModel | null = null;
    const events: Array<{
      phase: string;
      mode?: string;
      members?: readonly unknown[];
      focus?: unknown;
    }> = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y", color: "cls" },
      layers: [{ geom: "line" }, { geom: "point" }],
      key: "x",
      inspect: { mode: "x" },
      oninspect: (event: {
        phase: string;
        mode?: string;
        members?: readonly unknown[];
        focus?: unknown;
      }) => events.push(event),
      onrender: (next: RenderModel) => (model = next),
      ...size,
    });
    const candidate = model!.candidates.candidate(2)!;
    pointerMoveAt(container.querySelector(".gg-capture")!, candidate.x, candidate.y);
    await until(() => events.some((event) => event.phase === "change"));
    const event = events.find((value) => value.phase === "change")!;
    expect(event.mode).toBe("x");
    expect(event.members!.length).toBeGreaterThan(0);
    expect(event.focus).toBeDefined();
  });

  it("keeps default transient snapshots bounded but materializes all members for callbacks", async () => {
    const data = Array.from({ length: 12 }, (_, index) => ({
      id: `row-${index}`,
      x: 1,
      y: index + 1,
      series: `series-${index}`,
    }));
    let defaultModel: RenderModel | null = null;
    const defaultPlot = render(GGPlot, {
      data,
      aes: { x: "x", y: "y", color: "series" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: { mode: "x" },
      onrender: (next: RenderModel) => (defaultModel = next),
      ...size,
    });
    const defaultSeed = defaultModel!.candidates.candidate(0)!;
    pointerMoveAt(
      defaultPlot.container.querySelector(".gg-capture")!,
      defaultSeed.x,
      defaultSeed.y,
    );
    await until(() => defaultPlot.container.querySelector(".gg-tooltip") !== null);
    // 8 series rows, no Total: geom_point uses identity position, so series
    // are parallel comparison, not stack composition (#1274 gate).
    // Overflow uses full group size so "+N more" still appears.
    expect(
      defaultPlot.container.querySelectorAll(".gg-tooltip-members > dl:not(.gg-tooltip-total)"),
    ).toHaveLength(8);
    expect(defaultPlot.container.querySelector(".gg-tooltip-total")).toBeNull();
    expect(defaultPlot.container.querySelector(".gg-tooltip-more")?.textContent).toMatch(
      /\+4 more/,
    );

    let callbackModel: RenderModel | null = null;
    const changes: Array<{ members: readonly unknown[] }> = [];
    const callbackPlot = render(GGPlot, {
      data,
      aes: { x: "x", y: "y", color: "series" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: { mode: "x" },
      oninspect: (event: { phase: string; members?: readonly unknown[] }) => {
        if (event.phase === "change" && event.members !== undefined)
          changes.push({ members: event.members });
      },
      onrender: (next: RenderModel) => (callbackModel = next),
      ...size,
    });
    const callbackSeed = callbackModel!.candidates.candidate(0)!;
    pointerMoveAt(
      callbackPlot.container.querySelector(".gg-capture")!,
      callbackSeed.x,
      callbackSeed.y,
    );
    await until(() => changes.length > 0);
    expect(changes[0].members).toHaveLength(12);
  });

  it("updates a pinned overlay on container resize without repeating its semantic callback", async () => {
    const data = [
      { id: "a", x: 1, y: 2 },
      { id: "b", x: 2, y: 3 },
    ];
    let model: RenderModel | null = null;
    const changes: Array<{ state?: string; source?: string }> = [];
    const { container } = render(GGPlot, {
      data,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      width: "container",
      height: 300,
      oninspect: (event: { phase: string; state?: string; source?: string }) => {
        if (event.phase === "change") changes.push(event);
      },
      onrender: (next: RenderModel) => (model = next),
    });
    container.style.width = "400px";
    await until(() => container.querySelector("svg.gg-plot")?.getAttribute("width") === "400");
    const seed = model!.candidates.candidate(0)!;
    const capture = container.querySelector(".gg-capture")!;
    pointerMoveAt(capture, seed.x, seed.y);
    await until(() => changes.length > 0);
    capture.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await until(() => changes.at(-1)?.state === "pinned");
    const callbackCount = changes.length;
    const priorModel = model;
    container.style.width = "600px";
    await until(
      () =>
        container.querySelector("svg.gg-plot")?.getAttribute("width") === "600" &&
        model !== priorModel,
    );
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
    expect(changes).toHaveLength(callbackCount);
  });
});

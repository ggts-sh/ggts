import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";

import GGPlot from "../../src/lib/GGPlot.svelte";
import InteractiveTooltipPlot from "../fixtures/InteractiveTooltipPlot.svelte";
import LongTooltipPlot from "../fixtures/LongTooltipPlot.svelte";
import ProgrammaticZoomPlot from "../fixtures/ProgrammaticZoomPlot.svelte";
import { expectAccessible } from "../helpers/accessibility.js";
import { render } from "../helpers/render.js";
import { dragArea, nextFrame, pointEvent, rows, size, tool } from "./fixtures.js";

describe("R0 tooltip-zoom evidence", () => {
  it("renders a custom interactive tooltip; Close and Escape restore chart focus; outside dismisses", async () => {
    const { container } = render(InteractiveTooltipPlot);
    const surface = container.querySelector<HTMLElement>(".gg-capture")!;
    surface.focus();
    surface.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    surface.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await expect.poll(() => container.querySelector("[data-custom-tooltip]")).not.toBeNull();
    const close = container.querySelector<HTMLButtonElement>(".gg-tooltip button")!;
    close.focus();
    close.click();
    await expect.poll(() => container.querySelector(".gg-tooltip")).toBeNull();
    expect(document.activeElement).toBe(surface);

    surface.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    surface.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await expect.poll(() => container.querySelector(".gg-tooltip")).not.toBeNull();
    container.querySelector<HTMLElement>(".gg-tooltip")!.focus();
    container
      .querySelector(".gg-tooltip")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await expect.poll(() => container.querySelector(".gg-tooltip")).toBeNull();
    expect(document.activeElement).toBe(surface);

    surface.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    surface.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await expect.poll(() => container.querySelector(".gg-tooltip")).not.toBeNull();
    container
      .querySelector("[data-outside]")!
      .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await expect.poll(() => container.querySelector(".gg-tooltip")).toBeNull();
  });

  it("resets tooltip hover ownership when Close removes the hovered tooltip", async () => {
    let model: RenderModel | null = null;
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: { contentMode: "interactive" },
      onrender: (next: RenderModel) => (model = next),
      ...size,
    });
    const capture = container.querySelector(".gg-capture")!;
    const seed = model!.candidates.candidate(0)!;
    pointEvent(capture, "pointermove", seed.x, seed.y);
    await nextFrame();
    const firstTooltip = container.querySelector(".gg-tooltip")!;
    firstTooltip.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    capture.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await expect.poll(() => container.querySelector(".gg-tooltip button")).not.toBeNull();
    container.querySelector<HTMLButtonElement>(".gg-tooltip button")!.click();
    await expect.poll(() => container.querySelector(".gg-tooltip")).toBeNull();

    pointEvent(capture, "pointermove", seed.x, seed.y);
    await nextFrame();
    expect(container.querySelector(".gg-tooltip")).not.toBeNull();
    capture.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    await nextFrame();
    expect(container.querySelector(".gg-tooltip")).toBeNull();
  });

  it("reveals the latest hovered target when a pinned tooltip is unpinned", async () => {
    let model: RenderModel | null = null;
    const changes: Array<{
      state: string;
      focus: { key: PropertyKey | null };
    }> = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      onrender: (next: RenderModel) => (model = next),
      oninspect: (event: {
        phase: string;
        state?: string;
        focus?: { key: PropertyKey | null };
      }) => {
        if (event.phase === "change" && event.state !== undefined && event.focus !== undefined)
          changes.push({ state: event.state, focus: event.focus });
      },
      ...size,
    });
    const capture = container.querySelector(".gg-capture")!;
    const first = model!.candidates.candidate(0)!;
    const second = model!.candidates.candidate(1)!;
    pointEvent(capture, "pointermove", first.x, first.y);
    await nextFrame();
    capture.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await expect.poll(() => changes.at(-1)?.state).toBe("pinned");
    pointEvent(capture, "pointermove", second.x, second.y);
    await nextFrame();
    capture.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await expect.poll(() => changes.at(-1)?.state).toBe("transient");
    expect(changes.at(-1)?.focus.key).toBe("b");
  });

  it("stays busy and interaction-disabled at initial zero width, then becomes ready", async () => {
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      inspect: true,
      select: "interval",
      width: "container",
      height: 300,
    });
    container.style.width = "0px";
    await nextFrame();
    await nextFrame();
    const root = container.querySelector<HTMLElement>(".gg-plot-root")!;
    expect(root.dataset["ggReady"]).toBe("false");
    expect(container.querySelector("[role='toolbar']")?.getAttribute("aria-busy")).toBe("true");
    expect(
      [...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button")].every(
        (button) => button.disabled,
      ),
    ).toBe(true);

    container.style.width = "400px";
    await expect.poll(() => root.dataset["ggReady"]).toBe("true");
    expect(container.querySelector("[role='toolbar']")?.getAttribute("aria-busy")).toBe("false");
  });

  it("measures and clamps long custom floating tooltips at every transformed plot edge", async () => {
    const { container } = render(LongTooltipPlot);
    const root = container.querySelector<HTMLElement>(".gg-plot-root")!;
    root.style.transform = "scale(0.75)";
    root.style.transformOrigin = "top left";
    const candidates = JSON.parse(
      container.querySelector("[data-candidates]")!.textContent ?? "[]",
    ) as Array<{ x: number; y: number }>;
    expect(candidates).toHaveLength(5);
    const capture = container.querySelector(".gg-capture")!;
    for (const candidate of candidates) {
      pointEvent(capture, "pointermove", candidate.x, candidate.y);
      await expect
        .poll(() => {
          const tooltip = container.querySelector<HTMLElement>(".gg-tooltip");
          if (tooltip === null) return false;
          const rootRect = root.getBoundingClientRect();
          const tooltipRect = tooltip.getBoundingClientRect();
          return (
            tooltipRect.left >= rootRect.left &&
            tooltipRect.top >= rootRect.top &&
            tooltipRect.right <= rootRect.right + 1 &&
            tooltipRect.bottom <= rootRect.bottom + 1
          );
        })
        .toBe(true);
      const tooltip = container.querySelector<HTMLElement>(".gg-tooltip")!;
      const rootRect = root.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      expect(tooltipRect.left).toBeGreaterThanOrEqual(rootRect.left);
      expect(tooltipRect.top).toBeGreaterThanOrEqual(rootRect.top);
      expect(tooltipRect.right).toBeLessThanOrEqual(rootRect.right + 1);
      expect(tooltipRect.bottom).toBeLessThanOrEqual(rootRect.bottom + 1);
      expect(tooltip.scrollWidth).toBeLessThanOrEqual(tooltip.clientWidth + 2);
    }
  });

  it("updates the natural baseline after data replacement while zoomed and visible Reset returns to it", async () => {
    let model: RenderModel | null = null;
    const view = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      inspect: true,
      zoom: { mode: "x" },
      onrender: (next: RenderModel) => (model = next),
      ...size,
    });
    const before = model!;
    await dragArea(
      view.container,
      { x: before.scene.panels[0].x + before.scene.panels[0].width / 2, y: 80 },
      { x: before.scene.panels[0].x + before.scene.panels[0].width, y: 250 },
      "Zoom area",
    );
    await expect.poll(() => model?.runId).not.toBe(before.runId);
    const zoomed = model!;
    const replacement = [
      { id: "n1", x: 100, y: 1 },
      { id: "n2", x: 200, y: 2 },
      { id: "n3", x: 400, y: 3 },
    ];
    await view.rerender(fromPartial({ data: replacement }));
    await expect.poll(() => model?.runId).not.toBe(zoomed.runId);
    expect(model!.domains.baseline.x.at(-1)).toBeGreaterThanOrEqual(400);
    const reset = tool(view.container, "Reset zoom");
    expect(reset.getBoundingClientRect().width).toBeGreaterThan(0);
    reset.click();
    await expect.poll(() => model!.domains.effective.x.at(-1)).toBeGreaterThanOrEqual(400);
    expect(model!.domains.effective.x).toEqual(model!.domains.baseline.x);
  });

  it("exposes partial programmatic setZoom without clearing the other channel", async () => {
    const { container } = render(ProgrammaticZoomPlot);
    container.querySelector<HTMLButtonElement>("[data-zoom-x]")!.click();
    await expect
      .poll(() => container.querySelector("[data-x-domain]")?.textContent)
      .toBe("1.5,2.5");
    const yBefore = container.querySelector("[data-y-domain]")?.textContent;
    container.querySelector<HTMLButtonElement>("[data-zoom-y]")!.click();
    await expect.poll(() => container.querySelector("[data-y-domain]")?.textContent).toBe("12,18");
    expect(container.querySelector("[data-x-domain]")?.textContent).toBe("1.5,2.5");
    expect(yBefore).not.toBe("12,18");
  });

  it("keeps the dense pinned dialog axe-clean, focusable, scrollable, and updatable", async () => {
    const data = Array.from({ length: 1_000 }, (_, index) => ({
      id: `row-${index}`,
      x: 1,
      y: index + 1,
      group: `g-${index}`,
    }));
    let model: RenderModel | null = null;
    const view = render(GGPlot, {
      data,
      aes: { x: "x", y: "y", color: "group" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: { mode: "x", contentMode: "interactive" },
      onrender: (next: RenderModel) => (model = next),
      ...size,
    });
    const surface = view.container.querySelector<HTMLElement>(".gg-capture")!;
    const seed = model!.candidates.candidate(0)!;
    pointEvent(surface, "pointermove", seed.x, seed.y);
    await nextFrame();
    surface.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // 1000 series rows, no Total: points use identity position (#1274 gate).
    await expect
      .poll(() => view.container.querySelectorAll(".gg-tooltip-members > dl").length)
      .toBe(1_000);
    expect(
      view.container.querySelectorAll(".gg-tooltip-members > dl:not(.gg-tooltip-total)"),
    ).toHaveLength(1_000);
    expect(view.container.querySelector(".gg-tooltip-total")).toBeNull();
    const tooltip = view.container.querySelector<HTMLElement>(".gg-tooltip")!;
    expect(["auto", "scroll"]).toContain(getComputedStyle(tooltip).overflowY);
    const close = tooltip.querySelector<HTMLButtonElement>("button")!;
    close.focus();
    expect(document.activeElement).toBe(close);
    await expectAccessible(view.container);
    await view.rerender(fromPartial({ height: 360 }));
    await expect
      .poll(() => view.container.querySelector("svg.gg-plot")?.getAttribute("height"))
      .toBe("360");
    expect(view.container.querySelectorAll(".gg-tooltip-members > dl")).toHaveLength(1_000);
  }, 180_000); // Linux Firefox hit 90s twice; Chromium/WebKit complete this 1,000-member axe walk in 67s/54s.
});

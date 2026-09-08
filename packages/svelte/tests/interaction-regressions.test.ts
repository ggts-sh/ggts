import "./setup-register-all.js";
import { describe, expect, it, vi } from "vitest";

import type { RenderModel } from "@ggts-sh/core";
import type { IntervalSelection, ZoomEvent } from "../src/lib/interaction/interaction.js";

import GGPlot from "../src/lib/GGPlot.svelte";
import { normalizeInteractionConfig } from "../src/lib/interaction/interaction.js";
import { render } from "./helpers/render.js";

const size = { width: 480, height: 320 };

function drag(capture: Element, x0: number, y0: number, x1: number, y1: number): void {
  const bounds = capture.getBoundingClientRect();
  const options = (x: number, y: number) => ({
    clientX: bounds.left + (x / size.width) * bounds.width,
    clientY: bounds.top + (y / size.height) * bounds.height,
    bubbles: true,
    button: 0,
    buttons: 1,
    pointerId: 7,
  });
  capture.dispatchEvent(new PointerEvent("pointerdown", options(x0, y0)));
  capture.dispatchEvent(new PointerEvent("pointermove", options(x1, y1)));
  capture.dispatchEvent(new PointerEvent("pointerup", options(x1, y1)));
}

describe("interaction prelanding regressions", () => {
  it("requests but does not locally apply a controlled tool change", async () => {
    const changed = vi.fn<(tool: string) => void>();
    const { container } = render(GGPlot, {
      data: [{ id: "a", x: 1, y: 1 }],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      select: "interval",
      tool: "inspect",
      ontoolchange: changed,
      ...size,
    });
    const inspect = container.querySelector<HTMLButtonElement>(
      '.gg-tool-rail button[aria-pressed="true"]',
    )!;
    const select = [...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button")].find(
      (button) => button.textContent?.trim() === "Select area",
    )!;
    select.click();
    await expect.poll(() => changed).toHaveBeenCalledWith("select-area");
    expect(inspect.getAttribute("aria-pressed")).toBe("true");
    expect(select.getAttribute("aria-pressed")).toBe("false");
  });

  it("diagnoses and falls back from a controlled unavailable tool", () => {
    const resolved = normalizeInteractionConfig({
      inspect: true,
      tool: "zoom-area",
    });
    expect(resolved.initialTool).toBe("inspect");
    expect(resolved.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "INTERACTION_TOOL_UNAVAILABLE",
        prop: "tool",
        actual: "zoom-area",
      }),
    );
  });

  it("x interval selection ignores the orthogonal y extent", async () => {
    let model: RenderModel | null = null;
    const selected = vi.fn<(event: IntervalSelection<string>) => void>();
    const { container } = render(GGPlot, {
      data: [
        { id: "low", x: 1, y: 0 },
        { id: "high", x: 1, y: 100 },
        { id: "other", x: 5, y: 50 },
      ],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      select: { type: "interval", mode: "x" },
      onselect: selected,
      onrender: (next: RenderModel) => (model = next),
      ...size,
    });
    const candidates = [model!.candidates.candidate(0)!, model!.candidates.candidate(1)!];
    container.querySelector<HTMLButtonElement>(".gg-tool-rail button:nth-child(2)")!.click();
    drag(
      container.querySelector(".gg-capture")!,
      candidates[0].x - 4,
      candidates[0].y - 2,
      candidates[0].x + 4,
      candidates[0].y + 2,
    );
    await expect
      .poll(() => selected.mock.calls.some(([event]) => event.phase === "end"))
      .toBe(true);
    const event = selected.mock.calls.find(([value]) => value.phase === "end")![0];
    expect(new Set(event.keys)).toEqual(new Set(["low", "high"]));
    expect(event.domain).toHaveProperty("x");
    expect(event.domain).not.toHaveProperty("y");
  });

  it("scrolls overflowing recovery actions instead of overlapping the mode tabs", async () => {
    let model: RenderModel | null = null;
    const { container } = render(GGPlot, {
      data: [
        { id: "a", x: 1, y: 1 },
        { id: "b", x: 2, y: 2 },
      ],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      select: { type: "interval", mode: "xy" },
      onrender: (next: RenderModel) => (model = next),
      ...size,
    });
    await expect.poll(() => model !== null).toBe(true);
    await expect
      .poll(() => container.querySelectorAll(".gg-tool-recovery-actions button").length)
      .toBeGreaterThan(0);

    // R3 bounds/recovery buttons can outgrow any plot width; the actions
    // track scrolls while the mode tabs keep their full labels.
    const actions = container.querySelector<HTMLElement>(".gg-tool-recovery-actions")!;
    expect(getComputedStyle(actions).overflowX).toBe("auto");
    for (const button of container.querySelectorAll<HTMLButtonElement>(".gg-tool-modes button")) {
      expect(getComputedStyle(button).whiteSpace).toBe("nowrap");
      expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth + 1);
    }
  });

  it("x zoom writes only the configured x domain", async () => {
    const zoomed = vi.fn<(event: ZoomEvent) => void>();
    const { container } = render(GGPlot, {
      data: [
        { x: 1, y: 10 },
        { x: 2, y: 30 },
        { x: 3, y: 20 },
      ],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      zoom: { mode: "x" },
      onzoom: zoomed,
      ...size,
    });
    container.querySelector<HTMLButtonElement>(".gg-tool-rail button:nth-child(2)")!.click();
    drag(container.querySelector(".gg-capture")!, 150, 100, 340, 220);
    await expect.poll(() => zoomed).toHaveBeenCalled();
    expect(zoomed.mock.calls.at(-1)?.[0].domains).toHaveProperty("x");
    expect(zoomed.mock.calls.at(-1)?.[0].domains).not.toHaveProperty("y");
  });

  it("keeps a two-corner draft after normal lost pointer capture", async () => {
    const { container } = render(GGPlot, {
      data: [{ id: "a", x: 1, y: 1 }],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      select: "interval",
      ...size,
    });
    container.querySelector<HTMLButtonElement>(".gg-tool-rail button:nth-child(2)")!.click();
    const capture = container.querySelector(".gg-capture")!;
    drag(capture, 160, 140, 160, 140);
    capture.dispatchEvent(new PointerEvent("lostpointercapture", { bubbles: true, pointerId: 7 }));
    await expect.poll(() => container.querySelector(".gg-area-draft-select")).not.toBeNull();
  });

  it("uses source lineage for aggregate keys and lineageCount", async () => {
    const selected = vi.fn<(event: IntervalSelection<string>) => void>();
    let model: RenderModel | null = null;
    const { container } = render(GGPlot, {
      data: [
        { id: "a", group: "one", value: 2 },
        { id: "b", group: "one", value: 4 },
        { id: "c", group: "one", value: 6 },
      ],
      aes: { x: "group", y: "value" },
      layers: [{ geom: "errorbar", stat: "summary" }],
      key: "id",
      select: "interval",
      onselect: selected,
      onrender: (next: RenderModel) => (model = next),
      ...size,
    });
    expect(model!.candidates.size).toBeGreaterThan(0);
    expect(model!.lineage.count(model!.candidates.candidate(0)!.lineage)).toBe(3);
    container.querySelector<HTMLButtonElement>(".gg-tool-rail button:nth-child(2)")!.click();
    drag(container.querySelector(".gg-capture")!, 0, 0, 479, 319);
    await expect
      .poll(() => selected.mock.calls.some(([event]) => event.phase === "end"))
      .toBe(true);
    const event = selected.mock.calls.find(([value]) => value.phase === "end")![0];
    expect(new Set(event.keys)).toEqual(new Set(["a", "b", "c"]));
    expect(event.lineageCount).toBe(3);
  });

  it("labels the active datum from its row when the semantic key is non-numeric", async () => {
    const { container } = render(GGPlot, {
      data: [{ id: "alpha", x: 11, y: 29 }],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      ...size,
    });
    const capture = container.querySelector<HTMLElement>(".gg-capture")!;
    capture.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await expect
      .poll(() => container.querySelector("[id$='-active']")?.textContent)
      .toContain("x 11");
    expect(container.querySelector("[id$='-active']")?.textContent).toContain("y 29");
  });
});

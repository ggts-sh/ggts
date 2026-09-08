import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";

import type { RenderModel } from "@ggts-sh/core";

import type { PlotDiagnostic } from "../src/lib/diagnostics/deprecation.js";
import GGPlot from "../src/lib/GGPlot.svelte";
import type {
  IntervalSelection,
  PlotInspection,
  PlotSelection,
} from "../src/lib/interaction/interaction.js";
import { render } from "./helpers/render.js";

const size = { width: 480, height: 320 } as const;

function keydown(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function button(container: ParentNode, label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent === label,
  );
  if (match === undefined) throw new Error(`Missing ${label} button`);
  return match;
}

function pointer(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
): void {
  const bounds = target.getBoundingClientRect();
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: bounds.left + (x / size.width) * bounds.width,
      clientY: bounds.top + (y / size.height) * bounds.height,
      pointerId: 29,
      pointerType: "mouse",
    }),
  );
}

describe("final R-1/R0 evidence locks", () => {
  it("announces a grouped axis value, member count, focus, and pin state exactly once", async () => {
    const data = [
      { id: "a", x: 1, y: 10, group: "alpha" },
      { id: "b", x: 1, y: 20, group: "beta" },
    ];
    const { container } = render(GGPlot, {
      data,
      aes: { x: "x", y: "y", color: "group" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: { mode: "x" },
      ...size,
    });
    const surface = container.querySelector<HTMLElement>(".gg-capture")!;
    surface.focus();
    await tick();
    const live = container.querySelector<HTMLElement>("[aria-live='polite']")!;
    expect(live.textContent).toMatch(/^x 1\.0; 2 data; focused /);
    expect(live.textContent?.match(/x 1/g)).toHaveLength(1);
    expect(live.textContent?.match(/2 data/g)).toHaveLength(1);
    expect(
      Number(live.textContent?.includes("alpha")) + Number(live.textContent?.includes("beta")),
    ).toBe(1);

    keydown(surface, "Enter");
    await tick();
    expect(live.textContent?.match(/pinned/g)).toHaveLength(1);
    // Two series members, no Total: points are identity-positioned, not stacked.
    expect(
      container.querySelectorAll(".gg-tooltip-members > dl:not(.gg-tooltip-total)"),
    ).toHaveLength(2);
    expect(container.querySelector(".gg-tooltip-total")).toBeNull();
    keydown(surface, "Enter");
    await tick();
    expect(live.textContent?.match(/unpinned/g)).toHaveLength(1);
  });

  it("uses one live region for area instructions, completion, clear, zoom, and reset", async () => {
    const { container } = render(GGPlot, {
      data: [
        { id: "a", x: 1, y: 1 },
        { id: "b", x: 2, y: 2 },
      ],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      select: { type: "interval", persistent: true },
      zoom: true,
      ...size,
    });
    expect(container.querySelectorAll("[aria-live], [role='status']")).toHaveLength(1);
    const surface = container.querySelector<HTMLElement>(".gg-capture")!;
    button(container, "Select area").click();
    surface.focus();
    keydown(surface, "Enter");
    await tick();
    expect(container.querySelector("[aria-live='polite']")?.textContent).toBe(
      "Choose opposite corner.",
    );
    keydown(surface, "ArrowRight");
    keydown(surface, "ArrowDown");
    keydown(surface, "Enter");
    await tick();
    expect(container.querySelector("[aria-live='polite']")?.textContent).toMatch(
      /^Selection complete, /,
    );
    button(container, "Clear panel selection").click();
    await tick();
    expect(container.querySelector("[aria-live='polite']")?.textContent).toBe("Selection cleared.");

    button(container, "Zoom area").click();
    keydown(surface, "Enter");
    keydown(surface, "ArrowRight");
    keydown(surface, "ArrowDown");
    keydown(surface, "Enter");
    await tick();
    expect(container.querySelector("[aria-live='polite']")?.textContent).toBe("Zoom complete.");
    button(container, "Reset zoom").click();
    await tick();
    expect(container.querySelector("[aria-live='polite']")?.textContent).toBe("Zoom reset.");
  });

  it("activates and announces first focus, navigates four directions, cycles coincident marks, and closes on focus leave", async () => {
    const changes: string[] = [];
    const data = [
      { id: "center-a", x: 1, y: 1 },
      { id: "right", x: 2, y: 1 },
      { id: "left", x: 0, y: 1 },
      { id: "up", x: 1, y: 2 },
      { id: "down", x: 1, y: 0 },
      { id: "center-b", x: 1, y: 1 },
    ];
    const { container } = render(GGPlot, {
      data,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      oninspect: (event: PlotInspection<(typeof data)[number], string>) => {
        if (event.phase === "change" && event.focus.key !== null) changes.push(event.focus.key);
      },
      ...size,
    });
    const surface = container.querySelector<HTMLElement>(".gg-capture")!;
    surface.focus();
    await tick();
    expect(changes.at(-1)).toBe("up");
    expect(container.querySelector("[aria-live='polite']")?.textContent).toContain("x 1");

    keydown(surface, "ArrowDown");
    expect(changes.at(-1)).toBe("center-b");
    keydown(surface, "ArrowRight");
    expect(changes.at(-1)).toBe("right");
    keydown(surface, "ArrowLeft");
    expect(changes.at(-1)).toBe("center-b");
    keydown(surface, "ArrowUp");
    expect(changes.at(-1)).toBe("up");
    keydown(surface, "ArrowDown");
    expect(changes.at(-1)).toBe("center-b");
    keydown(surface, "]");
    expect(changes.at(-1)).toBe("center-a");
    keydown(surface, "[");
    expect(changes.at(-1)).toBe("center-b");

    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.append(outside);
    outside.focus();
    await tick();
    expect(container.querySelector(".gg-tooltip")).toBeNull();
    outside.remove();
  });

  it("default identity: layout-only and equal-valued replace rebind pin", async () => {
    const data = [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
    ];
    const view = render(GGPlot, {
      data,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      inspect: true,
      ...size,
    });
    const surface = view.container.querySelector<HTMLElement>(".gg-capture")!;
    surface.focus();
    keydown(surface, "Enter");
    await expect.poll(() => view.container.querySelector(".gg-tooltip")).not.toBeNull();
    expect(view.container.querySelector(".gg-tooltip")?.classList).toContain("gg-tooltip-pinned");

    await view.rerender(fromPartial({ height: 360 }));
    expect(view.container.querySelector(".gg-tooltip")?.classList).toContain("gg-tooltip-pinned");

    // Default row-index identity rebinds across equal-valued new row objects.
    await view.rerender(fromPartial({ data: data.map((row) => ({ ...row })) }));
    await expect.poll(() => view.container.querySelector(".gg-tooltip")).not.toBeNull();
    expect(view.container.querySelector(".gg-tooltip")?.classList).toContain("gg-tooltip-pinned");
  });

  it("diagnoses an unstable key accessor for a surviving source row", async () => {
    const diagnostics: PlotDiagnostic[] = [];
    const row = { id: "row", x: 1, y: 2 };
    const unstable = render(GGPlot, {
      data: [row],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: () => "row-1",
      inspect: true,
      ondiagnostic: (diagnostic: PlotDiagnostic) => diagnostics.push(diagnostic),
      ...size,
    });
    await unstable.rerender(fromPartial({ key: () => "row-2" }));
    await expect
      .poll(() => diagnostics.map((diagnostic) => diagnostic.code))
      .toContain("INTERACTION_UNSTABLE_KEY");
  });

  it("diagnoses missing lineage for a synthetic candidate", async () => {
    const diagnostics: PlotDiagnostic[] = [];
    render(GGPlot, {
      data: [],
      layers: [{ geom: "rule", params: { yintercept: 1 } }],
      key: "id",
      inspect: true,
      ondiagnostic: (diagnostic: PlotDiagnostic) => diagnostics.push(diagnostic),
      ...size,
    });
    await expect
      .poll(() => diagnostics.map((diagnostic) => diagnostic.code))
      .toContain("INTERACTION_MISSING_LINEAGE");
  });

  it("logs every runtime diagnostic source in development and stays quiet in production", async () => {
    const row = { id: "row", x: 1, y: 2 };
    const warning = vi.spyOn(console, "warn").mockImplementation((message?: unknown) => {
      void message;
    });
    vi.stubGlobal("process", { env: { NODE_ENV: "development" } });
    render(GGPlot, {
      data: [row],
      layers: [{ geom: "point", aes: { x: "x", y: "y" } }],
      inspect: { maxDistance: -1 },
      ...size,
    });
    render(GGPlot, {
      data: [row],
      layers: [{ geom: "point", aes: { x: "x", y: "y" } }],
      key: fromAny(() => null),
      inspect: true,
      ...size,
    });
    render(GGPlot, {
      data: [{ x: "a", y: "b" }],
      layers: [{ geom: "point", aes: { x: "x", y: "y" } }],
      zoom: true,
      ...size,
    });
    await expect
      .poll(() => warning.mock.calls.map(([message]) => String(message)))
      .toEqual(
        expect.arrayContaining([
          expect.stringContaining("INTERACTION_INVALID_MAX_DISTANCE"),
          expect.stringContaining("INTERACTION_INVALID_KEY"),
          expect.stringContaining("INTERACTION_INTERVAL_SCALE_UNSUPPORTED"),
        ]),
      );

    warning.mockClear();
    vi.stubGlobal("process", { env: { NODE_ENV: "production" } });
    render(GGPlot, {
      data: [row],
      layers: [{ geom: "point", aes: { x: "x", y: "y" } }],
      inspect: { maxDistance: -1 },
      ...size,
    });
    await tick();
    expect(warning).not.toHaveBeenCalled();
    warning.mockRestore();
    vi.unstubAllGlobals();
  });

  it("deeply freezes point end/clear and interval clear event variants", async () => {
    let model: RenderModel | null = null;
    const pointEvents: PlotSelection<string>[] = [];
    const pointView = render(GGPlot, {
      data: [
        { id: "a", x: 1, y: 2 },
        { id: "b", x: 2, y: 4 },
      ],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      select: "point",
      onselect: (event: PlotSelection<string>) => pointEvents.push(event),
      onrender: (next: RenderModel) => {
        model = next;
      },
      ...size,
    });
    const pointSurface = pointView.container.querySelector(".gg-capture")!;
    const candidate = model!.candidates.candidate(0)!;
    const bounds = pointSurface.getBoundingClientRect();
    pointSurface.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: bounds.left + (candidate.x / size.width) * bounds.width,
        clientY: bounds.top + (candidate.y / size.height) * bounds.height,
      }),
    );
    await expect.poll(() => pointEvents).toHaveLength(1);
    expect(Object.isFrozen(pointEvents[0])).toBe(true);
    expect(Object.isFrozen(pointEvents[0].keys)).toBe(true);
    button(pointView.container, "Clear selection").click();
    await expect.poll(() => pointEvents).toHaveLength(2);
    expect(Object.isFrozen(pointEvents[1])).toBe(true);
    expect(Object.isFrozen(pointEvents[1].keys)).toBe(true);

    const intervalEvents: IntervalSelection<string>[] = [];
    const intervalView = render(GGPlot, {
      data: [
        { id: "a", x: 1, y: 2 },
        { id: "b", x: 2, y: 4 },
      ],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      select: "interval",
      onselect: (event: IntervalSelection<string>) => intervalEvents.push(event),
      ...size,
    });
    await expect.poll(() => button(intervalView.container, "Select area").disabled).toBe(false);
    button(intervalView.container, "Select area").click();
    const intervalSurface = intervalView.container.querySelector(".gg-capture")!;
    pointer(intervalSurface, "pointerdown", 100, 80);
    pointer(intervalSurface, "pointermove", 340, 250);
    pointer(intervalSurface, "pointerup", 340, 250);
    await expect.poll(() => intervalEvents.some((event) => event.phase === "end")).toBe(true);
    button(intervalView.container, "Clear panel selection").click();
    await expect.poll(() => intervalEvents.some((event) => event.phase === "clear")).toBe(true);
    const clear = intervalEvents.find((event) => event.phase === "clear")!;
    expect(Object.isFrozen(clear)).toBe(true);
    expect(Object.isFrozen(clear.domain)).toBe(true);
    expect(Object.isFrozen(clear.pixels)).toBe(true);
    expect(Object.isFrozen(clear.keys)).toBe(true);
  });
});

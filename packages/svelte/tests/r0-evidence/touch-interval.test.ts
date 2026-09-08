import { describe, expect, it } from "vitest";
import { withGrammarAsSpec } from "../helpers/ggplot-input.js";

import type { RenderModel } from "@ggts-sh/core";

import GGPlot from "../../src/lib/GGPlot.svelte";
import { render } from "../helpers/render.js";
import { dragArea, nextFrame, pointEvent, rows, size, tool } from "./fixtures.js";

describe("R0 touch-interval evidence", () => {
  it("coalesces area changes to one per frame and pointerup ends with the latest point", async () => {
    const events: Array<{
      phase: string;
      pixels: { x0: number; y0: number; x1: number; y1: number };
    }> = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      select: "interval",
      onselect: (event: {
        phase: string;
        pixels: { x0: number; y0: number; x1: number; y1: number };
      }) => events.push(event),
      ...size,
    });
    await expect.poll(() => tool(container, "Select area").disabled).toBe(false);
    tool(container, "Select area").click();
    await expect
      .poll(() => tool(container, "Select area").getAttribute("aria-pressed"))
      .toBe("true");
    const capture = container.querySelector(".gg-capture")!;
    pointEvent(capture, "pointerdown", 100, 80);
    events.length = 0;
    for (const [x, y] of [
      [150, 120],
      [220, 170],
      [300, 230],
    ] as const)
      pointEvent(capture, "pointermove", x, y);
    expect(events).toHaveLength(0);
    await nextFrame();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      phase: "change",
      pixels: { x1: 300, y1: 230 },
    });

    pointEvent(capture, "pointermove", 340, 250);
    pointEvent(capture, "pointerup", 360, 270);
    await nextFrame();
    expect(events.at(-1)).toMatchObject({
      phase: "end",
      pixels: { x1: 360, y1: 270 },
    });
    expect(events.filter((event) => event.phase === "change")).toHaveLength(1);
  });

  it("pins a touch tap with touch provenance while leaving inspect touch scrolling enabled", async () => {
    let model: RenderModel | null = null;
    const changes: Array<{ state?: string; source?: string }> = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      onrender: (next: RenderModel) => (model = next),
      oninspect: (event: { phase: string; state?: string; source?: string }) => {
        if (event.phase === "change") changes.push(event);
      },
      ...size,
    });
    const capture = container.querySelector<HTMLElement>(".gg-capture")!;
    expect(getComputedStyle(capture).touchAction).toContain("pan-y");
    const candidate = model!.candidates.candidate(1)!;
    const down = pointEvent(capture, "pointerdown", candidate.x, candidate.y, "touch", 9);
    const up = pointEvent(capture, "pointerup", candidate.x, candidate.y, "touch", 9);
    expect(down.defaultPrevented || up.defaultPrevented).toBe(false);
    await expect.poll(() => changes.at(-1)?.state).toBe("pinned");
    expect(changes.at(-1)?.source).toBe("touch");
    capture.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextFrame();
    expect(changes.at(-1)?.state).toBe("pinned");
  });

  it("drops a queued touch-inspect hover once drag crosses the move threshold", async () => {
    let model: RenderModel | null = null;
    const changes: Array<{ phase: string; state?: string }> = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      onrender: (next: RenderModel) => (model = next),
      oninspect: (event: { phase: string; state?: string }) => {
        if (event.phase === "change") changes.push(event);
      },
      ...size,
    });
    const capture = container.querySelector<HTMLElement>(".gg-capture")!;
    const candidate = model!.candidates.candidate(1)!;
    // Host cleanup under test: unmoved move schedules inspect; drag cancel must
    // clear the queue and cancel the scheduled frame before it can fire.
    pointEvent(capture, "pointerdown", candidate.x, candidate.y, "touch", 12);
    pointEvent(capture, "pointermove", candidate.x, candidate.y, "touch", 12);
    pointEvent(capture, "pointermove", candidate.x + 40, candidate.y + 40, "touch", 12);
    await nextFrame();
    await nextFrame();
    expect(changes).toHaveLength(0);
    // pointerup after drag must also not pin (touch-inspect-drag-ignore path).
    pointEvent(capture, "pointerup", candidate.x + 40, candidate.y + 40, "touch", 12);
    await nextFrame();
    expect(changes).toHaveLength(0);
  });

  it("completes touch-drag selection with touch provenance and no JavaScript cancellation", async () => {
    const events: Array<{ phase: string; source: string }> = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      select: "interval",
      onselect: (event: { phase: string; source: string }) => events.push(event),
      ...size,
    });
    await expect.poll(() => tool(container, "Select area").disabled).toBe(false);
    tool(container, "Select area").click();
    await expect
      .poll(() => tool(container, "Select area").getAttribute("aria-pressed"))
      .toBe("true");
    const capture = container.querySelector<HTMLElement>(".gg-capture")!;
    expect(getComputedStyle(capture).touchAction).toBe("none");
    const down = pointEvent(capture, "pointerdown", 100, 80, "touch", 17);
    const move = pointEvent(capture, "pointermove", 340, 250, "touch", 17);
    const up = pointEvent(capture, "pointerup", 360, 270, "touch", 17);
    expect(down.defaultPrevented || move.defaultPrevented || up.defaultPrevented).toBe(false);
    await expect.poll(() => events.some((event) => event.phase === "end")).toBe(true);
    expect(events.find((event) => event.phase === "end")?.source).toBe("touch");
  });

  it.each(["mouse", "touch"])(
    "completes a two-corner interval with %s input",
    async (pointerType) => {
      const selections: Array<{
        phase: string;
        source: string;
        pixels: unknown;
      }> = [];
      const { container } = render(GGPlot, {
        data: rows,
        aes: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
        key: "id",
        select: "interval",
        onselect: (event: { phase: string; source: string; pixels: unknown }) =>
          selections.push(event),
        ...size,
      });
      await expect.poll(() => tool(container, "Select area").disabled).toBe(false);
      tool(container, "Select area").click();
      await expect
        .poll(() => tool(container, "Select area").getAttribute("aria-pressed"))
        .toBe("true");
      const capture = container.querySelector(".gg-capture")!;
      pointEvent(capture, "pointerdown", 110, 90, pointerType, 2);
      pointEvent(capture, "pointerup", 110, 90, pointerType, 2);
      await expect.poll(() => container.querySelector(".gg-area-draft")).not.toBeNull();
      pointEvent(capture, "pointerdown", 360, 250, pointerType, 3);
      pointEvent(capture, "pointerup", 360, 250, pointerType, 3);
      await expect.poll(() => selections.some((event) => event.phase === "end")).toBe(true);
      expect(selections.find((event) => event.phase === "end")?.source).toBe(
        pointerType === "touch" ? "touch" : "pointer",
      );
    },
  );

  it("completes an interval with Enter, arrows, and Enter and returns an idle area tool to Inspect", async () => {
    const selections: Array<{ phase: string; source: string }> = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      select: "interval",
      onselect: (event: { phase: string; source: string }) => selections.push(event),
      ...size,
    });
    await expect.poll(() => tool(container, "Select area").disabled).toBe(false);
    tool(container, "Select area").click();
    await expect
      .poll(() => tool(container, "Select area").getAttribute("aria-pressed"))
      .toBe("true");
    const surface = container.querySelector<HTMLElement>(".gg-capture")!;
    surface.focus();
    for (const key of ["Enter", "ArrowRight", "ArrowDown", "Enter"])
      surface.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey: true, bubbles: true }));
    await expect.poll(() => selections.some((event) => event.phase === "end")).toBe(true);
    expect(selections.find((event) => event.phase === "end")?.source).toBe("keyboard");
    surface.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await expect.poll(() => tool(container, "Inspect").getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps keyed band interval selection with inclusive categorical endpoints", async () => {
    const diagnostics: Array<{ code: string; prop: string; actual?: unknown }> = [];
    const selections: Array<{
      keys: readonly PropertyKey[];
      domain: { x?: unknown };
    }> = [];
    const { container } = render(GGPlot, {
      data: [
        { id: "a", category: "A", value: 1 },
        { id: "b", category: "B", value: 2 },
      ],
      aes: { x: "category", y: "value" },
      layers: [{ geom: "col" }],
      key: "id",
      select: { type: "interval", mode: "x" },
      ondiagnostic: (diagnostic: { code: string; prop: string; actual?: unknown }) =>
        diagnostics.push(diagnostic),
      onselect: (event: {
        phase: string;
        keys: readonly PropertyKey[];
        domain: { x?: unknown };
      }) => {
        if (event.phase === "end") selections.push(event);
      },
      ...size,
    });
    await dragArea(container, { x: 45, y: 50 }, { x: 470, y: 280 });
    await expect.poll(() => selections.length).toBe(1);
    expect(selections[0].keys).toHaveLength(2);
    expect(selections[0].domain.x).toEqual(["A", "B"]);
    expect(diagnostics.some((item) => item.code === "INTERACTION_INTERVAL_SCALE_UNSUPPORTED")).toBe(
      false,
    );
    expect(container.querySelector(".gg-capability-status")).toBeNull();
  });

  it("disables band-only zoom with matching diagnostic and tool rail", async () => {
    const diagnostics: Array<{ code: string; prop: string }> = [];
    const { container } = render(GGPlot, {
      data: [
        { category: "A", value: 1 },
        { category: "B", value: 2 },
      ],
      aes: { x: "category", y: "value" },
      layers: [{ geom: "col" }],
      zoom: { mode: "x" },
      ondiagnostic: (diagnostic: { code: string; prop: string }) => diagnostics.push(diagnostic),
      ...size,
    });
    await expect
      .poll(() =>
        diagnostics.some((item) => item.code === "INTERACTION_INTERVAL_SCALE_UNSUPPORTED"),
      )
      .toBe(true);
    expect(container.querySelectorAll(".gg-tool-rail button")).toHaveLength(0);
    expect(container.querySelector(".gg-capability-status")?.textContent).toContain("unavailable");
  });

  it("disables empty area tools and exposes an accessible first-corner instruction", async () => {
    const { container } = render(GGPlot, {
      data: [],
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      inspect: true,
      select: "interval",
      zoom: true,
      ...size,
    });
    for (const label of ["Select area", "Zoom area"]) {
      const button = tool(container, label);
      expect(button.disabled).toBe(true);
      expect(Number(getComputedStyle(button).fontSize.replace("px", ""))).toBeGreaterThanOrEqual(
        14,
      );
    }

    const populated = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      select: "interval",
      ...size,
    });
    await expect.poll(() => tool(populated.container, "Select area").disabled).toBe(false);
    tool(populated.container, "Select area").click();
    await expect
      .poll(() => tool(populated.container, "Select area").getAttribute("aria-pressed"))
      .toBe("true");
    const capture = populated.container.querySelector(".gg-capture")!;
    pointEvent(capture, "pointerdown", 120, 100);
    pointEvent(capture, "pointerup", 120, 100);
    await expect.poll(() => populated.container.querySelector(".gg-first-corner")).not.toBeNull();
    expect(populated.container.querySelector(".gg-area-instruction")?.textContent).toContain(
      "Choose opposite corner",
    );
  });

  it("deeply freezes interval and zoom payloads and narrates touch focus", async () => {
    const selections: unknown[] = [];
    const zooms: unknown[] = [];
    let model: RenderModel | null = null;
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      select: "interval",
      zoom: true,
      onrender: (next: RenderModel) => (model = next),
      onselect: (event: unknown) => selections.push(event),
      onzoom: (event: unknown) => zooms.push(event),
      ...size,
    });
    await dragArea(container, { x: 100, y: 80 }, { x: 320, y: 240 });
    const selection = selections.at(-1) as {
      domain: object;
      pixels: object;
      keys: object;
    };
    expect(Object.isFrozen(selection)).toBe(true);
    expect(Object.isFrozen(selection.domain)).toBe(true);
    expect(Object.isFrozen(selection.pixels)).toBe(true);
    expect(Object.isFrozen(selection.keys)).toBe(true);

    await dragArea(container, { x: 120, y: 90 }, { x: 340, y: 250 }, "Zoom area");
    const zoom = zooms.at(-1) as { domains: object };
    expect(Object.isFrozen(zoom)).toBe(true);
    expect(Object.isFrozen(zoom.domains)).toBe(true);

    // This arbitrary pixel window can contain no rows now that scale limits
    // censor before stats. Reset to the natural baseline before touch inspect.
    tool(container, "Reset zoom").click();
    await expect.poll(() => model!.candidates.size).toBeGreaterThan(0);
    tool(container, "Inspect").click();
    // Pre-stat limit censoring may leave sparse candidate ids after zoom; use
    // the first surviving semantic candidate rather than assuming id 0.
    let seed = null;
    for (let id = 0; id < model!.candidates.size; id++) {
      seed = model!.candidates.candidate(id);
      if (seed !== null) break;
    }
    if (seed === null) throw new Error("expected a surviving zoom candidate");
    const capture = container.querySelector(".gg-capture")!;
    pointEvent(capture, "pointerdown", seed.x, seed.y, "touch", 31);
    pointEvent(capture, "pointerup", seed.x, seed.y, "touch", 31);
    await expect
      .poll(() => container.querySelector("[aria-live='polite']")?.textContent)
      .toContain("x 1");
    expect(container.querySelector("[aria-live='polite']")?.textContent).toContain("pinned");
  });

  it("inverts y, log, time, and reversed continuous interval scales", async () => {
    const cases = [
      {
        data: rows,
        aes: { x: "x", y: "y" },
        scales: { y: { reverse: true } },
        select: { type: "interval" as const, mode: "y" as const },
        channel: "y" as const,
      },
      {
        data: [
          { id: "a", x: 1, y: 1 },
          { id: "b", x: 10, y: 2 },
          { id: "c", x: 100, y: 3 },
        ],
        aes: { x: "x", y: "y" },
        scales: { x: { type: "log" as const } },
        select: { type: "interval" as const, mode: "x" as const },
        channel: "x" as const,
      },
      {
        data: [
          { id: "a", when: "2026-01-01", y: 1 },
          { id: "b", when: "2026-02-01", y: 2 },
          { id: "c", when: "2026-03-01", y: 3 },
        ],
        aes: { x: "when", y: "y" },
        scales: { x: { type: "time" as const } },
        select: { type: "interval" as const, mode: "x" as const },
        channel: "x" as const,
      },
    ];
    for (const value of cases) {
      const ends: Array<{
        domain: { x?: [unknown, unknown]; y?: [unknown, unknown] };
      }> = [];
      const view = render(
        GGPlot,
        withGrammarAsSpec({
          data: value.data,
          aes: value.aes,
          layers: [{ geom: "point" }],
          key: "id",
          scales: value.scales,
          select: value.select,
          onselect: (event: {
            phase: string;
            domain: { x?: [unknown, unknown]; y?: [unknown, unknown] };
          }) => {
            if (event.phase === "end") ends.push(event);
          },
          ...size,
        }),
      );
      await dragArea(view.container, { x: 120, y: 80 }, { x: 360, y: 250 });
      await expect.poll(() => ends.length).toBe(1);
      const domain = ends[0].domain[value.channel];
      expect(domain).toHaveLength(2);
      if (domain === undefined) throw new Error(`missing ${value.channel} domain`);
      expect(Number(domain[0])).toBeLessThan(Number(domain[1]));
      expect(ends[0].domain[value.channel === "x" ? "y" : "x"]).toBeUndefined();
      view.unmount();
    }
  });

  it("keeps semantic interval modes and domain inversion correct under coord flip", async () => {
    let model: RenderModel | null = null;
    const ends: Array<{
      domain: { x?: [number, number]; y?: [number, number] };
      keys: readonly PropertyKey[];
    }> = [];
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: rows,
        aes: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
        coord: "flip",
        key: "id",
        select: { type: "interval", mode: "x" },
        onrender: (next: RenderModel) => (model = next),
        onselect: (event: {
          phase: string;
          domain: { x?: [number, number]; y?: [number, number] };
          keys: readonly PropertyKey[];
        }) => {
          if (event.phase === "end") ends.push(event);
        },
        ...size,
      }),
    );
    const rendered = model as RenderModel | null;
    if (rendered === null) throw new Error("expected a rendered flip model");
    const panel = rendered.scene.panels[0];
    await dragArea(
      container,
      { x: panel.x + panel.width * 0.1, y: panel.y + panel.height * 0.25 },
      { x: panel.x + panel.width * 0.2, y: panel.y + panel.height * 0.75 },
    );
    await expect.poll(() => ends.length).toBe(1);
    expect(ends[0].domain.y).toBeUndefined();
    const selected = ends[0].domain.x;
    const full = rendered.scales.x.domain as [number, number];
    expect(selected[1] - selected[0]).toBeLessThan(full[1] - full[0]);
    expect(ends[0].keys.length).toBeGreaterThan(0);
  });
});

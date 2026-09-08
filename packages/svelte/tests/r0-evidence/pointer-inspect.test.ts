import "../setup-register-all.js";
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import { withGrammarAsSpec } from "../helpers/ggplot-input.js";

import type { RenderModel } from "@ggts-sh/core";

import GGPlot from "../../src/lib/GGPlot.svelte";
import { render } from "../helpers/render.js";
import { nextFrame, pointEvent, rows, size, tool } from "./fixtures.js";

describe("R0 pointer-inspect evidence", () => {
  it("coalesces pointer inspection to the last event per animation frame and cancels on leave", async () => {
    let model: RenderModel | null = null;
    const changes: Array<{ focus: { row: Record<string, unknown> | null } }> = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      onrender: (next: RenderModel) => (model = next),
      oninspect: (event: { phase: string; focus?: { row: Record<string, unknown> | null } }) => {
        if (event.phase === "change" && event.focus !== undefined)
          changes.push({ focus: event.focus });
      },
      ...size,
    });
    const capture = container.querySelector(".gg-capture")!;
    for (const id of [0, 1, 2]) {
      const candidate = model!.candidates.candidate(id)!;
      pointEvent(capture, "pointermove", candidate.x, candidate.y);
    }
    expect(changes).toHaveLength(0);
    await nextFrame();
    expect(changes).toHaveLength(1);
    expect(changes[0].focus.row?.["id"]).toBe("c");

    const first = model!.candidates.candidate(0)!;
    pointEvent(capture, "pointermove", first.x, first.y);
    capture.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    await nextFrame();
    expect(changes).toHaveLength(1);
    expect(container.querySelector(".gg-tooltip")).toBeNull();
  });

  it("surfaces synthesized aggregate values and lineage, and selects aggregate source keys", async () => {
    let model: RenderModel | null = null;
    const inspections: Array<{
      focus: {
        row: unknown;
        sourceKeys: readonly PropertyKey[];
        lineageCount: number;
      };
    }> = [];
    const selections: Array<{ keys: readonly PropertyKey[] }> = [];
    const data = Array.from({ length: 20 }, (_, index) => ({
      id: `row-${index}`,
      value: index % 5,
    }));
    const { container } = render(GGPlot, {
      data,
      aes: { x: "value" },
      layers: [{ geom: "histogram", params: { bins: 5 } }],
      key: "id",
      inspect: true,
      select: "point",
      onrender: (next: RenderModel) => (model = next),
      oninspect: (event: {
        phase: string;
        focus?: {
          row: unknown;
          sourceKeys: readonly PropertyKey[];
          lineageCount: number;
        };
      }) => {
        if (event.phase === "change" && event.focus !== undefined)
          inspections.push({ focus: event.focus });
      },
      onselect: (event: { phase: string; keys: readonly PropertyKey[] }) => {
        if (event.phase === "end") selections.push(event);
      },
      ...size,
    });
    const aggregate = Array.from({ length: model!.candidates.size }, (_, id) =>
      model!.candidates.candidate(id),
    ).find((candidate) => candidate?.rowIndex === null)!;
    const capture = container.querySelector(".gg-capture")!;
    pointEvent(capture, "pointermove", aggregate.x, aggregate.y);
    await nextFrame();
    expect(inspections.at(-1)?.focus.row).toBeNull();
    expect(inspections.at(-1)?.focus.sourceKeys.length).toBeGreaterThan(1);
    expect(inspections.at(-1)?.focus.lineageCount).toBeGreaterThan(1);
    expect(
      [...container.querySelectorAll(".gg-tooltip dd")].some((value) => value.textContent !== "–"),
    ).toBe(true);

    await expect.poll(() => tool(container, "Select point").disabled).toBe(false);
    tool(container, "Select point").click();
    await expect
      .poll(() => tool(container, "Select point").getAttribute("aria-pressed"))
      .toBe("true");
    const rect = capture.getBoundingClientRect();
    capture.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: rect.left + (aggregate.x / size.width) * rect.width,
        clientY: rect.top + (aggregate.y / size.height) * rect.height,
      }),
    );
    await expect.poll(() => selections.length).toBe(1);
    expect(new Set(selections[0].keys)).toEqual(new Set(inspections.at(-1)!.focus.sourceKeys));
  });

  it("uses the trained semantic-axis formatter for grouped y inspection", async () => {
    let model: RenderModel | null = null;
    const changes: Array<{ mode: string; axisLabel?: string }> = [];
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: rows,
        aes: { x: "x", y: "y", color: "group" },
        layers: [{ geom: "point" }],
        key: "id",
        scales: { y: { labels: ".1f" } },
        inspect: { mode: "y" },
        onrender: (next: RenderModel) => (model = next),
        oninspect: (event: { phase: string; mode?: string; axisLabel?: string }) => {
          if (event.phase === "change" && event.mode !== undefined)
            changes.push({
              mode: event.mode,
              ...(event.axisLabel !== undefined && {
                axisLabel: event.axisLabel,
              }),
            });
        },
        ...size,
      }),
    );
    const candidate = model!.candidates.candidate(0)!;
    pointEvent(container.querySelector(".gg-capture")!, "pointermove", candidate.x, candidate.y);
    await nextFrame();
    expect(changes.at(-1)).toMatchObject({ mode: "y", axisLabel: "10.0" });
    expect(container.querySelector(".gg-crosshair-axis-label-y")?.textContent).toBe("10.0");
  });

  it.each(["x", "y"] as const)(
    "flips the %s dominant-axis crosshair and edge label with coord flip",
    async (mode) => {
      const { container } = render(
        GGPlot,
        withGrammarAsSpec({
          data: rows,
          aes: { x: "x", y: "y" },
          layers: [{ geom: "point" }],
          coord: "flip",
          inspect: { mode },
          ...size,
        }),
      );
      const surface = container.querySelector<HTMLElement>(".gg-capture")!;
      surface.focus();
      surface.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await expect.poll(() => container.querySelector(".gg-crosshair")).not.toBeNull();
      const line = container.querySelector<SVGLineElement>(".gg-crosshair")!;
      if (mode === "x") {
        expect(line.getAttribute("y1")).toBe(line.getAttribute("y2"));
        expect(line.getAttribute("x1")).not.toBe(line.getAttribute("x2"));
      } else {
        expect(line.getAttribute("x1")).toBe(line.getAttribute("x2"));
        expect(line.getAttribute("y1")).not.toBe(line.getAttribute("y2"));
      }
      expect(container.querySelector(`.gg-crosshair-axis-label-${mode}`)).not.toBeNull();
    },
  );

  it("cancels queued inspection on model replacement and never resolves a stale candidate epoch", async () => {
    let model: RenderModel | null = null;
    const changes: unknown[] = [];
    const view = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      onrender: (next: RenderModel) => (model = next),
      oninspect: (event: { phase: string }) => {
        if (event.phase === "change") changes.push(event);
      },
      ...size,
    });
    const staleModel = model!;
    const candidate = staleModel.candidates.candidate(0)!;
    pointEvent(
      view.container.querySelector(".gg-capture")!,
      "pointermove",
      candidate.x,
      candidate.y,
    );
    await view.rerender(
      fromPartial({
        data: [
          { id: "new-a", x: 100, y: 1 },
          { id: "new-b", x: 200, y: 2 },
        ],
      }),
    );
    await expect.poll(() => model?.runId).not.toBe(staleModel.runId);
    await nextFrame();
    expect(changes).toHaveLength(0);
    expect(view.container.querySelector(".gg-tooltip")).toBeNull();
  });

  it("clears reducer ownership when pin keys cannot reconcile to a fresh data identity", async () => {
    let model: RenderModel | null = null;
    const view = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      inspect: true,
      onrender: (next: RenderModel) => (model = next),
      ...size,
    });
    const capture = view.container.querySelector<HTMLElement>(".gg-capture")!;
    const first = model!.candidates.candidate(0)!;
    pointEvent(capture, "pointermove", first.x, first.y);
    await nextFrame();
    capture.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await expect
      .poll(() =>
        view.container.querySelector(".gg-tooltip")?.classList.contains("gg-tooltip-pinned"),
      )
      .toBe(true);

    // New row identities (fresh id values) — default id keys cannot rebind the pin.
    await view.rerender(
      fromPartial({
        data: rows.map((row, index) => ({ ...row, id: `fresh-${String(index)}` })),
      }),
    );
    await expect.poll(() => view.container.querySelector(".gg-tooltip")).toBeNull();
    const second = model!.candidates.candidate(1)!;
    pointEvent(capture, "pointermove", second.x, second.y);
    await nextFrame();
    expect(view.container.querySelector(".gg-tooltip")).not.toBeNull();
  });

  it("keeps SVG/canvas inspection semantics equal and honors mixed horizontal-rule auto mode", async () => {
    const inspect = async (renderBackend: "svg" | "canvas") => {
      let model: RenderModel | null = null;
      const changes: Array<{
        mode: string;
        focus: { key: PropertyKey | null };
      }> = [];
      const view = render(GGPlot, {
        data: rows,
        aes: { x: "x", y: "y" },
        layers: [{ geom: "point", render: renderBackend }],
        key: "id",
        inspect: true,
        onrender: (next: RenderModel) => (model = next),
        oninspect: (event: {
          phase: string;
          mode?: string;
          focus?: { key: PropertyKey | null };
        }) => {
          if (event.phase === "change" && event.mode !== undefined && event.focus !== undefined)
            changes.push({ mode: event.mode, focus: event.focus });
        },
        ...size,
      });
      const seed = model!.candidates.candidate(1)!;
      pointEvent(view.container.querySelector(".gg-capture")!, "pointermove", seed.x, seed.y);
      await nextFrame();
      const result = changes.at(-1)!;
      view.unmount();
      return result;
    };
    expect(await inspect("canvas")).toEqual(await inspect("svg"));

    let mixedModel: RenderModel | null = null;
    const modes: string[] = [];
    const mixed = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }, { geom: "rule", params: { yintercept: 17 } }],
      key: "id",
      inspect: true,
      onrender: (next: RenderModel) => (mixedModel = next),
      oninspect: (event: { phase: string; mode?: string }) => {
        if (event.phase === "change" && event.mode !== undefined) modes.push(event.mode);
      },
      ...size,
    });
    const horizontalRule = Array.from({ length: mixedModel!.candidates.size }, (_, id) =>
      mixedModel!.candidates.candidate(id),
    ).find((candidate) => candidate?.layerIndex === 1)!;
    expect(horizontalRule.autoMode).toBe("y");
    pointEvent(
      mixed.container.querySelector(".gg-capture")!,
      "pointermove",
      horizontalRule.x,
      horizontalRule.y,
    );
    await nextFrame();
    expect(modes.at(-1)).toBe("y");
  });

  it("maps inspection through a CSS transform without overflowing the chart", async () => {
    let model: RenderModel | null = null;
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      onrender: (next: RenderModel) => (model = next),
      ...size,
    });
    const root = container.querySelector<HTMLElement>(".gg-plot-root")!;
    root.style.transform = "scale(0.75)";
    root.style.transformOrigin = "top left";
    const seed = model!.candidates.candidate(2)!;
    pointEvent(container.querySelector(".gg-capture")!, "pointermove", seed.x, seed.y);
    await expect
      .poll(() => {
        const tooltip = container.querySelector<HTMLElement>(".gg-tooltip");
        if (tooltip === null) return false;
        const rootRect = root.getBoundingClientRect();
        const tipRect = tooltip.getBoundingClientRect();
        return (
          tipRect.left >= rootRect.left &&
          tipRect.right <= rootRect.right + 1 &&
          tipRect.bottom <= rootRect.bottom + 1
        );
      })
      .toBe(true);
  });
});

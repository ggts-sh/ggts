import { describe, expect, it } from "vitest";
import { withGrammarAsSpec } from "../../helpers/ggplot-input.js";

import { encodeKey, type RenderModel } from "@ggts-sh/core";
import GGPlot from "../../../src/lib/GGPlot.svelte";
import { createPlotInteraction } from "../../../src/lib/interaction/controller.svelte.js";
import { render } from "../../helpers/render.js";
import { until } from "../../helpers/until.js";
import { drag, rows, size, requireModel } from "../interaction-harness.js";

describe("brush gesture select", () => {
  it("publishes typed native band-brush domains and semantic records", async () => {
    let model: RenderModel | null = null;
    const ended: Array<{
      domain: { x?: readonly [unknown, unknown] };
      keys: readonly PropertyKey[];
    }> = [];
    const interaction = createPlotInteraction<string>();
    const interactionScope = {
      keys: "typed-brush",
      intervals: "typed-brush",
    } as const;
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: [
          { id: "number", x: 1, y: 1 },
          { id: "string", x: "1", y: 2 },
        ],
        aes: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
        scales: { x: { type: "band" } },
        key: "id",
        select: { type: "interval", mode: "x", preset: "cross-panel" },
        interaction,
        interactionScope,
        onselect: (event: {
          phase: string;
          domain: { x?: readonly [unknown, unknown] };
          keys: readonly PropertyKey[];
        }) => {
          if (event.phase === "end") ended.push(event);
        },
        onrender: (next: RenderModel) => {
          model = next;
        },
        ...size,
      }),
    );
    await until(() => model !== null);
    const first = model!.candidates.candidate(0)!;
    const second = model!.candidates.candidate(1)!;
    const halfGap = Math.abs(second.x - first.x) / 2;
    const capture = container.querySelector(".gg-capture")!;
    const selectArea = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent === "Select area")!;
    selectArea.click();
    await until(() => selectArea.getAttribute("aria-pressed") === "true");
    drag(capture, first.x - halfGap + 1, first.y - 8, first.x + halfGap - 1, first.y + 8);
    await until(() => ended.length === 1);

    expect(ended[0]).toEqual(expect.objectContaining({ domain: { x: [1, 1] }, keys: ["number"] }));
    expect(interaction.intervals(interactionScope)[0]).toMatchObject({
      preset: "cross-panel",
      domains: { x: { kind: "band", values: [encodeKey(1)] } },
      keys: ["number"],
    });
  });

  it("clears the committed brush rectangle when the controller clears the interval", async () => {
    let model: RenderModel | null = null;
    const interaction = createPlotInteraction<string>();
    const interactionScope = {
      keys: "stale-rect",
      intervals: "stale-rect",
    } as const;
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "x",
      select: { type: "interval", mode: "x", persistent: true },
      interaction,
      interactionScope,
      onrender: (next: RenderModel) => {
        model = next;
      },
      ...size,
    });
    await until(() => model !== null);
    const capture = container.querySelector(".gg-capture")!;
    const selectArea = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent === "Select area")!;
    selectArea.click();
    await until(() => selectArea.getAttribute("aria-pressed") === "true");
    const first = model!.candidates.candidate(0)!;
    const last = model!.candidates.candidate(2)!;
    drag(capture, first.x - 5, first.y - 10, last.x + 5, last.y + 10);
    await until(() => interaction.intervals(interactionScope).length === 1);
    await until(() => container.querySelector(".gg-selection") !== null);

    // A linked chart (here: programmatic) clears the shared interval; the
    // local pixel rectangle must not outlive its semantic record.
    interaction.clearIntervals({ scope: interactionScope });
    await until(() => container.querySelector(".gg-selection") === null);
  });

  it("clears the committed brush rectangle when a linked chart replaces the same-panel interval", async () => {
    let model: RenderModel | null = null;
    const interaction = createPlotInteraction<string>();
    const interactionScope = {
      keys: "replaced-rect",
      intervals: "replaced-rect",
    } as const;
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "x",
      select: { type: "interval", mode: "x", persistent: true },
      interaction,
      interactionScope,
      onrender: (next: RenderModel) => {
        model = next;
      },
      ...size,
    });
    await until(() => model !== null);
    const capture = container.querySelector(".gg-capture")!;
    const selectArea = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent === "Select area")!;
    selectArea.click();
    await until(() => selectArea.getAttribute("aria-pressed") === "true");
    const first = model!.candidates.candidate(0)!;
    const last = model!.candidates.candidate(2)!;
    drag(capture, first.x - 5, first.y - 10, last.x + 5, last.y + 10);
    await until(() => interaction.intervals(interactionScope).length === 1);
    await until(() => container.querySelector(".gg-selection") !== null);

    // A linked chart replaces this panel's interval with new domains: the
    // old pixels no longer depict the semantic record, so the rectangle
    // must clear even though a record still exists for the panel.
    const record = interaction.intervals(interactionScope)[0];
    interaction.setInterval(
      {
        panelId: record.panelId,
        preset: record.preset,
        domains: { x: { kind: "linear", domain: [1, 2] } },
        keys: ["replacement"],
      },
      { scope: interactionScope },
    );
    await until(() => container.querySelector(".gg-selection") === null);
  });

  it("treats a brush on an empty facet panel as an empty selection", async () => {
    let model: RenderModel | null = null;
    const interaction = createPlotInteraction<string>();
    const interactionScope = {
      keys: "empty-panel",
      intervals: "empty-panel",
    } as const;
    const ended: Array<{ keys: readonly PropertyKey[] }> = [];
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: [
          { id: "p", r: "r1", c: "c1", cat: "m", y: 1 },
          { id: "q", r: "r2", c: "c2", cat: "n", y: 2 },
        ],
        aes: { x: "cat", y: "y" },
        layers: [{ geom: "point" }],
        scales: { x: { type: "band" } },
        facet: { rows: "r", cols: "c", scales: "free" },
        key: "id",
        select: { type: "interval", mode: "x", persistent: true },
        interaction,
        interactionScope,
        onselect: (event: { phase: string; keys: readonly PropertyKey[] }) => {
          if (event.phase === "end") ended.push(event);
        },
        onrender: (next: RenderModel) => {
          model = next;
        },
        ...size,
      }),
    );
    await until(() => model !== null);
    // The r1/c2 combination has no rows: with free scales its band domain is
    // empty, so no semantic axis survives the x selection mode. Brushing it
    // must complete as an empty selection instead of committing an axis-less
    // record (which the controller rejects with a TypeError).
    const empty = model!.scene.panels.find((panel) => panel.strip === "r1 / c2")!;
    expect(empty).not.toBeUndefined();
    const capture = container.querySelector(".gg-capture")!;
    const selectArea = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent === "Select area")!;
    selectArea.click();
    await until(() => selectArea.getAttribute("aria-pressed") === "true");
    drag(
      capture,
      empty.x + empty.width / 4,
      empty.y + empty.height / 4,
      empty.x + (empty.width * 3) / 4,
      empty.y + (empty.height * 3) / 4,
    );
    await until(() => ended.length === 1);
    expect(ended[0].keys).toEqual([]);
    expect(interaction.intervals(interactionScope)).toEqual([]);
  });

  it("brush selects row indices via the hit-index rect query", async () => {
    let model: RenderModel | null = null;
    let renderCount = 0;
    const selections: PropertyKey[][] = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "x",
      select: "interval",
      onselect: (event: { phase: string; keys: readonly PropertyKey[] }) => {
        if (event.phase === "end") selections.push([...event.keys]);
      },
      onrender: (m: RenderModel) => {
        renderCount += 1;
        model = m;
      },
      ...size,
    });
    const scene = model!.scene;
    const panel = scene.panels[0];
    if (panel === undefined) throw new Error("expected a panel");
    const batch = scene.batches[0];
    if (batch === undefined || batch.kind !== "points") throw new Error("unreachable");
    const capture = container.querySelector(".gg-capture")!;
    const selectArea = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent === "Select area")!;
    selectArea.click();
    // A locally chosen tool must survive the next reactive flush. This guards
    // against configuration synchronization accidentally subscribing to and
    // resetting the user's active-tool state.
    await until(() => selectArea.getAttribute("aria-pressed") === "true");
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
    expect(selectArea.getAttribute("aria-pressed")).toBe("true");
    // Rect around the first two points only.
    const xs = [0, 1].map((j) => panel.x + (batch.positions[j * 2] ?? 0));
    const ys = [0, 1].map((j) => panel.y + (batch.positions[j * 2 + 1] ?? 0));
    drag(
      capture,
      Math.max(...xs) + 5,
      Math.max(...ys) + 5,
      Math.min(...xs) - 5,
      Math.min(...ys) - 5,
    );
    await until(() => selections.length > 0);
    expect(selections[0]).toHaveLength(2);
    expect(new Set(selections[0])).toEqual(new Set([1, 2]));

    const rendersAfterBrush = renderCount;
    const editBounds = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent === "Edit x selection bounds")!;
    editBounds.click();
    await until(() => container.querySelector('.gg-bounds-editor input[id$="-lower"]') !== null);
    const upper = container.querySelector<HTMLInputElement>(
      '.gg-bounds-editor input[id$="-upper"]',
    )!;
    upper.value = "1.5";
    upper.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await Promise.resolve();
    expect(renderCount).toBe(rendersAfterBrush);
    container.querySelector<HTMLButtonElement>('.gg-bounds-editor button[type="submit"]')!.click();
    await until(() => selections.length === 2);
    expect(selections[1]).toEqual([1]);
    expect(renderCount).toBe(rendersAfterBrush);
    expect(document.activeElement).toBe(editBounds);
  });

  it("keeps the first facet as origin during two-corner pointer selection", async () => {
    let model: RenderModel | null = null;
    let endedPanelId: string | null | undefined;
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: [
          { id: "north-1", region: "north", x: 1, y: 1 },
          { id: "south-1", region: "south", x: 2, y: 2 },
        ],
        aes: { x: "x", y: "y" },
        facet: { wrap: "region" },
        layers: [{ geom: "point" }],
        key: "id",
        select: "interval",
        onselect: (event: { phase: string; panelId?: string | null }) => {
          if (event.phase === "end") endedPanelId = event.panelId;
        },
        onrender: (next: RenderModel) => {
          model = next;
        },
        ...size,
      }),
    );
    const panels = requireModel(model).scene.panels;
    expect(panels).toHaveLength(2);
    const first = panels[0];
    const second = panels[1];
    if (first === undefined || second === undefined) throw new Error("expected two facet panels");
    const capture = container.querySelector(".gg-capture")!;
    const selectArea = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent === "Select area")!;
    selectArea.click();
    await until(() => selectArea.getAttribute("aria-pressed") === "true");

    const bounds = capture.getBoundingClientRect();
    const pointer = (type: "pointerdown" | "pointerup", x: number, y: number) =>
      capture.dispatchEvent(
        new PointerEvent(type, {
          clientX: bounds.left + (x / size.width) * bounds.width,
          clientY: bounds.top + (y / size.height) * bounds.height,
          bubbles: true,
          button: 0,
          pointerId: 7,
        }),
      );
    const firstCorner = {
      x: first.x + first.width / 2,
      y: first.y + first.height / 2,
    };
    const secondCorner = {
      x: second.x + second.width / 2,
      y: second.y + second.height / 2,
    };
    pointer("pointerdown", firstCorner.x, firstCorner.y);
    pointer("pointerup", firstCorner.x, firstCorner.y);
    pointer("pointerdown", secondCorner.x, secondCorner.y);
    pointer("pointerup", secondCorner.x, secondCorner.y);

    await until(() => endedPanelId !== undefined);
    expect(endedPanelId).toBe(first.id);
  });
});

import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import { withGrammarAsSpec } from "../../helpers/ggplot-input.js";

import type { RenderModel } from "@ggts-sh/core";
import GGPlot from "../../../src/lib/GGPlot.svelte";
import { createPlotInteraction } from "../../../src/lib/interaction/controller.svelte.js";
import { render } from "../../helpers/render.js";
import { until } from "../../helpers/until.js";
import { rows, size } from "../interaction-harness.js";

describe("brush precise bounds", () => {
  it("starts an interval from precise bounds without a brush", async () => {
    let renderCount = 0;
    const selections: Array<{
      keys: readonly PropertyKey[];
      source: string;
    }> = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "x",
      select: { type: "interval", mode: "x" },
      onselect: (event: { phase: string; keys: readonly PropertyKey[]; source: string }) => {
        if (event.phase === "end") selections.push(event);
      },
      onrender: () => {
        renderCount += 1;
      },
      ...size,
    });
    const setBounds = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent?.trim() === "Set x selection bounds")!;
    expect(setBounds).not.toBeUndefined();
    const rendersBeforeEdit = renderCount;
    setBounds.click();
    await until(() => container.querySelector('.gg-bounds-editor input[id$="-lower"]') !== null);
    const [lower, upper] = [
      ...container.querySelectorAll<HTMLInputElement>(".gg-bounds-editor input"),
    ];
    lower.value = "1.5";
    lower.dispatchEvent(new InputEvent("input", { bubbles: true }));
    upper.value = "2.5";
    upper.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(renderCount).toBe(rendersBeforeEdit);

    container.querySelector<HTMLButtonElement>('.gg-bounds-editor button[type="submit"]')!.click();
    await until(() => selections.length === 1);

    expect(selections[0]).toMatchObject({ keys: [2], source: "keyboard" });
    expect(renderCount).toBe(rendersBeforeEdit);
    expect(document.activeElement).toBe(setBounds);
  });

  it("keeps precise bounds nonpersistent when selection is nonpersistent", async () => {
    let model: RenderModel | null = null;
    const interaction = createPlotInteraction<string>();
    const interactionScope = {
      keys: "nonpersistent-bounds",
      intervals: "nonpersistent-bounds",
    } as const;
    const ended: Array<{ keys: readonly PropertyKey[] }> = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "x",
      select: { type: "interval", mode: "x", persistent: false },
      interaction,
      interactionScope,
      onselect: (event: { phase: string; keys: readonly PropertyKey[] }) => {
        if (event.phase === "end") ended.push(event);
      },
      onrender: (next: RenderModel) => {
        model = next;
      },
      ...size,
    });
    await until(() => model !== null);
    const setBounds = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent?.trim() === "Set x selection bounds")!;
    setBounds.click();
    await until(() => container.querySelector('.gg-bounds-editor input[id$="-lower"]') !== null);
    const [lower, upper] = [
      ...container.querySelectorAll<HTMLInputElement>(".gg-bounds-editor input"),
    ];
    lower.value = "1.5";
    lower.dispatchEvent(new InputEvent("input", { bubbles: true }));
    upper.value = "2.5";
    upper.dispatchEvent(new InputEvent("input", { bubbles: true }));
    container.querySelector<HTMLButtonElement>('.gg-bounds-editor button[type="submit"]')!.click();
    await until(() => ended.length === 1);

    // The end event still fires, but `persistent: false` must not leave
    // durable controller state or a committed rectangle behind — precise
    // bounds persist exactly like the brush path.
    expect(ended[0].keys).toEqual([2]);
    expect(interaction.intervals(interactionScope)).toEqual([]);
    expect(container.querySelector(".gg-selection")).toBeNull();
  });

  it("draws the committed rectangle from the applied precise bounds", async () => {
    let model: RenderModel | null = null;
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "x",
      select: { type: "interval", mode: "x", persistent: true },
      onrender: (next: RenderModel) => {
        model = next;
      },
      ...size,
    });
    await until(() => model !== null);
    const setBounds = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent?.trim() === "Set x selection bounds")!;
    setBounds.click();
    await until(() => container.querySelector('.gg-bounds-editor input[id$="-lower"]') !== null);
    const [lower, upper] = [
      ...container.querySelectorAll<HTMLInputElement>(".gg-bounds-editor input"),
    ];
    lower.value = "1.5";
    lower.dispatchEvent(new InputEvent("input", { bubbles: true }));
    upper.value = "2.5";
    upper.dispatchEvent(new InputEvent("input", { bubbles: true }));
    container.querySelector<HTMLButtonElement>('.gg-bounds-editor button[type="submit"]')!.click();
    await until(() => container.querySelector(".gg-selection") !== null);

    // The overlay depicts the applied [1.5, 2.5] interval, not the whole
    // panel: pixel positions are affine in x, so the rect edges sit halfway
    // between adjacent candidate centers.
    const c0 = model!.candidates.candidate(0)!;
    const c1 = model!.candidates.candidate(1)!;
    const c2 = model!.candidates.candidate(2)!;
    const selection = container.querySelector(".gg-selection")!;
    const x = Number(selection.getAttribute("x"));
    const width = Number(selection.getAttribute("width"));
    expect(x).toBeCloseTo((c0.x + c1.x) / 2, 0);
    expect(x + width).toBeCloseTo((c1.x + c2.x) / 2, 0);
  });

  it("draws precise bounds through the post-stat coordinate projector", async () => {
    let model: RenderModel | null = null;
    const data = [1, 10, 100, 1000].map((x) => ({ x, y: 1 }));
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data,
        aes: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
        scales: { x: { type: "linear", domain: [1, 1000], expand: { mult: 0, add: 0 } } },
        coord: { type: "transform", x: { transform: "log10", expand: false } },
        key: "x",
        select: { type: "interval", mode: "x", persistent: true },
        onrender: (next: RenderModel) => {
          model = next;
        },
        ...size,
      }),
    );
    await until(() => model !== null);
    const setBounds = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent?.trim() === "Set x selection bounds")!;
    setBounds.click();
    await until(() => container.querySelector('.gg-bounds-editor input[id$="-lower"]') !== null);
    const [lower, upper] = [
      ...container.querySelectorAll<HTMLInputElement>(".gg-bounds-editor input"),
    ];
    lower.value = "10";
    lower.dispatchEvent(new InputEvent("input", { bubbles: true }));
    upper.value = "100";
    upper.dispatchEvent(new InputEvent("input", { bubbles: true }));
    container.querySelector<HTMLButtonElement>('.gg-bounds-editor button[type="submit"]')!.click();
    await until(() => container.querySelector(".gg-selection") !== null);

    const selection = container.querySelector(".gg-selection")!;
    const x = Number(selection.getAttribute("x"));
    const width = Number(selection.getAttribute("width"));
    expect(x).toBeCloseTo(model!.candidates.candidate(1)!.x, 0);
    expect(x + width).toBeCloseTo(model!.candidates.candidate(2)!.x, 0);
  });

  it("publishes complete shared xy precise domains and source-row lineage", async () => {
    const interaction = createPlotInteraction<string>();
    const interactionScope = {
      keys: "precise-xy",
      intervals: "precise-xy",
    } as const;
    const selections: Array<{
      domain: {
        x?: readonly [unknown, unknown];
        y?: readonly [unknown, unknown];
      };
      keys: readonly PropertyKey[];
      lineageCount: number;
    }> = [];
    interaction.setInterval(
      {
        panelId: "panel:all",
        preset: "independent",
        domains: {
          x: { kind: "linear", domain: [1, 3] },
          y: { kind: "linear", domain: [10, 30] },
        },
        keys: [],
      },
      { scope: interactionScope },
    );
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      select: { type: "interval", mode: "xy" },
      interaction,
      interactionScope,
      onselect: (event: {
        phase: string;
        domain: {
          x?: readonly [unknown, unknown];
          y?: readonly [unknown, unknown];
        };
        keys: readonly PropertyKey[];
        lineageCount: number;
      }) => {
        if (event.phase === "end") selections.push(event);
      },
      ...size,
    });
    const editBounds = [
      ...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ].find((button) => button.textContent === "Edit x selection bounds")!;
    editBounds.click();
    await until(() => container.querySelector('.gg-bounds-editor input[id$="-lower"]') !== null);
    const [lower, upper] = [
      ...container.querySelectorAll<HTMLInputElement>(".gg-bounds-editor input"),
    ];
    lower.value = "1.5";
    lower.dispatchEvent(new InputEvent("input", { bubbles: true }));
    upper.value = "2.5";
    upper.dispatchEvent(new InputEvent("input", { bubbles: true }));
    container.querySelector<HTMLButtonElement>('.gg-bounds-editor button[type="submit"]')!.click();
    await until(() => selections.length === 1);

    expect(selections[0]).toEqual(
      expect.objectContaining({
        domain: { x: [1.5, 2.5], y: [10, 30] },
        // Default row-index identity fills source-row keys for the hit.
        keys: [1],
        lineageCount: 1,
      }),
    );
  });

  it("opens dedicated precise controls for log, time, reversed, and band scales", async () => {
    const fixtures = [
      {
        name: "log",
        data: [
          { x: 1, y: 1 },
          { x: 100, y: 2 },
        ],
        scales: { x: { type: "log" as const } },
        control: "input[type=number]",
      },
      {
        name: "time",
        data: [
          { x: "2025-01-01T00:00:00.000Z", y: 1 },
          { x: "2025-01-03T00:00:00.000Z", y: 2 },
        ],
        scales: { x: { type: "time" as const } },
        control: "input[type=text]",
      },
      {
        name: "reversed",
        data: [
          { x: 1, y: 1 },
          { x: 3, y: 2 },
        ],
        scales: { x: { type: "linear" as const, reverse: true } },
        control: "input[type=number]",
      },
      {
        name: "band",
        data: [
          { x: "north", y: 1 },
          { x: "south", y: 2 },
        ],
        scales: { x: { type: "band" as const } },
        control: "select",
      },
    ];

    for (const fixture of fixtures) {
      const view = render(
        GGPlot,
        fromPartial({
          data: fixture.data,
          aes: { x: "x", y: "y" },
          layers: [{ geom: "point" }],
          scales: fixture.scales,
          select: { type: "interval", mode: "x" },
          ...size,
        }),
      );
      const setBounds = [
        ...view.container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
      ].find((button) => button.textContent?.trim() === "Set x selection bounds");
      expect(setBounds, fixture.name).not.toBeUndefined();
      setBounds!.click();
      await until(
        () => view.container.querySelector(`.gg-bounds-editor ${fixture.control}`) !== null,
      );
      expect(
        view.container.querySelectorAll(`.gg-bounds-editor ${fixture.control}`),
        fixture.name,
      ).toHaveLength(2);
      view.unmount();
    }
  });
});

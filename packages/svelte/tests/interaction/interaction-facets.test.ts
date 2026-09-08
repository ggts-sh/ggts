import { describe, expect, it } from "vitest";
import { withGrammarAsSpec } from "../helpers/ggplot-input.js";

import { encodeKey, type RenderModel } from "@ggts-sh/core";
import GGPlot from "../../src/lib/GGPlot.svelte";
import { createPlotInteraction } from "../../src/lib/interaction/controller.svelte.js";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";
import { rows, size, requireModel } from "./interaction-harness.js";

describe("facets + flip through the component", () => {
  it("renders one clipped panel group per facet value with strips", () => {
    const data = rows.map((r, i) => ({ ...r, g: i < 2 ? "p1" : "p2" }));
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data,
        aes: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
        facet: { wrap: "g" },
        ...size,
      }),
    );
    expect(container.querySelectorAll(".gg-panel")).toHaveLength(2);
    expect(container.querySelectorAll("clipPath")).toHaveLength(2);
    const strips = [...container.querySelectorAll(".gg-strip text")].map((t) => t.textContent);
    expect(strips).toEqual(["p1", "p2"]);
    // Fixed scales: y axis on the left panel only.
    expect(container.querySelectorAll(".gg-axis-y")).toHaveLength(1);
    expect(container.querySelectorAll(".gg-axis-x")).toHaveLength(2);
  });

  it("coord flip renders horizontal bars", () => {
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: [
          { cat: "one", v: 4 },
          { cat: "two", v: 8 },
        ],
        aes: { x: "cat", y: "v" },
        layers: [{ geom: "col" }],
        coord: "flip",
        ...size,
      }),
    );
    const rects = [...container.querySelectorAll(".gg-rects rect")];
    expect(rects).toHaveLength(2);
    for (const rect of rects) {
      const w = Number(rect.getAttribute("width"));
      const h = Number(rect.getAttribute("height"));
      // Continuous axes now reserve the documented 5% display expansion,
      // so the semantic-zero baseline is inset rather than flush to x=0.
      expect(Number(rect.getAttribute("x"))).toBeGreaterThanOrEqual(0);
      expect(w).toBeGreaterThan(h); // horizontal bars
    }
  });

  it("projects controller cross-panel domains and preserves typed band identity", async () => {
    let model: RenderModel | null = null;
    const interaction = createPlotInteraction<string>();
    const interactionScope = {
      keys: "typed-category-id",
      intervals: "typed-category-facets",
    } as const;
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: [
          { id: "number-north", facet: "north", category: 1, y: 1 },
          { id: "string-north", facet: "north", category: "1", y: 2 },
          { id: "number-south", facet: "south", category: 1, y: 3 },
          { id: "string-south", facet: "south", category: "1", y: 4 },
        ],
        aes: { x: "category", y: "y" },
        layers: [{ geom: "point" }],
        facet: { wrap: "facet" },
        key: "id",
        select: { type: "interval", preset: "cross-panel" },
        interaction,
        interactionScope,
        onrender: (next: RenderModel) => {
          model = next;
        },
        ...size,
      }),
    );
    await until(() => model !== null);
    const originPanel = requireModel(model).scene.panels[0];
    if (originPanel === undefined) throw new Error("expected origin panel");
    const origin = originPanel.id;

    interaction.setInterval(
      {
        panelId: origin,
        preset: "cross-panel",
        domains: { x: { kind: "band", values: [encodeKey(1)] } },
        keys: ["stale-origin-key"],
      },
      { scope: interactionScope },
    );
    await until(() => container.querySelectorAll(".gg-selected-ring").length === 2);

    expect(container.querySelectorAll(".gg-selected-ring")).toHaveLength(2);
  });

  it("names the passive shared interval targeted by panel recovery controls", async () => {
    let model: RenderModel | null = null;
    const interaction = createPlotInteraction<string>();
    const interactionScope = {
      keys: "shared-row",
      intervals: "shared-facets",
    } as const;
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: [
          { id: "north", facet: "North", x: 1, y: 1 },
          { id: "south", facet: "South", x: 2, y: 2 },
        ],
        aes: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
        facet: { wrap: "facet" },
        key: "id",
        select: { type: "interval", mode: "x", preset: "union" },
        interaction,
        interactionScope,
        onrender: (next: RenderModel) => (model = next),
        ...size,
      }),
    );
    await until(() => model?.scene.panels.length === 2);
    const renderedModel = requireModel(model);
    for (const panel of renderedModel.scene.panels) {
      interaction.setInterval(
        {
          panelId: panel.id,
          preset: "union",
          domains: { x: { kind: "linear", domain: [0, 3] } },
          keys: [panel.strip.toLowerCase()],
        },
        { scope: interactionScope },
      );
    }
    const targetRecord = interaction.intervals(interactionScope)[0];
    if (targetRecord === undefined) throw new Error("expected interval record");
    const targetPanel = renderedModel.scene.panels.find(
      (panel) => panel.id === targetRecord.panelId,
    );
    if (targetPanel === undefined) throw new Error("expected target panel");
    const targetLabel = targetPanel.strip;
    await until(() =>
      [...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button")].some(
        (button) => button.textContent?.trim() === `Clear panel selection: ${targetLabel}`,
      ),
    );

    const edit = [...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button")].find(
      (button) => button.textContent?.trim() === `Edit x selection bounds: ${targetLabel}`,
    );
    expect(edit).not.toBeUndefined();
    const clear = [...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button")].find(
      (button) => button.textContent?.trim() === `Clear panel selection: ${targetLabel}`,
    )!;
    clear.click();
    await until(() => interaction.intervals(interactionScope).length === 1);
    expect(interaction.intervals(interactionScope)[0]?.panelId).not.toBe(targetRecord.panelId);
  });

  it("disambiguates typed facet values with identical strip text", async () => {
    let model: RenderModel | null = null;
    const interaction = createPlotInteraction<string>();
    const interactionScope = {
      keys: "typed-facet-row",
      intervals: "typed-facet-controls",
    } as const;
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: [
          { id: "number", facet: 1, x: 1, y: 1 },
          { id: "text", facet: "1", x: 2, y: 2 },
        ],
        aes: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
        facet: { wrap: "facet" },
        key: "id",
        select: { type: "interval", mode: "x", preset: "union" },
        interaction,
        interactionScope,
        onrender: (next: RenderModel) => {
          model = next;
        },
        ...size,
      }),
    );
    await until(() => model?.scene.panels.length === 2);
    const renderedModel = requireModel(model);
    for (const panel of renderedModel.scene.panels) {
      interaction.setInterval(
        {
          panelId: panel.id,
          preset: "union",
          domains: { x: { kind: "linear", domain: [0, 3] } },
          keys: [panel.id],
        },
        { scope: interactionScope },
      );
    }
    const clearButton = () =>
      [...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button")].find((button) =>
        button.textContent?.trim().startsWith("Clear panel selection:"),
      );
    await until(() => clearButton() !== undefined);
    const firstLabel = clearButton()?.textContent?.trim();
    clearButton()?.click();
    await until(
      () =>
        interaction.intervals(interactionScope).length === 1 &&
        clearButton()?.textContent?.trim() !== firstLabel,
    );
    const labels = [firstLabel, clearButton()?.textContent?.trim()];
    expect(labels).toContain("Clear panel selection: 1 (facet: number 1)");
    expect(labels).toContain("Clear panel selection: 1 (facet: text 1)");
  });

  it("restores focus and announces when an edited facet disappears", async () => {
    let model: RenderModel | null = null;
    const interaction = createPlotInteraction<string>();
    const interactionScope = { keys: "row", intervals: "facets" } as const;
    const base = {
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" as const }],
      facet: { wrap: "facet" },
      key: "id",
      select: { type: "interval" as const, mode: "x" as const },
      interaction,
      interactionScope,
      onrender: (next: RenderModel) => (model = next),
      ...size,
    };
    const view = render(
      GGPlot,
      withGrammarAsSpec({
        ...base,
        data: [
          { id: "north", facet: "North", x: 1, y: 1 },
          { id: "south", facet: "South", x: 2, y: 2 },
        ],
      }),
    );
    await until(() => model?.scene.panels.length === 2);
    const north = model!.scene.panels.find((panel) => panel.strip === "North")!;
    interaction.setInterval(
      {
        panelId: north.id,
        preset: "independent",
        domains: { x: { kind: "linear", domain: [0, 2] } },
        keys: ["north"],
      },
      { scope: interactionScope },
    );
    const edit = await new Promise<HTMLButtonElement>((resolve, reject) => {
      const started = performance.now();
      const find = () => {
        const button = [
          ...view.container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
        ].find((candidate) => candidate.textContent?.trim() === "Edit x selection bounds: North");
        if (button !== undefined) {
          resolve(button);
          return;
        }
        if (performance.now() - started > 2000) {
          reject(new Error("edit control missing"));
          return;
        }
        requestAnimationFrame(find);
      };
      find();
    });
    edit.click();
    await until(() => view.container.querySelector(".gg-bounds-editor") !== null);

    await view.rerender(
      withGrammarAsSpec({
        ...base,
        data: [{ id: "south", facet: "South", x: 2, y: 2 }],
      }),
    );
    await until(() => view.container.querySelector(".gg-bounds-editor") === null);
    await until(() =>
      (view.container.querySelector("[aria-live='polite']")?.textContent ?? "").includes(
        "Bounds editing cancelled because North is no longer available.",
      ),
    );
    expect(document.activeElement).toBe(view.container.querySelector(".gg-capture"));
    expect(view.container.querySelector("[aria-live='polite']")?.textContent).toContain(
      "Bounds editing cancelled because North is no longer available.",
    );
    const recoveryButtons = [
      ...view.container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button"),
    ];
    expect(
      recoveryButtons.some((button) =>
        button.textContent?.trim().startsWith("Edit x selection bounds"),
      ),
    ).toBe(false);
    expect(
      recoveryButtons.some(
        (button) => button.textContent?.trim() === "Clear panel selection: unavailable panel",
      ),
    ).toBe(true);
  });
});

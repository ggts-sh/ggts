import { describe, expect, it } from "vitest";
import { withGrammarAsSpec } from "../helpers/ggplot-input.js";

import GGPlot from "../../src/lib/GGPlot.svelte";
import "../../src/lib/host-init.js";
import LegendFilterPlot from "../fixtures/LegendFilterPlot.svelte";
import { expectAccessible } from "../helpers/accessibility.js";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";

function parsedArray<T>(value: string | undefined): T[] {
  const parsed: unknown = JSON.parse(value ?? "[]");
  if (!Array.isArray(parsed)) throw new TypeError("Expected a JSON array");
  return parsed as T[];
}

function state(container: HTMLElement): DOMStringMap {
  return container.querySelector<HTMLElement>("[data-legend-filter-state]")!.dataset;
}

describe("explicit legend filtering", () => {
  it("uses native Show-category checkboxes and filters before one pipeline render", async () => {
    const { container } = render(LegendFilterPlot);
    await until(() => container.querySelectorAll(".gg-legend-filters input").length === 2);
    const beforeRenders = state(container)["renders"];
    const beforeColors = state(container)["colors"];
    const north = container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!;

    expect(north.checked).toBe(true);
    north.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" }));
    north.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await until(() => state(container)["candidates"] === "1");

    expect(north.checked).toBe(false);
    expect(Number(state(container)["renders"])).toBe(Number(beforeRenders) + 1);
    expect(state(container)["colors"]).toBe(beforeColors);
    expect(parsedArray(state(container)["events"])).toEqual([
      {
        type: "legend-filter",
        phase: "change",
        source: "pointer",
        clause: {
          scale: "color",
          field: "group",
          values: ["north"],
          mode: "exclude",
        },
      },
    ]);
    await expectAccessible(container);
  });

  it("can hide every category and recover with a separate reset control", async () => {
    const { container } = render(LegendFilterPlot);
    await until(() => container.querySelectorAll(".gg-legend-filters input").length === 2);
    const initialMarkColors = [
      ...container.querySelectorAll<SVGCircleElement>(".gg-points circle"),
    ].map((circle) => circle.getAttribute("fill"));
    container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.click();
    await until(() => state(container)["candidates"] === "1");
    expect(
      [...container.querySelectorAll<SVGCircleElement>(".gg-points circle")].map((circle) =>
        circle.getAttribute("fill"),
      ),
    ).toEqual([initialMarkColors[1]]);
    container.querySelector<HTMLInputElement>("input[aria-label='Show south']")!.click();
    await until(() => state(container)["candidates"] === "0");

    const reset = container.querySelector<HTMLButtonElement>(
      "button[aria-label='Reset legend filters']",
    )!;
    expect(reset).not.toBeNull();
    expect(getComputedStyle(reset).minHeight).toBe("44px");
    reset.click();
    await until(() => state(container)["candidates"] === "3");

    expect(document.activeElement).toBe(
      container.querySelector<HTMLInputElement>("input[aria-label='Show north']"),
    );
    expect(
      [...container.querySelectorAll<HTMLInputElement>(".gg-legend-filters input")].every(
        (input) => input.checked,
      ),
    ).toBe(true);
    expect(
      [...container.querySelectorAll<SVGCircleElement>(".gg-points circle")].map((circle) =>
        circle.getAttribute("fill"),
      ),
    ).toEqual(initialMarkColors);
    const events = parsedArray<Record<string, unknown>>(state(container)["events"]);
    expect(events.at(-1)).toEqual({
      type: "legend-filter",
      phase: "clear",
      source: "keyboard",
      clause: null,
    });
  });

  it("uses tooltip colors for filter controls when the plot ink is light", async () => {
    const { container } = render(LegendFilterPlot);
    container.style.setProperty("--gg-ink", "#e6e8eb");
    container.style.setProperty("--gg-tooltipPaper", "#ffffff");
    container.style.setProperty("--gg-tooltipInk", "#262626");
    await until(() => container.querySelector(".gg-legend-filters label") !== null);

    const label = container.querySelector<HTMLElement>(".gg-legend-filters label")!;
    expect(getComputedStyle(label).color).toBe("rgb(38, 38, 38)");
    expect(getComputedStyle(label).backgroundColor).toBe("rgb(255, 255, 255)");
  });

  it("honors kebab-case tooltip background/foreground aliases on filter chips", async () => {
    // Consumer path from #207: only the kebab pair is set (no camelCase tokens).
    // Without --gg-tooltip-background in the CSS chain, white text on a white
    // fallback surface becomes unreadable.
    const { container } = render(LegendFilterPlot);
    container.style.setProperty("--gg-tooltip-background", "#111111");
    container.style.setProperty("--gg-tooltip-foreground", "#ffffff");
    await until(() => container.querySelector(".gg-legend-filters label") !== null);

    const label = container.querySelector<HTMLElement>(".gg-legend-filters label")!;
    expect(getComputedStyle(label).backgroundColor).toBe("rgb(17, 17, 17)");
    expect(getComputedStyle(label).color).toBe("rgb(255, 255, 255)");

    container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.click();
    await until(
      () => container.querySelector("button[aria-label='Reset legend filters']") !== null,
    );
    const reset = container.querySelector<HTMLButtonElement>(
      "button[aria-label='Reset legend filters']",
    )!;
    expect(getComputedStyle(reset).backgroundColor).toBe("rgb(17, 17, 17)");
    expect(getComputedStyle(reset).color).toBe("rgb(255, 255, 255)");
  });

  it("prefers camelCase tooltip tokens over kebab-case aliases on filter chips", async () => {
    const { container } = render(LegendFilterPlot);
    container.style.setProperty("--gg-tooltipPaper", "#ffffff");
    container.style.setProperty("--gg-tooltipInk", "#262626");
    container.style.setProperty("--gg-tooltip-background", "#111111");
    container.style.setProperty("--gg-tooltip-foreground", "#ffffff");
    await until(() => container.querySelector(".gg-legend-filters label") !== null);

    const label = container.querySelector<HTMLElement>(".gg-legend-filters label")!;
    expect(getComputedStyle(label).backgroundColor).toBe("rgb(255, 255, 255)");
    expect(getComputedStyle(label).color).toBe("rgb(38, 38, 38)");
  });

  it("resets old clauses when the controlled filter mode changes", async () => {
    const view = render(LegendFilterPlot, { mode: "exclude" });
    await until(() => view.container.querySelectorAll(".gg-legend-filters input").length === 2);
    view.container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.click();
    await until(() => state(view.container)["candidates"] === "1");

    await view.rerender({ mode: "include" });
    await until(() => state(view.container)["candidates"] === "3");

    expect(
      [...view.container.querySelectorAll<HTMLInputElement>(".gg-legend-filters input")].every(
        (input) => input.checked,
      ),
    ).toBe(true);
    expect(parsedArray(state(view.container)["events"]).at(-1)).toEqual({
      type: "legend-filter",
      phase: "clear",
      source: "programmatic",
      clause: null,
    });
  });

  it("sends change and clear through the unified interaction callback", async () => {
    const { container } = render(LegendFilterPlot);
    await until(() => container.querySelectorAll(".gg-legend-filters input").length === 2);
    container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.click();
    await until(() => state(container)["candidates"] === "1");
    container
      .querySelector<HTMLButtonElement>("button[aria-label='Reset legend filters']")!
      .click();
    await until(() => state(container)["candidates"] === "3");

    expect(parsedArray(state(container)["interactionEvents"])).toEqual([
      "legend-filter",
      "legend-filter",
    ]);
  });

  it("supports include/single mode and keyboard activation", async () => {
    const { container } = render(LegendFilterPlot, {
      mode: "include",
      multiple: false,
    });
    await until(() => container.querySelectorAll(".gg-legend-filters input").length === 2);
    const south = container.querySelector<HTMLInputElement>("input[aria-label='Show south']")!;
    south.focus();
    south.click();
    await until(() => state(container)["candidates"] === "1");

    expect(south.checked).toBe(true);
    expect(
      container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.checked,
    ).toBe(false);
    expect(parsedArray<{ source?: string }>(state(container)["events"])[0]?.source).toBe(
      "keyboard",
    );
  });

  it("filters canvas marks through the same semantic path", async () => {
    const { container } = render(LegendFilterPlot, { backend: "canvas" });
    await until(() => container.querySelector("canvas.gg-canvas") !== null);
    container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.click();
    await until(() => state(container)["candidates"] === "1");
    expect(container.querySelector("canvas.gg-canvas")).not.toBeNull();
  });

  it("removes invisible filter state when filtering is disabled", async () => {
    let candidates = 0;
    const props = {
      data: [
        { x: 1, y: 1, group: "north" },
        { x: 2, y: 2, group: "south" },
      ],
      aes: { x: "x", y: "y", color: "group" },
      layers: [{ geom: "point" as const }],
      legendFilter: true,
      width: 360,
      height: 260,
      onrender: (model: { candidates: { size: number } }) => {
        candidates = model.candidates.size;
      },
    };
    const view = render(GGPlot, props);
    await until(() => view.container.querySelectorAll(".gg-legend-filters input").length === 2);
    view.container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.click();
    await until(() => candidates === 1);

    await view.rerender({ ...props, legendFilter: false });
    await until(() => candidates === 2);

    expect(view.container.querySelector(".gg-legend-filters")).toBeNull();
  });

  it("filters finite shape legends by their semantic source values", async () => {
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: [
          { x: 1, y: 1, group: "North" },
          { x: 2, y: 2, group: "South" },
        ],
        aes: { x: "x", y: "y", shape: "group" },
        layers: [{ geom: "point" }],
        scales: { shape: { type: "ordinal", range: ["circle", "triangle"] } },
        legendFilter: true,
        width: 360,
        height: 260,
      }),
    );
    await until(() => container.querySelectorAll(".gg-legend-filters input").length === 2);
    container.querySelector<HTMLInputElement>("input[aria-label='Show North']")!.click();
    await until(
      () =>
        container.querySelectorAll(".gg-points circle, .gg-points path, .gg-points rect").length ===
        1,
    );

    expect(
      container.querySelector<HTMLInputElement>("input[aria-label='Show North']")?.checked,
    ).toBe(false);
    expect(container.querySelector(".gg-shape-triangle")).not.toBeNull();
  });

  it("filters discrete numeric style legends (size/linewidth/alpha) too", async () => {
    let candidates = 0;
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: [
          { x: 1, y: 1, group: "North" },
          { x: 2, y: 2, group: "South" },
        ],
        aes: { x: "x", y: "y", size: "group" },
        layers: [{ geom: "point" }],
        scales: { size: { type: "ordinal", range: [4, 8] } },
        legendFilter: true,
        width: 360,
        height: 260,
        onrender: (model: { candidates: { size: number } }) => {
          candidates = model.candidates.size;
        },
      }),
    );
    // An interactive discrete size legend must expose a filter fieldset, just
    // like shape/linetype — the whitelist previously excluded numeric styles.
    await until(() => container.querySelectorAll(".gg-legend-filters input").length === 2);
    container.querySelector<HTMLInputElement>("input[aria-label='Show North']")!.click();
    await until(() => candidates === 1);
    expect(
      container.querySelector<HTMLInputElement>("input[aria-label='Show North']")?.checked,
    ).toBe(false);
  });

  it("does not offer a misleading filter for one scale fed by multiple fields", async () => {
    const { container } = render(GGPlot, {
      data: [
        { x: 1, y: 1, group: "north", kind: "actual" },
        { x: 2, y: 2, group: "south", kind: "forecast" },
      ],
      layers: [
        { geom: "point", aes: { x: "x", y: "y", color: "group" } },
        { geom: "point", aes: { x: "x", y: "y", color: "kind" } },
      ],
      legendFilter: true,
      width: 360,
      height: 260,
    });
    await until(() => container.querySelector(".gg-plot-root") !== null);

    expect(container.querySelector(".gg-legend-filters")).toBeNull();
  });

  it("keeps legends containing scaled constants non-filterable", async () => {
    const { container } = render(GGPlot, {
      data: [
        { x: 1, y: 1, group: "north" },
        { x: 2, y: 2, group: "south" },
      ],
      layers: [
        { geom: "point", aes: { x: "x", y: "y", color: "group" } },
        // A scaled constant feeds the same legend without a field mapping;
        // toggling its entry would filter `group` while this layer stays.
        {
          geom: "line",
          aes: { x: "x", y: "y", color: { value: "reference", scale: true } },
        },
      ],
      legendFilter: true,
      width: 360,
      height: 260,
    });
    await until(() => container.querySelector(".gg-plot-root") !== null);

    expect(container.querySelector(".gg-legend-filters")).toBeNull();
  });

  it("still offers filters when a hidden annotation constant shares the style scale (#598)", async () => {
    // Rowless rule annotation trains the scale but is excluded from the
    // interactive legend domain. That must not disable filters for the data
    // categories that *are* visible.
    const { container } = render(
      GGPlot,
      withGrammarAsSpec({
        data: [
          { x: 1, y: 1, group: "a" },
          { x: 2, y: 2, group: "a" },
          { x: 1, y: 3, group: "b" },
          { x: 2, y: 4, group: "b" },
        ],
        layers: [
          { geom: "line", aes: { x: "x", y: "y", linetype: "group" } },
          {
            geom: "rule",
            aes: { linetype: { value: "threshold", scale: true } },
            params: { yintercept: 2 },
          },
        ],
        scales: { linetype: { type: "ordinal" } },
        legendFilter: true,
        width: 360,
        height: 260,
      }),
    );
    await until(() => container.querySelectorAll(".gg-legend-filters input").length === 2);

    expect(container.querySelector("input[aria-label='Show a']")).not.toBeNull();
    expect(container.querySelector("input[aria-label='Show b']")).not.toBeNull();
    expect(container.querySelector("input[aria-label='Show threshold']")).toBeNull();
  });
});

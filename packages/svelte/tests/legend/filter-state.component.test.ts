/**
 * LegendFilters component tests: combined focus+filter layout, overflow
 * behavior, reset-button focus restoration, pointer-source tracking, and the
 * S2 host onrender sequence when filtering is disabled.
 */
import { describe, expect, it } from "vitest";

import GGPlot from "../../src/lib/GGPlot.svelte";
import "../../src/lib/host-init.js";
import type { LegendFilterEvent } from "../../src/lib/legend/filter.js";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";

import { filterRows } from "./filter-state-fixtures.js";

describe("LegendFilters component layout and pointer source", () => {
  it("combined GuideLegend focus + filter reserves both rows", async () => {
    const { default: LegendFocusAndFilterPlot } =
      await import("../fixtures/LegendFocusAndFilterPlot.svelte");
    const view = render(LegendFocusAndFilterPlot);
    await until(() => view.container.querySelectorAll(".gg-legend-filters input").length === 2);
    await until(() => view.container.querySelector(".gg-legend-target") !== null);

    // Commit a legend focus so the clear control appears (combined layout).
    const legendTarget = view.container.querySelector<HTMLElement>(".gg-legend-target")!;
    legendTarget.focus();
    legendTarget.click();
    await until(() => view.container.querySelector(".gg-with-legend-clear") !== null);

    const root = view.container.querySelector<HTMLElement>(".gg-plot-root")!;
    expect(root.classList.contains("gg-with-legend-filters")).toBe(true);
    // Clear sits to the right of the scene — must not stack a second bottom
    // row or inflate margin-bottom past the filters-only reservation.
    expect(getComputedStyle(root).marginBottom).toBe("58px");

    const fieldset = view.container.querySelector<HTMLElement>(".gg-legend-filters")!;
    // Clear is no longer below the chart, so filters stay on the first control row.
    expect(fieldset.classList.contains("gg-legend-filters-below-clear")).toBe(false);
    // Used value of calc(100% + 4px) with scene height 260 → 264px.
    expect(getComputedStyle(fieldset).top).toBe("264px");

    const clear = view.container.querySelector<HTMLElement>(".gg-legend-clear")!;
    expect(clear).not.toBeNull();
    // Legend-relative: under the pressed guide, still inside the scene
    // (not the old top-right park and not a second bottom row).
    const clearTop = Number(clear.style.top.replace("px", ""));
    const clearLeft = Number(clear.style.left.replace("px", ""));
    expect(clearTop).toBeGreaterThan(4);
    expect(clearTop).toBeLessThan(260);
    expect(clearLeft).toBeGreaterThanOrEqual(4);
    expect(clearLeft).toBeLessThan(360);
    expect(clear.style.top).not.toBe("4px");
    expect(clear.style.left).not.toBe("308px");
  });

  it("narrow container keeps existing max-width and overflow behavior", async () => {
    const view = render(GGPlot, {
      data: filterRows,
      aes: { x: "x", y: "y", color: "group" },
      layers: [{ geom: "point" as const }],
      legendFilter: true,
      width: 120,
      height: 200,
    });
    await until(() => view.container.querySelector(".gg-legend-filters") !== null);

    const fieldset = view.container.querySelector<HTMLElement>(".gg-legend-filters")!;
    const style = getComputedStyle(fieldset);
    expect(style.maxWidth).toBe("calc(100% - 8px)");
    expect(style.overflowX).toBe("auto");
  });

  it("reset-button focus restoration lands on the first checkbox", async () => {
    const view = render(GGPlot, {
      data: filterRows,
      aes: { x: "x", y: "y", color: "group" },
      layers: [{ geom: "point" as const }],
      legendFilter: true,
      width: 360,
      height: 260,
    });
    await until(() => view.container.querySelectorAll(".gg-legend-filters input").length === 2);

    view.container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.click();
    await until(
      () => view.container.querySelector("button[aria-label='Reset legend filters']") !== null,
    );
    const reset = view.container.querySelector<HTMLButtonElement>(
      "button[aria-label='Reset legend filters']",
    )!;
    reset.focus();
    reset.click();
    await until(
      () =>
        document.activeElement ===
        view.container.querySelector<HTMLInputElement>("input[aria-label='Show north']"),
    );
    expect(document.activeElement).toBe(
      view.container.querySelector<HTMLInputElement>("input[aria-label='Show north']"),
    );
  });

  it("pointerdown touch sets event source; pointercancel clears it", async () => {
    const events: LegendFilterEvent[] = [];
    const view = render(GGPlot, {
      data: filterRows,
      aes: { x: "x", y: "y", color: "group" },
      layers: [{ geom: "point" as const }],
      legendFilter: true,
      width: 360,
      height: 260,
      onlegendfilter: (event: LegendFilterEvent) => {
        events.push(event);
      },
    });
    await until(() => view.container.querySelectorAll(".gg-legend-filters input").length === 2);

    const north = view.container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!;
    north.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
    north.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await until(() => events.some((event) => event.phase === "change"));
    expect(events.at(-1)?.source).toBe("touch");

    // Cancel clears the sticky pointer type so the next click is pointer.
    const south = view.container.querySelector<HTMLInputElement>("input[aria-label='Show south']")!;
    south.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
    south.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true }));
    south.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await until(() => events.filter((event) => event.phase === "change").length >= 2);
    expect(events.at(-1)?.source).toBe("pointer");
  });
});

describe("filter capability disable onrender sequence (S2 host)", () => {
  it("emits onrender without a stale filtered model when filtering is disabled", async () => {
    const renders: number[] = [];
    const props = {
      data: filterRows,
      aes: { x: "x", y: "y", color: "group" },
      layers: [{ geom: "point" as const }],
      legendFilter: true as boolean,
      width: 360,
      height: 260,
      onrender: (model: { candidates: { size: number } }) => {
        renders.push(model.candidates.size);
      },
    };
    const view = render(GGPlot, props);
    await until(() => view.container.querySelectorAll(".gg-legend-filters input").length === 2);
    expect(renders.at(-1)).toBe(2);

    view.container.querySelector<HTMLInputElement>("input[aria-label='Show north']")!.click();
    await until(() => renders.at(-1) === 1);
    const afterFilterCount = renders.length;

    await view.rerender({ ...props, legendFilter: false });
    await until(() => renders.at(-1) === 2 && renders.length > afterFilterCount);

    expect(renders.at(-1)).toBe(2);
    const afterDisable = renders.slice(afterFilterCount);
    expect(afterDisable.at(-1)).toBe(2);
  });
});

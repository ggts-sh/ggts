import { describe, expect, it } from "vitest";
import { withGrammarAsSpec } from "./helpers/ggplot-input.js";

import type { RenderModel } from "@ggts-sh/core";

import GGPlot from "../src/lib/GGPlot.svelte";
import LargePinnedTooltip from "./fixtures/LargePinnedTooltip.svelte";
import { render } from "./helpers/render.js";

const rows = [
  { id: "a", x: 1, y: 3 },
  { id: "b", x: 2, y: 7 },
  { id: "c", x: 3, y: 4 },
];

function pointer(capture: Element, type: "pointerdown" | "pointermove", x: number, y: number) {
  capture.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      pointerId: 1,
      clientX: x,
      clientY: y,
      buttons: 1,
    }),
  );
}

describe("DESIGN.md interaction presentation", () => {
  it("uses a borderless underline rail and theme-role variables", () => {
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      select: "interval",
      zoom: true,
      width: 480,
      height: 320,
    });
    const root = container.querySelector<HTMLElement>(".gg-plot-root")!;
    const active = container.querySelector<HTMLElement>(".gg-tool-rail button.active")!;
    expect(root.getAttribute("style")).toContain("--gg-theme-interactionInk");
    expect(getComputedStyle(active).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(active).borderTopWidth).toBe("0px");
    expect(getComputedStyle(active).borderBottomWidth).toBe("2px");
    expect(active.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });

  it("refreshes mixed SVG and canvas strata when the explicit chart theme changes", async () => {
    const models: Array<{ theme: string; backends: string[] }> = [];
    const view = render(
      GGPlot,
      withGrammarAsSpec({
        data: rows,
        aes: { x: "x", y: "y" },
        layers: [
          { geom: "point", render: "canvas" },
          { geom: "line", render: "svg" },
        ],
        theme: "dark",
        width: 480,
        height: 320,
        onrender: (model: RenderModel) => {
          models.push({ theme: model.scene.theme.paper, backends: [...model.layerBackends] });
        },
      }),
    );

    await expect.poll(() => models.at(-1)?.theme).toBe("#16181d");
    expect(models.at(-1)?.backends).toEqual(["canvas", "svg"]);
    expect(view.container.querySelector(".gg-paper")?.getAttribute("fill")).toContain("#16181d");
    expect(view.container.querySelectorAll("canvas")).toHaveLength(1);

    await view.rerender(
      withGrammarAsSpec({
        data: rows,
        aes: { x: "x", y: "y" },
        layers: [
          { geom: "point", render: "canvas" },
          { geom: "line", render: "svg" },
        ],
        theme: "light",
        width: 480,
        height: 320,
        onrender: (model: RenderModel) => {
          models.push({ theme: model.scene.theme.paper, backends: [...model.layerBackends] });
        },
      }),
    );

    await expect.poll(() => models.at(-1)?.theme).toBe("#ffffff");
    expect(models.at(-1)?.backends).toEqual(["canvas", "svg"]);
    expect(view.container.querySelector(".gg-paper")?.getAttribute("fill")).toContain("#ffffff");
    expect(view.container.querySelectorAll("canvas")).toHaveLength(1);
  });

  it("renders a solid translucent select draft and outline-only labelled zoom draft", async () => {
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      select: "interval",
      zoom: true,
      width: 480,
      height: 320,
    });
    const capture = container.querySelector(".gg-capture")!;
    const buttons = [...container.querySelectorAll<HTMLButtonElement>(".gg-tool-rail button")];

    buttons.find((button) => button.textContent === "Select area")!.click();
    pointer(capture, "pointerdown", 120, 100);
    pointer(capture, "pointermove", 260, 220);
    await expect.poll(() => container.querySelector(".gg-area-draft-select")).not.toBeNull();
    const selectDraft = container.querySelector<SVGRectElement>(".gg-area-draft-select")!;
    expect(selectDraft.getAttribute("stroke-dasharray")).toBeNull();
    expect(selectDraft.getAttribute("fill")).not.toBe("none");

    capture.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1 }));
    buttons.find((button) => button.textContent === "Zoom area")!.click();
    pointer(capture, "pointerdown", 140, 110);
    pointer(capture, "pointermove", 280, 230);
    await expect.poll(() => container.querySelector(".gg-area-draft-zoom")).not.toBeNull();
    expect(container.querySelector(".gg-area-draft-zoom")?.getAttribute("fill")).toBe("none");
    expect(container.querySelector(".gg-zoom-label")?.textContent).toBe("Zoom");
  });

  it("keeps crosshairs solid", async () => {
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      inspect: { mode: "xy" },
      width: 480,
      height: 320,
    });
    const capture = container.querySelector<HTMLElement>(".gg-capture")!;
    capture.focus();
    capture.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await expect.poll(() => container.querySelector(".gg-crosshair")).not.toBeNull();
    expect(container.querySelector(".gg-crosshair")?.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("gaps xy crosshairs at the hover ring so they do not bisect the focus", async () => {
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      inspect: { mode: "xy" },
      width: 480,
      height: 320,
    });
    const capture = container.querySelector<HTMLElement>(".gg-capture")!;
    capture.focus();
    capture.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await expect.poll(() => container.querySelector(".gg-hover-ring")).not.toBeNull();
    const ring = container.querySelector<SVGCircleElement>(".gg-hover-ring")!;
    const cx = Number(ring.getAttribute("cx"));
    const cy = Number(ring.getAttribute("cy"));
    const r = Number(ring.getAttribute("r"));
    const lines = [...container.querySelectorAll<SVGLineElement>(".gg-crosshair")];
    // Two axes × two segments when focus is interior.
    expect(lines.length).toBeGreaterThanOrEqual(4);
    for (const line of lines) {
      const x1 = Number(line.getAttribute("x1"));
      const y1 = Number(line.getAttribute("y1"));
      const x2 = Number(line.getAttribute("x2"));
      const y2 = Number(line.getAttribute("y2"));
      // No segment endpoint may land inside the hover ring; the guide hole
      // must clear the focused mark under the halo.
      for (const [x, y] of [
        [x1, y1],
        [x2, y2],
      ] as const) {
        const dist = Math.hypot(x - cx, y - cy);
        expect(dist).toBeGreaterThanOrEqual(r);
      }
      // Segment must not cross the focus point itself.
      const vertical = x1 === x2;
      if (vertical) {
        const lo = Math.min(y1, y2);
        const hi = Math.max(y1, y2);
        expect(cy < lo || cy > hi || Math.abs(x1 - cx) > 0.5).toBe(true);
      } else {
        const lo = Math.min(x1, x2);
        const hi = Math.max(x1, x2);
        expect(cx < lo || cx > hi || Math.abs(y1 - cy) > 0.5).toBe(true);
      }
    }
  });

  it("keeps extracted tool rail and overlay positioned as plot-root siblings", async () => {
    const narrow = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "id",
      inspect: true,
      select: "interval",
      zoom: true,
      width: 400,
      height: 280,
    });
    const narrowRoot = narrow.container.querySelector(".gg-plot-root")!;
    const rail = narrow.container.querySelector<HTMLElement>(".gg-tool-rail")!;
    expect(rail.parentElement).toBe(narrowRoot);
    expect(rail.classList.contains("gg-tool-rail-narrow")).toBe(true);
    expect(getComputedStyle(rail).position).toBe("absolute");

    const wide = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      inspect: { mode: "xy" },
      width: 640,
      height: 360,
    });
    const wideRoot = wide.container.querySelector(".gg-plot-root")!;
    const capture = wide.container.querySelector<HTMLElement>(".gg-capture")!;
    capture.focus();
    capture.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await expect.poll(() => wide.container.querySelector(".gg-interaction-overlay")).not.toBeNull();
    const overlay = wide.container.querySelector<SVGElement>(".gg-interaction-overlay")!;
    expect(overlay.parentElement).toBe(wideRoot);
    expect(getComputedStyle(overlay).position).toBe("absolute");
    expect(getComputedStyle(overlay).pointerEvents).toBe("none");
    // Capture remains the last interactive sibling after the overlay.
    expect([...wideRoot.children].indexOf(overlay) < [...wideRoot.children].indexOf(capture)).toBe(
      true,
    );
  });

  it("preserves chart chrome, reports empty state, and supports faceted intervals", () => {
    const empty = render(
      GGPlot,
      withGrammarAsSpec({
        data: [],
        aes: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
        inspect: true,
        labs: { title: "Empty chart" },
        width: 480,
        height: 320,
      }),
    );
    expect(empty.container.querySelector(".gg-empty-state")?.textContent).toBe(
      "No data to display",
    );
    expect(empty.container.textContent).toContain("Empty chart");

    const unavailable = render(
      GGPlot,
      withGrammarAsSpec({
        data: rows.map((row) => ({ ...row, facet: row.id })),
        aes: { x: "x", y: "y" },
        layers: [{ geom: "point" }],
        facet: { wrap: "facet" },
        select: "interval",
        width: 480,
        height: 320,
      }),
    );
    expect(unavailable.container.querySelector(".gg-capability-status")).toBeNull();
    expect(unavailable.container.textContent).toContain("Select area");
  });

  it("keeps all 1,000 pinned members in labelled, navigable DOM", () => {
    const { container } = render(LargePinnedTooltip);
    const tooltip = container.querySelector(".gg-tooltip")!;
    expect(tooltip.getAttribute("role")).toBe("dialog");
    expect(tooltip.getAttribute("aria-label")).toBe("Data inspection");
    expect(tooltip.classList.contains("gg-tooltip-docked")).toBe(true);
    expect(tooltip.querySelectorAll("dl")).toHaveLength(1_000);
    expect(tooltip.querySelector("button")?.textContent).toBe("Close");
  });
});

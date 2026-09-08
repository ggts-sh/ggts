import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";
import GGPlot from "../../src/lib/GGPlot.svelte";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";
import { requireModel, rows, size } from "./interaction-harness.js";

describe("tooltip first-appear and last-leave motion", () => {
  function pointerMoveAt(capture: Element, x: number, y: number): void {
    const rect = capture.getBoundingClientRect();
    const svg = capture.ownerDocument?.querySelector("svg.gg-plot");
    const plotW = Number(svg?.getAttribute("width")) || size.width;
    const plotH = Number(svg?.getAttribute("height")) || size.height;
    capture.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: rect.left + (x / plotW) * rect.width,
        clientY: rect.top + (y / plotH) * rect.height,
        bubbles: true,
      }),
    );
  }

  it("fades in once per session, stays instant between marks, and ghosts on leave", async () => {
    let model: RenderModel | null = null;
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point", params: { size: 5 } }],
      inspect: true,
      onrender: (m: RenderModel) => {
        model = m;
      },
      ...size,
    });
    const m = requireModel(model);
    const scene = m.scene;
    const panel = scene.panels[0];
    if (panel === undefined) throw new Error("expected a panel");
    const first = m.candidates.candidate(0);
    const second = m.candidates.candidate(1);
    if (first === null || second === null) throw new Error("expected candidates");
    const capture = container.querySelector(".gg-capture")!;

    pointerMoveAt(capture, first.x, first.y);
    await until(() => container.querySelector(".gg-tooltip") !== null);
    const firstTooltip = container.querySelector<HTMLElement>(".gg-tooltip");
    expect(firstTooltip?.dataset.ggTooltipMotion).toBe("enter");
    expect(container.querySelector(".gg-tooltip-ghost")).toBeNull();

    const emptyX = panel.x + 8;
    const emptyY = panel.y + 8;
    pointerMoveAt(capture, emptyX, emptyY);
    await until(() => container.querySelector(".gg-tooltip") === null);
    expect(container.querySelector(".gg-tooltip-ghost")).toBeNull();

    pointerMoveAt(capture, second.x, second.y);
    await until(() => container.querySelector(".gg-tooltip") !== null);
    const secondTooltip = container.querySelector<HTMLElement>(".gg-tooltip");
    expect(secondTooltip?.dataset.ggTooltipMotion).toBeUndefined();

    capture.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    await until(
      () =>
        container.querySelector(".gg-tooltip") === null &&
        container.querySelector(".gg-tooltip-ghost") !== null,
    );
    expect(container.querySelector(".gg-tooltip-ghost")?.id ?? "").toBe("");

    const ghost = container.querySelector(".gg-tooltip-ghost")!;
    ghost.dispatchEvent(
      new TransitionEvent("transitionend", {
        propertyName: "opacity",
        bubbles: true,
      }),
    );
    await until(() => container.querySelector(".gg-tooltip-ghost") === null);
  });
});

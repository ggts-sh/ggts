import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";
import GGPlot from "../../src/lib/GGPlot.svelte";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";
import { rows, size } from "./interaction-harness.js";

describe("point selection", () => {
  it("uses stable keys and exposes a visible clear action", async () => {
    let model: RenderModel | null = null;
    const events: Array<{ phase: string; keys: readonly PropertyKey[] }> = [];
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      key: "x",
      select: "point",
      onselect: (event: { phase: string; keys: readonly PropertyKey[] }) => events.push(event),
      onrender: (next: RenderModel) => (model = next),
      ...size,
    });
    const candidate = model!.candidates.candidate(0)!;
    const capture = container.querySelector(".gg-capture")!;
    const rect = capture.getBoundingClientRect();
    capture.dispatchEvent(
      new MouseEvent("click", {
        clientX: rect.left + (candidate.x / size.width) * rect.width,
        clientY: rect.top + (candidate.y / size.height) * rect.height,
        bubbles: true,
      }),
    );
    await until(() => events.length === 1);
    expect(events[0]?.keys).toEqual([1]);
    expect(container.querySelector(".gg-selected-ring")).not.toBeNull();
    const clear = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Clear selection",
    )!;
    clear.click();
    await until(() => events.length === 2);
    expect(events[1]).toMatchObject({ phase: "clear", keys: [] });
  });
});

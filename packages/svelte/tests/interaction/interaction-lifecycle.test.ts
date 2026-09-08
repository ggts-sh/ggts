import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";

import type { RenderModel } from "@ggts-sh/core";
import GGPlot from "../../src/lib/GGPlot.svelte";
import { render } from "../helpers/render.js";
import { until } from "../helpers/until.js";
import { rows, size } from "./interaction-harness.js";

describe("container width + run ids + disposal", () => {
  it("width='container' follows the host element via ResizeObserver (debounced)", async () => {
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      width: "container",
      height: 300,
    });
    // The testing-library container is a plain block div: sizing it sizes
    // the plot root (width: 100% in container mode).
    container.style.width = "400px";
    await until(() => container.querySelector("svg.gg-plot")?.getAttribute("width") === "400");
    // Resize storm: several width changes back to back; the final width
    // wins (rAF debounce + monotonic run-id commits).
    for (const w of [380, 360, 340, 320]) container.style.width = `${w}px`;
    await until(() => container.querySelector("svg.gg-plot")?.getAttribute("width") === "320");
  });

  it("the previous model is disposed on commit (memory follow-through)", async () => {
    let model: RenderModel | null = null;
    const { rerender } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      ...size,
    });
    // rerender path exists; grab models through onrender on a second mount
    const models: RenderModel[] = [];
    const second = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      onrender: (m: RenderModel) => models.push(m),
      ...size,
    });
    await second.rerender(fromPartial({ data: rows.slice(0, 2) }));
    await until(() => models.length >= 2);
    const [first, latest] = [models[0], models.at(-1)];
    expect(latest).not.toBe(first);
    // Old model disposed: geometry released, row() inert.
    expect(first.scene.batches).toHaveLength(0);
    expect(first.row(0)).toBeNull();
    // Current model intact.
    expect(latest!.scene.batches.length).toBeGreaterThan(0);
    void model;
    void rerender;
  });
});

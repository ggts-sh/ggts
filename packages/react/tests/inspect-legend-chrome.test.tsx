import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import { GGPlot, GeomPoint, GuideLegend, Inspect } from "../src/index.js";

afterEach(cleanup);

const rows = [
  { x: 1, y: 10, id: "a", group: "A" },
  { x: 2, y: 20, id: "b", group: "B" },
];

function hoverFirstMark(container: HTMLElement): void {
  const circle = container.querySelector(".gg-points circle");
  if (circle === null) throw new Error("missing point");
  const box = circle.getBoundingClientRect();
  fireEvent.pointerMove(container.querySelector(".gg-capture")!, {
    clientX: box.left + box.width / 2,
    clientY: box.top + box.height / 2,
  });
}

describe("React inspect tooltip chrome", () => {
  it("matches Svelte default tooltip: compact theme card, pin hint, no Close", async () => {
    const view = render(
      <div style={{ width: 480 }}>
        <GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320}>
          <GeomPoint />
          <Inspect mode="xy" pin maxDistance={48} />
        </GGPlot>
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelector(".gg-capture")).not.toBeNull();
    });
    hoverFirstMark(view.container);
    const tip = await waitFor(() => {
      const node = view.container.querySelector(".gg-tooltip");
      if (node === null) throw new Error("missing tooltip");
      return node;
    });
    const style = getComputedStyle(tip);
    expect(style.padding).toBe("8px 10px");
    expect(Number.parseFloat(style.fontSize)).toBeGreaterThan(10);
    expect(Number.parseFloat(style.fontSize)).toBeLessThan(14);
    expect(style.borderRadius).toBe("3px");
    expect(tip.querySelector(".gg-tooltip-hint")?.textContent).toMatch(/Click to pin/);
    expect(view.queryByRole("button", { name: "Close" })).toBeNull();
    const capture = view.container.querySelector(".gg-capture")!;
    const circle = view.container.querySelector(".gg-points circle")!;
    const box = circle.getBoundingClientRect();
    fireEvent.pointerDown(capture, {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    });
    fireEvent.pointerUp(capture, {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    });
    expect(view.container.querySelector(".gg-tooltip-pinned")).not.toBeNull();
    expect(view.queryByRole("button", { name: "Close" })).toBeNull();
  });
});

describe("React legend focus chrome", () => {
  it("focuses a series from the legend box, not a Focus-button row", async () => {
    const view = render(
      <div style={{ width: 480 }}>
        <GGPlot data={rows} aes={{ x: "x", y: "y", color: "group" }} width={480} height={320}>
          <GeomPoint />
          <GuideLegend channel="color" focus />
        </GGPlot>
      </div>,
    );
    await waitFor(() => {
      expect(view.container.querySelector(".gg-plot-root")).not.toBeNull();
    });
    expect(view.queryByRole("button", { name: "Focus A" })).toBeNull();
    expect(view.container.querySelector(".gg-legend-controls")).toBeNull();
    const target = await view.findByRole("button", { name: /A \(.*legend\)/ });
    expect(target.classList.contains("gg-legend-target")).toBe(true);
    fireEvent.click(target);
    expect(target.getAttribute("aria-pressed")).toBe("true");
    const circles = view.container.querySelectorAll<SVGCircleElement>(".gg-points circle");
    expect([...circles].some((mark) => mark.style.opacity === "0.36")).toBe(true);
  });
});

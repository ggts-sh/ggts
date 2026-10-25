import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";

import {
  createPlotInteraction,
  GGPlot,
  GeomArea,
  GeomPoint,
  GuideLegend,
  Inspect,
  ThemeDark,
  type GGPlotProps,
} from "../src/index.js";

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
    expect(Number(style.fontSize.slice(0, -2))).toBeGreaterThan(10);
    expect(Number(style.fontSize.slice(0, -2))).toBeLessThan(14);
    expect(style.borderRadius).toBe("3px");
    expect(tip.querySelector(".gg-tooltip-hint")?.textContent).toMatch(/Click to pin/);
    expect(getComputedStyle(tip.querySelector(".gg-tooltip-hint")!).fontSize).toBe("10px");
    expect(getComputedStyle(tip.querySelector("dl")!).fontWeight).toBe("600");
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

describe("React inspection crosshair", () => {
  it("matches the Svelte solid guide and displays the axis value", () => {
    const view = render(
      <GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320}>
        <GeomPoint />
        <Inspect mode="x" maxDistance={48} />
      </GGPlot>,
    );
    hoverFirstMark(view.container);
    const guide = view.container.querySelector(".gg-crosshair")!;
    const style = getComputedStyle(guide);
    expect(style.strokeDasharray).toBe("none");
    expect(style.strokeOpacity).toBe("0.55");
    const label = view.container.querySelector(".gg-crosshair-axis-label-x")!;
    expect(label.textContent).toBe("1.0");
    expect(label.getAttribute("x")).toBe(guide.getAttribute("x1"));
  });

  it("unpins from a different mark and immediately resumes free inspection", () => {
    const oninspect = vi.fn<NonNullable<GGPlotProps["oninspect"]>>();
    const view = render(
      <GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320} oninspect={oninspect}>
        <GeomPoint />
        <Inspect mode="xy" pin maxDistance={48} />
      </GGPlot>,
    );
    const capture = view.container.querySelector(".gg-capture")!;
    const clickMark = (index: number, pointerType = "mouse") => {
      const box = view.container
        .querySelectorAll(".gg-points circle")
        .item(index)
        .getBoundingClientRect();
      const clientX = box.left + box.width / 2;
      const clientY = box.top + box.height / 2;
      fireEvent.pointerDown(capture, { clientX, clientY, pointerType });
      fireEvent.pointerUp(capture, { clientX, clientY, pointerType });
    };
    hoverFirstMark(view.container);
    clickMark(0);
    expect(view.container.querySelector(".gg-tooltip-pinned")).not.toBeNull();
    clickMark(1);
    expect(view.container.querySelector(".gg-tooltip-pinned")).toBeNull();
    hoverFirstMark(view.container);
    expect(view.container.querySelector(".gg-tooltip-pinned")).toBeNull();
    const event = oninspect.mock.calls.at(-1)?.[0];
    if (event === undefined || event.phase === "clear") throw new Error("missing inspection");
    expect(event.state).toBe("transient");
    expect(event.focus.key).toBe("a");
    clickMark(0);
    expect(view.container.querySelector(".gg-tooltip-pinned")).not.toBeNull();
    clickMark(1, "touch");
    expect(view.container.querySelector(".gg-tooltip-pinned")).not.toBeNull();
  });
});

describe("React chrome policies", () => {
  it("keeps closed-area hover mute-only without a point ring", () => {
    const view = render(
      <GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320}>
        <GeomArea />
        <Inspect mode="x" maxDistance={48} />
      </GGPlot>,
    );
    const capture = view.container.querySelector(".gg-capture")!;
    fireEvent.keyDown(capture, { key: "Home" });
    expect(view.container.querySelector(".gg-tooltip")).not.toBeNull();
    expect(view.container.querySelector(".gg-hover-ring")).toBeNull();
  });

  it("exposes scene theme tokens to HTML and SVG chrome", () => {
    const onrender = vi.fn<NonNullable<GGPlotProps["onrender"]>>();
    const view = render(
      <GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320} onrender={onrender}>
        <GeomPoint />
        <ThemeDark />
        <Inspect />
      </GGPlot>,
    );
    const model = onrender.mock.calls.at(-1)?.[0];
    if (model === undefined) throw new Error("missing render model");
    const root = view.container.querySelector<HTMLElement>(".gg-plot-root")!;
    expect(root.style.getPropertyValue("--gg-theme-crosshair")).toBe(model.scene.theme.crosshair);
    expect(root.style.getPropertyValue("--gg-theme-tooltipPaper")).toBe(
      model.scene.theme.tooltipPaper,
    );
    expect(root.style.getPropertyValue("--gg-theme-interactionInk")).toBe(
      model.scene.theme.interactionInk,
    );
  });

  it("does not mount an inspect-only rail for a sibling's selection", () => {
    const interaction = createPlotInteraction();
    const scope = { keys: "rows" };
    interaction.setSelection(["a"], { scope });
    const view = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        interaction={interaction}
        interactionScope={scope}
      >
        <GeomPoint />
        <Inspect />
      </GGPlot>,
    );
    expect(view.container.querySelector(".gg-plot-controls")).toBeNull();
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

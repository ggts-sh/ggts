import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { fireEvent, render } from "@testing-library/react";
import { sceneToSVGString } from "@ggts-sh/core";

import {
  createPlotInteraction,
  GGPlot,
  GeomCol,
  GeomPoint,
  GeomText,
  Inspect,
} from "../src/index.js";

vi.mock("@ggts-sh/core", async (importOriginal) => {
  const core = await importOriginal<typeof import("@ggts-sh/core")>();
  return { ...core, sceneToSVGString: vi.fn(core.sceneToSVGString) };
});

const scope = { keys: "plot", x: "x", y: "y" };
/** Above the automatic canvas threshold, so chrome and labels are separate SVG hosts. */
const CANVAS_ROWS = 2100;

function rowsOf(n: number, scale = 1) {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    x: i,
    y: ((i * 37) % 101) * scale,
    label: i < 4 ? `L${i}` : "",
  }));
}

const canvasRows = rowsOf(CANVAS_ROWS);

function chart(input: {
  data?: ReturnType<typeof rowsOf>;
  width?: number;
  interaction: ReturnType<typeof createPlotInteraction>;
}) {
  return (
    <GGPlot
      data={input.data ?? canvasRows}
      aes={{ x: "x", y: "y" }}
      width={input.width ?? 640}
      height={400}
      identity="id"
      interaction={input.interaction}
      interactionScope={scope}
    >
      <GeomPoint />
      <GeomText aes={{ label: "label" }} />
    </GGPlot>
  );
}

const hosts = (container: HTMLElement) => [...container.querySelectorAll(".gg-svg-host")];
const chromeText = (container: HTMLElement) => hosts(container)[0].textContent;
const labels = (container: HTMLElement) =>
  [...container.querySelectorAll<SVGTextElement>(".gg-svg-host .gg-batch text")]
    .filter((label) => label.textContent !== "")
    .map((label) => ({ text: label.textContent, opacity: label.style.opacity }));

afterEach(() => {
  vi.mocked(sceneToSVGString).mockClear();
});

describe("SVG hosts of a canvas chart", () => {
  it("keep chrome through mask changes and a clear", () => {
    const interaction = createPlotInteraction();
    const view = render(chart({ interaction }));
    expect(view.container.querySelector("canvas")).not.toBeNull();
    const chrome = chromeText(view.container);
    expect(chrome).not.toBe("");
    act(() => {
      interaction.setEmphasis(["r1"], { scope });
    });
    expect(chromeText(view.container)).toBe(chrome);
    act(() => {
      interaction.clearEmphasis({ scope });
    });
    expect(chromeText(view.container)).toBe(chrome);
  });

  it("show new chrome after new data, also while a mask is active", () => {
    const interaction = createPlotInteraction();
    const view = render(chart({ interaction }));
    const chrome = chromeText(view.container);
    act(() => {
      interaction.setEmphasis(["r1"], { scope });
    });
    view.rerender(chart({ interaction, data: rowsOf(CANVAS_ROWS, 1000) }));
    expect(chromeText(view.container)).not.toBe(chrome);
  });

  it("follow a resize", () => {
    const interaction = createPlotInteraction();
    const view = render(chart({ interaction }));
    view.rerender(chart({ interaction, width: 800 }));
    expect(hosts(view.container)[0].querySelector("svg")!.getAttribute("width")).toBe("800");
  });

  it("follow a new label when the model does not change", () => {
    const interaction = createPlotInteraction();
    const onrender = vi.fn(() => {});
    const aes = { x: "x", y: "y" };
    const layers = (
      <>
        <GeomPoint />
        <GeomText aes={{ label: "label" }} />
      </>
    );
    const labelled = (ariaLabel: string) => (
      <GGPlot
        data={canvasRows}
        aes={aes}
        width={640}
        height={400}
        identity="id"
        ariaLabel={ariaLabel}
        interaction={interaction}
        interactionScope={scope}
        onrender={onrender}
      >
        {layers}
      </GGPlot>
    );
    const view = render(labelled("first"));
    const svg = () => hosts(view.container)[0].querySelector("svg")!;
    expect(svg().getAttribute("aria-label")).toBe("first");
    const builds = onrender.mock.calls.length;
    view.rerender(labelled("second"));
    expect(onrender.mock.calls.length).toBe(builds);
    expect(svg().getAttribute("aria-label")).toBe("second");
  });

  it("mute SVG labels with the mask, move the mute, and clear it", () => {
    const interaction = createPlotInteraction();
    const view = render(chart({ interaction }));
    const muted = () =>
      labels(view.container)
        .filter((label) => label.opacity !== "")
        .map((label) => label.text);
    expect(labels(view.container)).toHaveLength(4);
    expect(muted()).toEqual([]);
    act(() => {
      interaction.setEmphasis(["r1"], { scope });
    });
    expect(muted()).toEqual(["L0", "L2", "L3"]);
    const first = labels(view.container)[0].opacity;
    act(() => {
      interaction.setEmphasis(["r2"], { scope });
    });
    expect(muted()).toEqual(["L0", "L1", "L3"]);
    // Opacity comes from the attribute, so repeated paints must not compound it.
    expect(labels(view.container)[0].opacity).toBe(first);
    act(() => {
      interaction.clearEmphasis({ scope });
    });
    expect(muted()).toEqual([]);
  });

  it("stay valid when a chart crosses the canvas threshold both ways", () => {
    const interaction = createPlotInteraction();
    const view = render(chart({ interaction }));
    const chrome = chromeText(view.container);
    view.rerender(chart({ interaction, data: rowsOf(50) }));
    expect(view.container.querySelector("canvas")).toBeNull();
    expect(hosts(view.container)).toHaveLength(1);
    expect(hosts(view.container)[0].querySelectorAll("svg")).toHaveLength(1);
    view.rerender(chart({ interaction }));
    expect(view.container.querySelector("canvas")).not.toBeNull();
    expect(chromeText(view.container)).toBe(chrome);
    expect(labels(view.container)).toHaveLength(4);
  });

  it("keep generated ids separate between two plots", () => {
    const first = createPlotInteraction();
    const second = createPlotInteraction();
    const view = render(
      <>
        {chart({ interaction: first })}
        {chart({ interaction: second })}
      </>,
    );
    act(() => {
      first.setEmphasis(["r1"], { scope });
    });
    const ids = [...view.container.querySelectorAll(".gg-svg-host [id]")].map(
      (element) => element.id,
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("work on a mask-only paint", () => {
  const rebuilds = () => vi.mocked(sceneToSVGString).mock.calls.length;

  it("builds no SVG markup when emphasis changes", () => {
    const interaction = createPlotInteraction();
    render(chart({ interaction }));
    vi.mocked(sceneToSVGString).mockClear();
    act(() => {
      interaction.setEmphasis(["r1"], { scope });
    });
    act(() => {
      interaction.clearEmphasis({ scope });
    });
    expect(rebuilds()).toBe(0);
  });

  it("builds no SVG markup when a muteSiblings hover moves", () => {
    const view = render(
      <GGPlot
        data={rowsOf(CANVAS_ROWS).map((row) => ({ ...row, x: `c${row.x}`, y: 100 }))}
        aes={{ x: "x", y: "y" }}
        width={640}
        height={400}
        identity="id"
      >
        <GeomCol />
        <Inspect muteSiblings />
      </GGPlot>,
    );
    const capture = view.container.querySelector(".gg-capture")!;
    const box = capture.getBoundingClientRect();
    vi.mocked(sceneToSVGString).mockClear();
    const paints = vi.spyOn(CanvasRenderingContext2D.prototype, "fillRect");
    for (let i = 0; i < 6; i++) {
      act(() => {
        fireEvent.pointerMove(capture, {
          clientX: box.left + box.width * (0.2 + 0.1 * i),
          clientY: box.top + box.height * 0.6,
          pointerType: "mouse",
        });
      });
    }
    const painted = paints.mock.calls.length;
    paints.mockRestore();
    // Without a repaint this test would pass on any code.
    expect(painted).toBeGreaterThan(0);
    expect(rebuilds()).toBe(0);
  });

  it("builds SVG markup again for new data", () => {
    const interaction = createPlotInteraction();
    const view = render(chart({ interaction }));
    vi.mocked(sceneToSVGString).mockClear();
    view.rerender(chart({ interaction, data: rowsOf(CANVAS_ROWS, 2) }));
    expect(rebuilds()).toBeGreaterThan(0);
  });
});

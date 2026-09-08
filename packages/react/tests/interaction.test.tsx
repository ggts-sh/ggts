import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { fireEvent, render } from "@testing-library/react";

import { createPlotInteraction, GGPlot, GeomPoint, Inspect } from "../src/index.js";

const rows = [
  { x: 1, y: 10, id: "a" },
  { x: 2, y: 20, id: "b" },
];

function clickMark(container: HTMLElement): void {
  const circle = container.querySelector(".gg-points circle");
  const box = circle?.getBoundingClientRect();
  const capture = container.querySelector(".gg-capture");
  const clientX = box!.left + box!.width / 2;
  const clientY = box!.top + box!.height / 2;
  fireEvent.pointerDown(capture!, { clientX, clientY });
  fireEvent.pointerUp(capture!, { clientX, clientY });
}

describe("controlled interaction scope", () => {
  it("throws when interaction is set without interactionScope", () => {
    const controller = createPlotInteraction();
    expect(() => {
      render(
        <GGPlot
          data={rows}
          aes={{ x: "x", y: "y" }}
          width={480}
          height={320}
          zoom
          interaction={controller}
        >
          <GeomPoint />
        </GGPlot>,
      );
    }).toThrow(/interactionScope/);
  });
});

describe("createPlotInteraction", () => {
  it("notifies subscribers and onchange when selection changes", () => {
    const onchange = vi.fn(() => {});
    const controller = createPlotInteraction({ onchange });
    const listener = vi.fn(() => {});
    const unsub = controller.subscribe(listener);
    controller.setSelection(["a"], { scope: { keys: "plot" } });
    expect(controller.selected({ keys: "plot" })).toEqual(["a"]);
    expect(onchange).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
    expect(controller.snapshot.revision).toBe(1);
    unsub();
    controller.clearSelection({ scope: { keys: "plot" } });
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("inspect + select host", () => {
  it("enables inspect via <Inspect /> without crashing", () => {
    const oninspect = vi.fn(() => {});
    const { container } = render(
      <GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320} oninspect={oninspect}>
        <GeomPoint />
        <Inspect />
      </GGPlot>,
    );
    const capture = container.querySelector(".gg-capture");
    expect(capture).not.toBeNull();
    fireEvent.pointerMove(capture!, { clientX: 240, clientY: 160 });
  });

  it("wires select clicks to onselect and the shared controller", () => {
    const onselect = vi.fn(() => {});
    const controller = createPlotInteraction();
    const { container } = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        select="point"
        interaction={controller}
        interactionScope={{ keys: "plot" }}
        onselect={onselect}
      >
        <GeomPoint />
      </GGPlot>,
    );
    clickMark(container);
    expect(onselect).toHaveBeenCalled();
    expect(controller.selected({ keys: "plot" }).length).toBeGreaterThan(0);
  });

  it("uses the id column as the selection key by default", () => {
    const onselect = vi.fn(() => {});
    const { container } = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        select="point"
        onselect={onselect}
      >
        <GeomPoint />
      </GGPlot>,
    );
    clickMark(container);
    const payload = onselect.mock.calls[0]?.[0] as { keys?: PropertyKey[] } | undefined;
    const keys = payload?.keys;
    expect(keys?.[0] === "a" || keys?.[0] === "b").toBe(true);
  });

  it("uses <Inspect identity> over inspect={{ identity }} on the plot", () => {
    const onselect = vi.fn(() => {});
    const { container } = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        inspect={{ identity: "x" }}
        tool="point"
        select="point"
        onselect={onselect}
      >
        <GeomPoint />
        <Inspect identity="id" />
      </GGPlot>,
    );
    clickMark(container);
    const payload = onselect.mock.calls[0]?.[0] as { keys?: PropertyKey[] } | undefined;
    const key = payload?.keys?.[0];
    expect(key === "a" || key === "b").toBe(true);
  });

  it("honors the plot identity prop from JSX (React cannot pass key)", () => {
    const named = [
      { x: 1, y: 10, name: "alpha" },
      { x: 2, y: 20, name: "beta" },
    ];
    const onselect = vi.fn(() => {});
    const { container } = render(
      <GGPlot
        data={named}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        identity="name"
        select="point"
        onselect={onselect}
      >
        <GeomPoint />
      </GGPlot>,
    );
    clickMark(container);
    const payload = onselect.mock.calls[0]?.[0] as { keys?: PropertyKey[] } | undefined;
    const key = payload?.keys?.[0];
    expect(key === "alpha" || key === "beta").toBe(true);
  });
});

describe("createPlotInteraction zoom on the host", () => {
  it("clears trained domains when the controller resetZoom", () => {
    const specs: { scales?: { x?: { domain?: unknown } } }[] = [];
    const controller = createPlotInteraction();
    const scope = { keys: "plot", x: "x", y: "y" };
    render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        zoom
        interaction={controller}
        interactionScope={scope}
        onrender={(_model, spec) => {
          specs.push(spec);
        }}
      >
        <GeomPoint />
      </GGPlot>,
    );
    const baseline = specs.at(-1)?.scales?.x?.domain;
    act(() => {
      controller.setZoom({ x: [0, 1.5] }, { scope });
    });
    expect(specs.at(-1)?.scales?.x?.domain).toEqual([0, 1.5]);
    act(() => {
      controller.resetZoom({ scope });
    });
    expect(specs.at(-1)?.scales?.x?.domain).toEqual(baseline);
  });

  it("does not select when the zoom tool brushes a zoom", () => {
    const onselect = vi.fn(() => {});
    const onzoom = vi.fn(() => {});
    const { container } = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        select="point"
        zoom
        tool="zoom-area"
        onselect={onselect}
        onzoom={onzoom}
      >
        <GeomPoint />
      </GGPlot>,
    );
    const circle = container.querySelector(".gg-points circle");
    const box = circle!.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const capture = container.querySelector(".gg-capture")!;
    fireEvent.pointerDown(capture, { clientX: x, clientY: y });
    fireEvent.pointerUp(capture, { clientX: x + 40, clientY: y + 40 });
    expect(onselect).not.toHaveBeenCalled();
    expect(onzoom).toHaveBeenCalled();
  });

  it("selects on click when zoom is also enabled", () => {
    const onselect = vi.fn(() => {});
    const onzoom = vi.fn(() => {});
    const { container } = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        select="point"
        zoom
        onselect={onselect}
        onzoom={onzoom}
      >
        <GeomPoint />
      </GGPlot>,
    );
    clickMark(container);
    expect(onselect).toHaveBeenCalled();
    expect(onzoom).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { fireEvent, render } from "@testing-library/react";

import { createPlotInteraction, GGPlot, GeomPoint, GeomSmooth, Inspect } from "../src/index.js";

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
  it.each(["pointerCancel", "lostPointerCapture"] as const)(
    "abandons a touch interval on %s and accepts the next gesture",
    (cancelEvent) => {
      const controller = createPlotInteraction();
      const scope = { keys: "plot", x: "x", y: "y" };
      const { container } = render(
        <GGPlot
          data={rows}
          aes={{ x: "x", y: "y" }}
          width={480}
          height={320}
          select="interval"
          tool="select-area"
          interaction={controller}
          interactionScope={scope}
        >
          <GeomPoint />
        </GGPlot>,
      );
      const capture = container.querySelector(".gg-capture")!;
      const box = container.querySelector(".gg-points circle")!.getBoundingClientRect();
      const pointer = {
        pointerId: 1,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
      };
      const start = { ...pointer, clientX: box.left - 5, clientY: box.top - 5 };
      const end = {
        ...pointer,
        clientX: box.right + 5,
        clientY: box.bottom + 5,
      };
      fireEvent.pointerDown(capture, start);
      fireEvent.pointerMove(capture, end);
      expect(container.querySelector(".gg-brush")).not.toBeNull();
      fireEvent[cancelEvent](capture, end);
      fireEvent.pointerUp(capture, end);
      expect(container.querySelector(".gg-brush")).toBeNull();
      expect(controller.intervals(scope)).toEqual([]);
      expect(controller.selected(scope)).toEqual([]);

      fireEvent.pointerDown(capture, start);
      fireEvent.pointerMove(capture, end);
      fireEvent.pointerUp(capture, end);
      expect(controller.intervals(scope)).toHaveLength(1);
      expect(container.querySelector(".gg-brush")).not.toBeNull();
    },
  );

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

describe("source keys of a stat line", () => {
  const line = Array.from({ length: 300 }, (_, index) => ({
    id: `r${index}`,
    name: `n${index}`,
    x: index,
    y: index * 0.5 + (index % 7),
  }));
  type Inspection = { phase?: string; focus: { sourceKeys: readonly PropertyKey[] } };

  function hoverAt(container: HTMLElement, fraction: number): void {
    const capture = container.querySelector(".gg-capture")!;
    const box = capture.getBoundingClientRect();
    fireEvent.pointerMove(capture, {
      clientX: box.left + box.width * fraction,
      clientY: box.top + box.height / 2,
      pointerType: "mouse",
    });
  }

  it("reuses the keys as the pointer moves along the line", () => {
    const events: Inspection[] = [];
    const { container } = render(
      <GGPlot
        data={line}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        identity="id"
        oninspect={(event: Inspection) => {
          if (event.phase !== "clear") events.push(event);
        }}
      >
        <GeomSmooth method="lm" />
        <Inspect mode="x" />
      </GGPlot>,
    );
    hoverAt(container, 0.3);
    hoverAt(container, 0.6);
    expect(events.length).toBe(2);
    expect(events[0].focus.sourceKeys).toHaveLength(line.length);
    expect(events[1].focus.sourceKeys).toBe(events[0].focus.sourceKeys);
  });

  it("reads new keys when the identity prop changes", () => {
    const events: Inspection[] = [];
    const children = [<GeomSmooth key="line" method="lm" />, <Inspect key="inspect" mode="x" />];
    const plotAes = { x: "x", y: "y" };
    const tree = (identity: string) => (
      <GGPlot
        data={line}
        aes={plotAes}
        width={480}
        height={320}
        identity={identity}
        oninspect={(event: Inspection) => {
          if (event.phase !== "clear") events.push(event);
        }}
      >
        {children}
      </GGPlot>
    );
    const { container, rerender } = render(tree("id"));
    hoverAt(container, 0.3);
    expect(events.at(-1)!.focus.sourceKeys).toContain("r0");
    rerender(tree("name"));
    hoverAt(container, 0.6);
    expect(events.at(-1)!.focus.sourceKeys).toContain("n0");
    expect(events.at(-1)!.focus.sourceKeys).not.toContain("r0");
  });

  it("keeps a pin on the line when the chart resizes", () => {
    const events: { phase?: string; state?: string }[] = [];
    const tree = (width: number) => (
      <GGPlot
        data={line}
        aes={{ x: "x", y: "y" }}
        width={width}
        height={320}
        identity="id"
        oninspect={(event: { phase?: string; state?: string }) => {
          events.push(event);
        }}
      >
        <GeomSmooth method="lm" />
        <Inspect mode="x" />
      </GGPlot>
    );
    const { container, rerender } = render(tree(480));
    hoverAt(container, 0.5);
    fireEvent.keyDown(container.querySelector(".gg-capture")!, { key: "Enter" });
    expect(events.at(-1)?.state).toBe("pinned");
    rerender(tree(400));
    expect(events.at(-1)?.state).toBe("pinned");
    expect(events.at(-1)?.phase).not.toBe("clear");
  });

  it("closes a pin when its key leaves the data", () => {
    const events: { phase?: string; state?: string }[] = [];
    const tree = (data: typeof line) => (
      <GGPlot
        data={data}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        identity="id"
        oninspect={(event: { phase?: string; state?: string }) => {
          events.push(event);
        }}
      >
        <GeomSmooth method="lm" />
        <Inspect mode="x" />
      </GGPlot>
    );
    const { container, rerender } = render(tree(line));
    hoverAt(container, 0.5);
    fireEvent.keyDown(container.querySelector(".gg-capture")!, { key: "Enter" });
    expect(events.at(-1)?.state).toBe("pinned");
    rerender(tree(line.map((row) => ({ ...row, id: `other-${row.id}` }))));
    expect(events.at(-1)?.phase).toBe("clear");
  });

  it("mutes the marks outside a brushed interval", () => {
    const controller = createPlotInteraction();
    const { container } = render(
      <GGPlot
        data={[...rows, { x: 3, y: 15, id: "c" }]}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        select="interval"
        tool="select-area"
        interaction={controller}
        interactionScope={{ keys: "plot", x: "x", y: "y" }}
      >
        <GeomPoint />
      </GGPlot>,
    );
    const capture = container.querySelector(".gg-capture")!;
    const box = container.querySelector(".gg-points circle")!.getBoundingClientRect();
    const pointer = { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0 };
    const start = { ...pointer, clientX: box.left - 5, clientY: box.top - 5 };
    const end = { ...pointer, clientX: box.right + 5, clientY: box.bottom + 5 };
    fireEvent.pointerDown(capture, start);
    fireEvent.pointerMove(capture, end);
    fireEvent.pointerUp(capture, end);
    // The brush also selects. With the selection gone, only the interval can mute a mark.
    act(() => {
      controller.clearSelection({ scope: { keys: "plot" } });
    });
    expect(controller.intervals({ keys: "plot", x: "x", y: "y" })).toHaveLength(1);
    const opacities = [...container.querySelectorAll<SVGElement>(".gg-points circle")].map(
      (circle) => circle.style.opacity,
    );
    expect(opacities[0]).toBe("");
    expect(opacities).toHaveLength(3);
    for (const opacity of opacities.slice(1)) {
      expect(opacity).not.toBe("");
      expect(Number(opacity)).toBeLessThan(1);
    }
  });

  it("does not walk the rows once per vertex when the selection changes", () => {
    const controller = createPlotInteraction();
    render(
      <GGPlot
        data={line}
        aes={{ x: "x", y: "y" }}
        width={480}
        height={320}
        identity="id"
        select="point"
        interaction={controller}
        interactionScope={{ keys: "plot", x: "x", y: "y" }}
      >
        <GeomSmooth method="lm" />
      </GGPlot>,
    );
    const adds = vi.spyOn(Set.prototype, "add");
    act(() => {
      controller.setSelection(["r1"], { scope: { keys: "plot" } });
    });
    const addCount = adds.mock.calls.length;
    adds.mockRestore();
    // One walk of the shared lineage is 300 adds. One walk per vertex is about 24000.
    expect(addCount).toBeLessThan(line.length * 10);
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

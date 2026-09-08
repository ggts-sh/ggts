import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { useRef } from "react";

import { aes, gg, normalize } from "@ggsvelte/spec";

import {
  FacetWrap,
  GGPlot,
  GeomLine,
  GeomPoint,
  Labs,
  ScaleColorDiscrete,
  ThemeMinimal,
  type GGPlotHandle,
} from "../src/index.js";

const rows = [
  { x: 1, y: 10, cls: "a" },
  { x: 2, y: 20, cls: "b" },
  { x: 3, y: 15, cls: "a" },
  { x: 4, y: 25, cls: "b" },
];

function markCircles(container: HTMLElement): Element[] {
  return [...container.querySelectorAll(".gg-points circle")];
}

function circleFills(container: HTMLElement): string[] {
  return markCircles(container).map((c) => c.getAttribute("fill") ?? "");
}

describe("<GGPlot> props-first", () => {
  it("renders points from a spec", () => {
    const spec = gg(rows, aes({ x: "x", y: "y", color: "cls" }))
      .geomPoint()
      .spec();
    const { container } = render(<GGPlot spec={spec} width={480} height={320} />);
    const svg = container.querySelector("svg.gg-plot");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("role")).toBe("img");
    expect(markCircles(container)).toHaveLength(4);
    expect(container.querySelectorAll(".gg-axis-x .gg-tick").length).toBeGreaterThan(1);
    const fills = circleFills(container);
    expect(new Set(fills).size).toBe(2);
  });

  it("re-renders when props update", () => {
    const { container, rerender } = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        layers={[{ geom: "point" }]}
        width={480}
        height={320}
      />,
    );
    expect(markCircles(container)).toHaveLength(4);
    rerender(
      <GGPlot
        data={rows.slice(0, 2)}
        aes={{ x: "x", y: "y" }}
        layers={[{ geom: "point" }]}
        width={480}
        height={320}
      />,
    );
    expect(markCircles(container)).toHaveLength(2);
  });
});

describe("scale stability through the component", () => {
  it("removing a series keeps every other color; re-adding restores the old color", () => {
    const plot = (data: typeof rows) => (
      <GGPlot
        data={data}
        aes={{ x: "x", y: "y", color: "cls" }}
        layers={[{ geom: "point" }]}
        width={480}
        height={320}
      />
    );
    const { container, rerender } = render(plot(rows));
    const byClass = () => {
      const fills = circleFills(container);
      return { a: fills[0], b: fills[1] };
    };
    const initial = byClass();
    expect(initial.a).not.toBe(initial.b);
    rerender(plot(rows.filter((r) => r.cls === "b")));
    expect(circleFills(container)).toEqual([initial.b, initial.b]);
    rerender(plot(rows));
    expect(byClass()).toEqual(initial);
  });
});

describe("declaration-only children", () => {
  it("children render the same mark count as equivalent layers", () => {
    const children = render(
      <GGPlot data={rows} aes={{ x: "x", y: "y", color: "cls" }} width={480} height={320}>
        <GeomPoint size={3} alpha={0.8} />
      </GGPlot>,
    );
    const props = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y", color: "cls" }}
        layers={[{ geom: "point", params: { size: 3, alpha: 0.8 } }]}
        width={480}
        height={320}
      />,
    );
    expect(markCircles(children.container)).toHaveLength(4);
    expect(markCircles(props.container)).toHaveLength(4);
  });

  it("equivalence gate: children spec === builder spec === normalized hand-written spec", () => {
    let childrenSpec: unknown;
    render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y", color: "cls" }}
        width={480}
        height={320}
        onrender={(_model, spec) => {
          childrenSpec = spec;
        }}
      >
        <GeomPoint size={3} alpha={0.8} />
        <GeomLine aes={{ color: null }} linewidth={2} />
      </GGPlot>,
    );

    const builderSpec = gg(rows, aes({ x: "x", y: "y", color: "cls" }))
      .geomPoint({ size: 3, alpha: 0.8 })
      .geomLine({ aes: { color: null }, linewidth: 2 })
      .spec();

    const handWritten = normalize({
      data: { values: rows },
      aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "cls" } },
      layers: [
        { geom: "point", params: { size: 3, alpha: 0.8 } },
        { geom: "line", aes: { color: null }, params: { linewidth: 2 } },
      ],
    });

    expect(childrenSpec).toEqual(builderSpec);
    expect(childrenSpec).toEqual(handWritten);
  });

  it("grammar children fold into the assembled spec", () => {
    let childrenSpec: unknown;
    render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y", color: "cls" }}
        width={480}
        height={320}
        onrender={(_model, spec) => {
          childrenSpec = spec;
        }}
      >
        <GeomPoint />
        <ScaleColorDiscrete scheme="observable10" />
        <ThemeMinimal />
        <Labs title="Cars" x="x" y="y" />
        <FacetWrap field="cls" ncol={2} />
      </GGPlot>,
    );
    const spec = childrenSpec as { theme?: string; labs?: { title?: string }; facet?: unknown };
    expect(spec.theme).toBe("minimal");
    expect(spec.labs?.title).toBe("Cars");
    expect(spec.facet).toBeDefined();
  });

  it("prop updates on children flow without remounting the plot root", () => {
    const { container, rerender } = render(
      <GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320}>
        <GeomPoint alpha={0.8} />
      </GGPlot>,
    );
    expect(container.querySelector(".gg-points")?.getAttribute("opacity")).toBe("0.8");
    rerender(
      <GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320}>
        <GeomPoint alpha={0.4} />
      </GGPlot>,
    );
    expect(container.querySelector(".gg-points")?.getAttribute("opacity")).toBe("0.4");
  });
});

describe("readiness + canvas + handle", () => {
  it('flips the root to data-gg-ready="true" with the scene present', () => {
    const { container } = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        layers={[{ geom: "point" }]}
        width={480}
        height={320}
      />,
    );
    const root = container.querySelector<HTMLElement>(".gg-plot-root");
    expect(root?.dataset.ggReady).toBe("true");
    expect(root?.querySelector("svg.gg-plot")).not.toBeNull();
  });

  it("stays not-ready when there is nothing to render", () => {
    const { container } = render(<GGPlot data={rows} width={480} height={320} />);
    const root = container.querySelector<HTMLElement>(".gg-plot-root");
    expect(root?.dataset.ggReady).toBe("false");
  });

  it("renders a canvas sibling for render=canvas layers", () => {
    const { container } = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        layers={[{ geom: "point", render: "canvas" }]}
        width={480}
        height={320}
      />,
    );
    expect(container.querySelector("canvas.gg-canvas")).not.toBeNull();
    expect(container.querySelector("svg.gg-plot")).not.toBeNull();
  });

  it("paints canvas marks under SVG chrome (document order = paint order)", () => {
    const { container } = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        layers={[{ geom: "point", render: "canvas" }]}
        width={480}
        height={320}
      />,
    );
    const painted = [...container.querySelectorAll("svg.gg-plot, canvas.gg-canvas")].map((el) =>
      el.tagName.toLowerCase(),
    );
    expect(painted).toEqual(["svg", "canvas", "svg"]);
  });

  it("paints every canvas stratum", () => {
    const { container } = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        layers={[
          { geom: "point", render: "canvas" },
          { geom: "line", render: "svg" },
          { geom: "point", render: "canvas" },
        ]}
        width={480}
        height={320}
      />,
    );
    expect(container.querySelectorAll("canvas.gg-canvas")).toHaveLength(2);
    expect(
      [...container.querySelectorAll("svg.gg-plot, canvas.gg-canvas")].map((el) =>
        el.tagName.toLowerCase(),
      ),
    ).toEqual(["svg", "canvas", "svg", "canvas", "svg"]);
  });

  it("sets aria-label on the live svg", () => {
    const { container } = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        layers={[{ geom: "point" }]}
        width={480}
        height={320}
        ariaLabel="Highway mpg"
      />,
    );
    expect(container.querySelector("svg.gg-plot")?.getAttribute("aria-label")).toBe("Highway mpg");
  });

  it("updates aria-label on the live svg when the prop changes", () => {
    const { container, rerender } = render(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        layers={[{ geom: "point" }]}
        width={480}
        height={320}
        ariaLabel="Highway mpg"
      />,
    );
    rerender(
      <GGPlot
        data={rows}
        aes={{ x: "x", y: "y" }}
        layers={[{ geom: "point" }]}
        width={480}
        height={320}
        ariaLabel="City mpg"
      />,
    );
    expect(container.querySelector("svg.gg-plot")?.getAttribute("aria-label")).toBe("City mpg");
  });

  it("adding a child geom does not throw", () => {
    const { rerender, container } = render(
      <GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320}>
        <GeomPoint />
      </GGPlot>,
    );
    expect(markCircles(container)).toHaveLength(4);
    rerender(
      <GGPlot data={rows} aes={{ x: "x", y: "y" }} width={480} height={320}>
        <GeomPoint />
        <GeomLine />
      </GGPlot>,
    );
    expect(markCircles(container)).toHaveLength(4);
    expect(container.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("exposes resetScales and setZoom on the ref", () => {
    function Probe() {
      const plot = useRef<GGPlotHandle>(null);
      return (
        <>
          <GGPlot
            ref={plot}
            data={rows}
            aes={{ x: "x", y: "y" }}
            layers={[{ geom: "point" }]}
            width={480}
            height={320}
          />
          <button
            type="button"
            onClick={() => {
              plot.current?.setZoom({ x: [0, 2] });
              plot.current?.resetScales();
            }}
          >
            act
          </button>
        </>
      );
    }
    const { container } = render(<Probe />);
    expect(container.querySelector("svg.gg-plot")).not.toBeNull();
    container.querySelector("button")?.click();
    expect(container.querySelector("svg.gg-plot")).not.toBeNull();
  });
});

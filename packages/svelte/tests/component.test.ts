import "./setup-register-all.js";
/**
 * M0c component tests (vitest 4 browser mode, chromium):
 *  - renders points from a spec
 *  - props updates re-render
 *  - THE flagship behavior: series remove/re-add keeps colors, end-to-end
 *    through the component
 *  - children sugar renders the same output as equivalent props
 *  - equivalence gate (a): children-assembled spec === builder output ===
 *    hand-written PortableSpec after normalize
 */
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import { withGrammarAsSpec } from "./helpers/ggplot-input.js";

import { aes, gg, normalize } from "@ggts-sh/spec";

import GGPlot from "../src/lib/GGPlot.svelte";
import ChildrenPlot from "./fixtures/ChildrenPlot.svelte";
import StackedBarPlot from "./fixtures/StackedBarPlot.svelte";
import StatsPlot from "./fixtures/StatsPlot.svelte";
import { render } from "./helpers/render.js";

const rows = [
  { x: 1, y: 10, cls: "a" },
  { x: 2, y: 20, cls: "b" },
  { x: 3, y: 15, cls: "a" },
  { x: 4, y: 25, cls: "b" },
];

/** clipPath ids are $props.id()-namespaced (unique per plot instance);
 *  equivalence compares everything else. */
function normalizeUids(svg: string | undefined): string | undefined {
  return svg?.replaceAll(/c\d+-clip/g, "clip");
}

/** Mark circles only — colour legends also draw circle keys, so a bare
 *  `circle` query would count keys as data points. */
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
    const { container } = render(GGPlot, { spec, width: 480, height: 320 });
    const svg = container.querySelector("svg.gg-plot");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("role")).toBe("img");
    expect(markCircles(container)).toHaveLength(4);
    expect(container.querySelectorAll(".gg-axis-x .gg-tick").length).toBeGreaterThan(1);
    const fills = circleFills(container);
    expect(new Set(fills).size).toBe(2); // two series, two colors
  });

  it("re-renders when props update", async () => {
    const { container, rerender } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      width: 480,
      height: 320,
    });
    expect(markCircles(container)).toHaveLength(4);
    await rerender({ data: rows.slice(0, 2) });
    expect(markCircles(container)).toHaveLength(2);
  });
});

describe("scale stability through the component (THE flagship behavior)", () => {
  it("removing a series keeps every other color; re-adding restores the old color", async () => {
    const props = (data: typeof rows) => ({
      data,
      aes: { x: "x", y: "y", color: "cls" },
      layers: [{ geom: "point" as const }],
      width: 480,
      height: 320,
    });
    const { container, rerender } = render(GGPlot, props(rows));
    const byClass = () => {
      const fills = circleFills(container);
      // rows order: a, b, a, b
      return { a: fills[0], b: fills[1] };
    };
    const initial = byClass();
    expect(initial.a).not.toBe(initial.b);

    // remove series "a" -> "b" keeps its color (SveltePlot's flagship defect, fixed)
    await rerender(fromPartial({ data: rows.filter((r) => r.cls === "b") }));
    expect(circleFills(container)).toEqual([initial.b, initial.b]);

    // re-add "a" -> it gets its ORIGINAL color back
    await rerender(fromPartial({ data: rows }));
    expect(byClass()).toEqual(initial);
  });
});

const salesRows = [
  { city: "Berlin", kind: "web", sales: 30 },
  { city: "Berlin", kind: "store", sales: 20 },
  { city: "Oslo", kind: "web", sales: 10 },
  { city: "Oslo", kind: "store", sales: 25 },
];

function rectFills(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".gg-rects rect")].map((r) => r.getAttribute("fill") ?? "");
}

describe("stacked bars + legend (M1)", () => {
  it("renders stacked rects, a rule segment, and a titled fill legend", () => {
    const { container } = render(StackedBarPlot, { data: salesRows });
    const rects = container.querySelectorAll(".gg-rects rect");
    expect(rects).toHaveLength(4);
    expect(new Set(rectFills(container)).size).toBe(2);
    expect(container.querySelectorAll(".gg-segments line")).toHaveLength(1);
    const legend = container.querySelector(".gg-legend-fill");
    expect(legend).not.toBeNull();
    expect(legend?.querySelector(".gg-legend-title")?.textContent).toBe("Channel");
    const labels = [...container.querySelectorAll(".gg-legend-label")].map((l) => l.textContent);
    expect(labels).toEqual(["web", "store"]);
    // legend swatch colors match the rect fills
    const swatches = [...container.querySelectorAll(".gg-legend-swatch")].map((s) =>
      s.getAttribute("fill"),
    );
    for (const swatch of swatches) {
      expect(rectFills(container)).toContain(swatch ?? "");
    }
  });

  it("THE flagship behavior, stacked-bar edition: removing a series keeps colors; re-adding restores them", async () => {
    const props = (data: typeof salesRows) => ({
      data,
      aes: { x: "city", y: "sales", fill: "kind" },
      layers: [{ geom: "col" as const }],
      width: 480,
      height: 320,
    });
    const { container, rerender } = render(GGPlot, props(salesRows));
    const byKind = () => {
      const fills = rectFills(container);
      // row order: web, store, web, store — after normalize the batch keeps row order
      return { web: fills[0], store: fills[1] };
    };
    const initial = byKind();
    expect(initial.web).not.toBe(initial.store);

    // remove the "web" series -> "store" keeps its color
    await rerender(fromPartial({ data: salesRows.filter((r) => r.kind === "store") }));
    expect(rectFills(container)).toEqual([initial.store, initial.store]);

    // re-add "web" -> its ORIGINAL color returns
    await rerender(fromPartial({ data: salesRows }));
    expect(byKind()).toEqual(initial);
  });

  it("legend order 'sorted' reorders labels without recoloring swatches", () => {
    const props = {
      data: salesRows,
      aes: { x: "city", y: "sales", fill: "kind" },
      layers: [{ geom: "col" as const }],
      width: 480,
      height: 320,
    };
    const stable = render(GGPlot, props);
    const sorted = render(
      GGPlot,
      withGrammarAsSpec({ ...props, legend: { order: "sorted" as const } }),
    );
    const entries = (c: HTMLElement) => {
      const labels = [...c.querySelectorAll(".gg-legend-label")].map((l) => l.textContent ?? "");
      const colors = [...c.querySelectorAll(".gg-legend-swatch")].map(
        (s) => s.getAttribute("fill") ?? "",
      );
      return new Map(labels.map((label, i) => [label, colors[i] ?? ""]));
    };
    const stableEntries = entries(stable.container);
    const sortedEntries = entries(sorted.container);
    expect([...sortedEntries.keys()]).toEqual(["store", "web"]);
    expect(sortedEntries.get("web")).toBe(stableEntries.get("web") ?? "");
    expect(sortedEntries.get("store")).toBe(stableEntries.get("store") ?? "");
  });
});

describe("declaration-only children (sugar)", () => {
  it("children render the same SVG as the equivalent props", () => {
    const children = render(ChildrenPlot, { data: rows });
    const props = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y", color: "cls" },
      layers: [
        { geom: "point", params: { size: 3, alpha: 0.8 } },
        { geom: "line", aes: { color: null }, params: { linewidth: 2 } },
      ],
      width: 480,
      height: 320,
    });
    const childrenSVG = normalizeUids(children.container.querySelector("svg")?.outerHTML);
    const propsSVG = normalizeUids(props.container.querySelector("svg")?.outerHTML);
    expect(childrenSVG).toBeDefined();
    expect(childrenSVG).toBe(propsSVG);
  });

  it("children prop updates flow into the scene without re-registration", async () => {
    const { container, rerender } = render(ChildrenPlot, { data: rows, alpha: 0.8 });
    expect(container.querySelector(".gg-points")?.getAttribute("opacity")).toBe("0.8");
    await rerender({ alpha: 0.4 });
    expect(container.querySelector(".gg-points")?.getAttribute("opacity")).toBe("0.4");
  });

  it("new-geom children render the same SVG as the equivalent props (equivalence gate)", () => {
    const children = render(StackedBarPlot, { data: salesRows });
    const props = render(
      GGPlot,
      withGrammarAsSpec({
        data: salesRows,
        aes: { x: "city", y: "sales", fill: "kind" },
        layers: [
          { geom: "col", params: { width: 0.8 } },
          { geom: "rule", params: { yintercept: 40 } },
        ],
        labs: { fill: "Channel" },
        width: 480,
        height: 320,
      }),
    );
    const childrenSVG = normalizeUids(children.container.querySelector("svg")?.outerHTML);
    const propsSVG = normalizeUids(props.container.querySelector("svg")?.outerHTML);
    expect(childrenSVG).toBeDefined();
    expect(childrenSVG).toBe(propsSVG);
  });

  it("equivalence gate (b): stacked-bar children spec === builder spec", () => {
    let childrenSpec: unknown;
    render(StackedBarPlot, {
      data: salesRows,
      onrender: (_model: unknown, spec: unknown) => {
        childrenSpec = spec;
      },
    });
    const builderSpec = gg(salesRows, aes({ x: "city", y: "sales", fill: "kind" }))
      .geomCol({ width: 0.8 })
      .geomRule({ yintercept: 40 })
      .labs({ fill: "Channel" })
      .spec();
    expect(childrenSpec).toEqual(builderSpec);
  });

  it("equivalence gate (a): children spec === builder spec === normalized hand-written spec", () => {
    let childrenSpec: unknown;
    render(ChildrenPlot, {
      data: rows,
      onrender: (_model: unknown, spec: unknown) => {
        childrenSpec = spec;
      },
    });

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
});

describe("data-gg-ready readiness signal (M1 VR workstream)", () => {
  it('flips the root to data-gg-ready="true" after the first render flush, with the scene present', async () => {
    const { container } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      width: 480,
      height: 320,
    });
    const root = container.querySelector<HTMLElement>(".gg-plot-root");
    expect(root).not.toBeNull();
    // The attribute exists from first paint and flips to "true" once the
    // post-render effect flush commits (the render helper may have flushed
    // it already by the time we look — both are fine for VR waiting).
    expect(root?.dataset.ggReady).toBeDefined();
    await expect.poll(() => root?.dataset.ggReady).toBe("true");
    // The readiness flip must come with the rendered scene in the DOM.
    expect(root?.querySelector("svg.gg-plot")).not.toBeNull();
  });

  it("stays not-ready when there is nothing to render (no layers)", async () => {
    const { container } = render(GGPlot, { data: rows, width: 480, height: 320 });
    const root = container.querySelector<HTMLElement>(".gg-plot-root");
    expect(root?.dataset.ggReady).toBe("false");
    await Promise.resolve(); // a microtask later it is STILL not ready
    expect(root?.dataset.ggReady).toBe("false");
  });

  it("clears data-gg-ready in the same update when the plot becomes unready", async () => {
    const { container, rerender } = render(GGPlot, {
      data: rows,
      aes: { x: "x", y: "y" },
      layers: [{ geom: "point" }],
      width: 480,
      height: 320,
    });
    const root = container.querySelector<HTMLElement>(".gg-plot-root");
    await expect.poll(() => root?.dataset.ggReady).toBe("true");
    // Explicit empty layers → no model → not ready. Derived predicate must
    // clear the attribute in this commit (not wait for a post-flush $effect).
    await rerender(
      fromPartial({
        data: rows,
        aes: { x: "x", y: "y" },
        layers: [],
        width: 480,
        height: 320,
      }),
    );
    expect(root?.dataset.ggReady).toBe("false");
  });
});

describe("M2 statistical children components", () => {
  const statRows = [
    { x: 1, y: 2.1 },
    { x: 2, y: 3.9 },
    { x: 3, y: 6.2 },
    { x: 4, y: 7.8 },
    { x: 5, y: 10.1 },
    { x: 6, y: 12.2 },
  ];

  it("equivalence gate: <GeomPoint jitter> + <GeomSmooth> === builder output", async () => {
    let childrenSpec: unknown;
    const { container } = render(StatsPlot, {
      data: statRows,
      onrender: (_model: unknown, spec: unknown) => {
        childrenSpec = spec;
      },
    });
    const builderSpec = gg(statRows, aes({ x: "x", y: "y" }))
      .geomPoint({ position: "jitter", positionParams: { seed: 9, width: 0.1 }, alpha: 0.6 })
      .geomSmooth({ method: "lm", level: 0.9 })
      .spec();
    expect(childrenSpec).toEqual(builderSpec);
    // Composite render: jittered points + ribbon (closed area path) + line.
    await expect.poll(() => container.querySelectorAll("circle").length).toBe(6);
    expect(container.querySelectorAll(".gg-areas path")).toHaveLength(1);
    expect(container.querySelectorAll(".gg-paths path")).toHaveLength(1);
  });

  it("<GeomBoxplot> renders the composite geometry (whiskers + boxes + medians)", () => {
    const boxRows = [
      { cat: "a", v: 1 },
      { cat: "a", v: 2 },
      { cat: "a", v: 3 },
      { cat: "b", v: 4 },
      { cat: "b", v: 6 },
      { cat: "b", v: 9 },
    ];
    const { container } = render(GGPlot, {
      data: boxRows,
      aes: { x: "cat", y: "v" },
      layers: [{ geom: "boxplot" }],
      width: 480,
      height: 320,
    });
    expect(container.querySelectorAll(".gg-rects rect")).toHaveLength(2);
    // 2 whiskers x 2 boxes + 2 medians = 6 segment lines across two batches.
    expect(container.querySelectorAll(".gg-segments line")).toHaveLength(6);
    const box = container.querySelector(".gg-rects rect");
    expect(box?.getAttribute("stroke")).toContain("--gg-ink");
  });
});

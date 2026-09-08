/**
 * Node smoke test for the PURE entry (no DOM globals) + renderToSVGString
 * determinism, including the M0c equivalence gate: one PortableSpec + fixed
 * RunOptions (canonical metrics measurer) -> byte-identical SVG across two
 * runs and across builder-vs-spec inputs.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg, normalize } from "@ggts-sh/spec";

import { PipelineError } from "../src/pipeline.ts";
import { renderToSVGString } from "../src/render-svg-full.ts";
import { resolveTheme } from "../src/theme.ts";
import type { GeometryBatch, Scene, ScenePanel } from "../src/scene.ts";

const rows = [
  { x: 1, y: 10, cls: "a" },
  { x: 2, y: 20, cls: "b" },
  { x: 3, y: 15, cls: "a" },
  { x: 4, y: 25, cls: "b" },
];

describe("pure entry (Node smoke)", () => {
  it("imports and renders with no DOM globals", async () => {
    expect(typeof globalThis.document).toBe("undefined");
    expect(typeof globalThis.window).toBe("undefined");
    const entry = await import("../src/index.ts");
    const svg = entry.renderToSVGString(
      gg(rows, aes({ x: "x", y: "y", color: "cls" }))
        .geomPoint({ alpha: 0.8 })
        .geomLine(),
      { width: 640, height: 400 },
    );
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('role="img"');
    expect(svg).toContain("<title>");
    expect(svg).toContain("<circle");
    expect(svg).toContain("<path d=");
    expect(svg).toContain("gg-axis-x");
    expect(svg).toContain("Roboto Condensed");
    expect(svg).toContain("--gg-grid");
    expect(svg).toContain('stroke-width="0.4"');
    expect(svg).not.toContain("gg-axis-line");
  });
});

describe("renderToSVGString — determinism + equivalence (M0c gate)", () => {
  const builder = gg(rows, aes({ x: "x", y: "y", color: "cls" }))
    .geomPoint({ size: 3 })
    .labs({ title: "Fuel", x: "X", y: "Y" });

  it("byte-identical across two runs", () => {
    const a = renderToSVGString(builder, { width: 640, height: 400 });
    const b = renderToSVGString(builder, { width: 640, height: 400 });
    expect(a).toBe(b);
  });

  it("byte-identical across builder vs hand-written PortableSpec inputs", () => {
    const viaBuilder = renderToSVGString(builder, { width: 640, height: 400 });
    const handWritten = normalize({
      data: { values: rows },
      aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "cls" } },
      layers: [{ geom: "point", params: { size: 3 } }],
      labs: { title: "Fuel", x: "X", y: "Y" },
    });
    const viaSpec = renderToSVGString(handWritten, { width: 640, height: 400 });
    expect(viaSpec).toBe(viaBuilder);
  });

  it("escapes markup in labels", () => {
    const svg = renderToSVGString(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .labs({ title: 'A <b>&"title"' }),
      { width: 400, height: 300 },
    );
    expect(svg).toContain("A &lt;b&gt;&amp;&quot;title&quot;");
    expect(svg).not.toContain("<b>");
  });

  it("step curves bend at midpoints", () => {
    const svg = renderToSVGString(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      ).geomLine({
        curve: "step",
      }),
      { width: 400, height: 300 },
    );
    const d = /<path d="([^"]+)"/.exec(svg)?.[1] ?? "";
    // M, then two step Ls, then the final L: 4 commands minimum
    expect(d.split("L").length).toBe(4);
  });

  it("geom step hv/vh insert one corner; mid inserts two", () => {
    const stepRows = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    const pathD = (direction: "hv" | "vh" | "mid") => {
      const svg = renderToSVGString(gg(stepRows, aes({ x: "x", y: "y" })).geomStep({ direction }), {
        width: 400,
        height: 300,
      });
      return /<path d="([^"]+)"/.exec(svg)?.[1] ?? "";
    };
    // M + 1 corner L + endpoint L → 3 L segments for hv/vh
    expect(pathD("hv").split("L").length).toBe(3);
    expect(pathD("vh").split("L").length).toBe(3);
    // M + 2 mid Ls + endpoint → 4
    expect(pathD("mid").split("L").length).toBe(4);
  });

  it("enforces maxMarks", () => {
    expect(() =>
      renderToSVGString(gg(rows, aes({ x: "x", y: "y" })).geomPoint(), {
        width: 640,
        height: 400,
        maxMarks: 3,
      }),
    ).toThrow(PipelineError);
  });

  it("maxMarks raises max-marks-exceeded with path and message", () => {
    try {
      renderToSVGString(gg(rows, aes({ x: "x", y: "y" })).geomPoint(), {
        width: 640,
        height: 400,
        maxMarks: 3,
      });
      expect.unreachable("expected PipelineError");
    } catch (error) {
      expect(error).toBeInstanceOf(PipelineError);
      const pe = error as PipelineError;
      expect(pe.code).toBe("max-marks-exceeded");
      expect(pe.path).toBe("/layers");
      expect(pe.message).toContain("maxMarks");
      expect(pe.message).toContain("3");
    }
  });
});

describe("render-svg public facade", () => {
  it("exposes only the known runtime exports", async () => {
    const facade = await import("../src/render-svg.ts");
    expect(Object.keys(facade).toSorted()).toEqual(
      ["countMarks", "pathData", "renderToSVGString", "sceneLabel", "sceneToSVGString"].toSorted(),
    );
  });

  it("package root re-exports the same values and RenderSVGOptions type", async () => {
    const root = await import("../src/index.ts");
    expect(typeof root.countMarks).toBe("function");
    expect(typeof root.pathData).toBe("function");
    expect(typeof root.renderToSVGString).toBe("function");
    expect(typeof root.sceneLabel).toBe("function");
    expect(typeof root.sceneToSVGString).toBe("function");
    // Type-only freeze: RenderSVGOptions must remain importable from the package root.
    type _Opts = import("../src/index.ts").RenderSVGOptions;
    const opts: _Opts = { width: 1, height: 1 };
    expect(opts.width).toBe(1);
  });
});

describe("sceneToSVGString panel batch routing", () => {
  function multiPanelScene(
    panelCount: number,
    batchesPerPanel: number,
  ): {
    theme: ReturnType<typeof resolveTheme>;
    panels: ScenePanel[];
    rawBatches: GeometryBatch[];
    sceneBase: Omit<Scene, "theme" | "panels" | "batches">;
  } {
    const theme = resolveTheme();
    const panels: ScenePanel[] = Array.from({ length: panelCount }, (_, i) => ({
      id: `p${i}`,
      x: i * 10,
      y: 0,
      width: 10,
      height: 10,
      strip: "",
      axisX: null,
      axisY: null,
      grid: { x: [], y: [] },
      clip: true,
    }));
    // Interleave layers across panels so a full re-scan would thrash:
    // batch order: (panel 0 layer 0), (panel 1 layer 0), … then layer 1…
    const rawBatches: GeometryBatch[] = [];
    for (let layer = 0; layer < batchesPerPanel; layer++) {
      for (let p = 0; p < panelCount; p++) {
        rawBatches.push({
          kind: "points",
          layerIndex: layer,
          panelIndex: p,
          positions: Float32Array.from([layer + 1, p + 1]),
          rowIndex: Uint32Array.from([layer * panelCount + p]),
          size: 1,
          alpha: 1,
          shape: "circle",
          fill: `c${layer}-${p}`,
        });
      }
    }
    // Invalid indices must be skipped without throwing or polluting buckets.
    rawBatches.push({
      kind: "points",
      layerIndex: 99,
      panelIndex: Number.NaN,
      positions: Float32Array.from([0, 0]),
      rowIndex: Uint32Array.from([999]),
      size: 1,
      alpha: 1,
      shape: "circle",
      fill: "invalid",
    });
    return {
      theme,
      panels,
      rawBatches,
      sceneBase: {
        width: panelCount * 10,
        height: 20,
        axes: { x: { ticks: [], title: "" }, y: { ticks: [], title: "" } },
        grid: { x: [], y: [] },
        legends: [],
        title: "",
        subtitle: "",
        caption: "",
      },
    };
  }

  it("inspects each batch once regardless of panel count (not O(P·B) re-scan)", async () => {
    const { sceneToSVGString } = await import("../src/render-svg-scene.ts");
    const panelCount = 16;
    const batchesPerPanel = 3;
    const { theme, panels, rawBatches, sceneBase } = multiPanelScene(panelCount, batchesPerPanel);
    let indexReads = 0;
    const batches = new Proxy(rawBatches, {
      get(target, property, receiver): unknown {
        if (typeof property === "string" && /^\d+$/.test(property)) indexReads++;
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    const svg = sceneToSVGString({
      ...sceneBase,
      theme,
      panels,
      batches,
    });
    // Paint resource collection walks each list index once, then
    // groupBatchesByPanel walks once more (including the invalid entry).
    // Still O(B), not O(P·B).
    expect(indexReads).toBe(rawBatches.length * 2);
    // Every valid batch still rendered once (fill color is unique per batch).
    for (let layer = 0; layer < batchesPerPanel; layer++) {
      for (let p = 0; p < panelCount; p++) {
        expect(svg).toContain(`fill="c${layer}-${p}"`);
      }
    }
    expect(svg).not.toContain('fill="invalid"');
  });

  it("keeps panel order, within-panel batch order, and clip wrappers", async () => {
    const { sceneToSVGString } = await import("../src/render-svg-scene.ts");
    const { theme, panels, rawBatches, sceneBase } = multiPanelScene(3, 2);
    panels[1] = { ...panels[1]!, clip: false };
    const svg = sceneToSVGString({
      ...sceneBase,
      theme,
      panels,
      batches: rawBatches.filter((b) => Number.isInteger(b.panelIndex)),
    });
    const panelStarts = [...svg.matchAll(/data-panel="(\d+)"/g)].map((m) => m[1]);
    expect(panelStarts).toEqual(["0", "1", "2"]);
    // Within panel 0: layer 0 then layer 1 (c0-0 before c1-0).
    expect(svg.indexOf('fill="c0-0"')).toBeLessThan(svg.indexOf('fill="c1-0"'));
    expect(svg.indexOf('fill="c0-1"')).toBeLessThan(svg.indexOf('fill="c1-1"'));
    // Panel 0 clipped; panel 1 unclipped marks group.
    expect(svg).toContain('clip-path="url(#gg-clip-0)"');
    const panel1Block = svg.slice(svg.indexOf('data-panel="1"'), svg.indexOf('data-panel="2"'));
    expect(panel1Block).toContain('class="gg-marks"');
    expect(panel1Block).not.toContain("clip-path=");
  });
});

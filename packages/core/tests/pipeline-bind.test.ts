/**
 * Characterization tests for data/layer binding extracted from the pipeline.
 * Pins structured error codes and successful channel resolution contracts.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { bindLayerTable, bindPlotData } from "../src/pipeline/bind-data.ts";
import { bindLayer } from "../src/pipeline/bind-layer.ts";
import { PipelineError, runPipeline } from "../src/pipeline.ts";
import { ColumnTable } from "../src/table.ts";

const size = { width: 640, height: 400 };
const table = ColumnTable.fromRows([
  { x: 1, y: 10, g: "a" },
  { x: 2, y: 20, g: "b" },
]);

describe("bindPlotData / bindLayerTable", () => {
  it("binds inline values data at plot level", () => {
    const t = bindPlotData(
      { data: { values: [{ a: 1 }] }, layers: [] },
      { width: 100, height: 100 },
    );
    expect(t).not.toBeNull();
    expect(t!.rowCount).toBe(1);
    expect(t!.has("a")).toBe(true);
  });

  it("returns null when the plot omits data (layers may supply their own)", () => {
    expect(bindPlotData({ layers: [] }, { width: 100, height: 100 })).toBeNull();
  });

  it("throws no-data when a layer has neither layer nor plot data", () => {
    try {
      bindLayerTable(undefined, null, 0, { layers: [] }, { width: 100, height: 100 });
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("no-data");
    }
  });

  it("throws unknown-dataset for missing named data", () => {
    try {
      bindPlotData({ data: { name: "missing" }, layers: [] }, { width: 100, height: 100 });
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("unknown-dataset");
    }
  });

  it("resolves RunOptions.data by name", () => {
    const t = bindPlotData(
      { data: { name: "cars" }, layers: [] },
      {
        width: 100,
        height: 100,
        data: { cars: [{ displ: 1.8, hwy: 29 }] },
      },
    );
    expect(t).not.toBeNull();
    expect(t!.rowCount).toBe(1);
    expect(t!.has("displ")).toBe(true);
  });

  it("throws dataset-collision without allowOverride", () => {
    try {
      bindPlotData(
        {
          data: { name: "cars" },
          datasets: { cars: { values: [{ x: 1 }] } },
          layers: [],
        },
        {
          width: 100,
          height: 100,
          data: { cars: [{ x: 2 }] },
        },
      );
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("dataset-collision");
    }
  });
});

describe("bindLayer", () => {
  it("resolves point layer field mappings", () => {
    const warnings: { code: string; message: string }[] = [];
    const binding = bindLayer(
      { geom: "point", aes: { x: { field: "x" }, y: { field: "y" }, color: { field: "g" } } },
      0,
      table,
      warnings,
    );
    expect(binding.xField).toBe("x");
    expect(binding.yField).toBe("y");
    expect(binding.color.field).toBe("g");
    expect(binding.ruleForm).toBeNull();
  });

  it("throws missing-channel when point lacks y", () => {
    try {
      bindLayer({ geom: "point", aes: { x: { field: "x" } } }, 0, table, []);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("missing-channel");
      expect((e as PipelineError).path).toContain("y");
    }
  });

  it("throws unknown-field for missing columns", () => {
    try {
      bindLayer({ geom: "point", aes: { x: { field: "nope" }, y: { field: "y" } } }, 0, table, []);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("unknown-field");
    }
  });

  it("rejects data-mapped y on bar geom", () => {
    try {
      bindLayer({ geom: "bar", aes: { x: { field: "g" }, y: { field: "y" } } }, 0, table, []);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("computed-y-mapped");
    }
  });

  it("classifies rule annotation vs data-driven forms", () => {
    const ann = bindLayer({ geom: "rule", params: { yintercept: 5 } }, 0, table, []);
    expect(ann.ruleForm).toBe("annotation");

    const vert = bindLayer({ geom: "rule", aes: { x: { field: "x" } } }, 0, table, []);
    expect(vert.ruleForm).toBe("vertical");

    const horiz = bindLayer({ geom: "rule", aes: { y: { field: "y" } } }, 0, table, []);
    expect(horiz.ruleForm).toBe("horizontal");
  });

  it("rejects rule form that maps both axes", () => {
    try {
      bindLayer({ geom: "rule", aes: { x: { field: "x" }, y: { field: "y" } } }, 0, table, []);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("rule-both-axes");
    }
  });

  it("rejects rule that mixes intercepts with mapped channels", () => {
    try {
      bindLayer(
        { geom: "rule", params: { yintercept: 1 }, aes: { x: { field: "x" } } },
        0,
        table,
        [],
      );
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("rule-form-ambiguous");
    }
  });

  it("requires text label channel", () => {
    try {
      bindLayer({ geom: "text", aes: { x: { field: "x" }, y: { field: "y" } } }, 0, table, []);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("missing-channel");
      expect((e as PipelineError).path).toContain("label");
    }
  });

  it("warns color-on-fill-geom and clears color for bar-like geoms", () => {
    const warnings: { code: string; message: string }[] = [];
    const binding = bindLayer(
      {
        geom: "col",
        aes: { x: { field: "g" }, y: { field: "y" }, color: { field: "g" }, fill: { field: "g" } },
      },
      0,
      table,
      warnings,
    );
    expect(warnings.some((w) => w.code === "color-on-fill-geom")).toBe(true);
    expect(binding.color.field).toBeNull();
    expect(binding.fill.field).toBe("g");
  });

  it("binds errorbar ymin/ymax identity form", () => {
    const binding = bindLayer(
      {
        geom: "errorbar",
        aes: { x: { field: "g" }, ymin: { field: "x" }, ymax: { field: "y" } },
      },
      0,
      table,
      [],
    );
    expect(binding.yminField).toBe("x");
    expect(binding.ymaxField).toBe("y");
    expect(binding.xField).toBe("g");
  });

  it("rejects smooth on nominal channels", () => {
    try {
      bindLayer({ geom: "smooth", aes: { x: { field: "g" }, y: { field: "y" } } }, 0, table, []);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("channel-type-mismatch");
    }
  });

  it("rejects boxplot with continuous x", () => {
    try {
      bindLayer({ geom: "boxplot", aes: { x: { field: "x" }, y: { field: "y" } } }, 0, table, []);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("channel-type-mismatch");
      expect((e as PipelineError).path).toContain("x");
    }
  });

  it("rejects density on a nominal x", () => {
    try {
      bindLayer({ geom: "density", aes: { x: { field: "g" } } }, 0, table, []);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("channel-type-mismatch");
      expect((e as PipelineError).message).toMatch(/density stat needs a continuous x/i);
      expect((e as PipelineError).path).toContain("x");
    }
  });

  it("rejects boxplot with a nominal y", () => {
    try {
      bindLayer({ geom: "boxplot", aes: { x: { field: "g" }, y: { field: "g" } } }, 0, table, []);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("channel-type-mismatch");
      expect((e as PipelineError).message).toMatch(/boxplot stat needs a quantitative y/i);
      expect((e as PipelineError).path).toContain("y");
    }
  });

  it("rejects ellipse on nominal position channels", () => {
    try {
      bindLayer(
        { geom: "path", stat: "ellipse", aes: { x: { field: "g" }, y: { field: "y" } } },
        0,
        table,
        [],
      );
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("channel-type-mismatch");
      expect((e as PipelineError).message).toMatch(/ellipse stat needs quantitative/i);
    }
  });

  it("rejects raster on a nominal y", () => {
    try {
      bindLayer({ geom: "raster", aes: { x: { field: "x" }, y: { field: "g" } } }, 0, table, []);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("channel-type-mismatch");
      expect((e as PipelineError).message).toMatch(/raster geom needs continuous y/i);
      expect((e as PipelineError).path).toContain("y");
    }
  });

  it("rejects spoke on a nominal x", () => {
    try {
      bindLayer({ geom: "spoke", aes: { x: { field: "g" }, y: { field: "y" } } }, 0, table, []);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("channel-type-mismatch");
      expect((e as PipelineError).message).toMatch(/spoke geom needs continuous x/i);
      expect((e as PipelineError).path).toContain("x");
    }
  });

  it("requires ymin/ymax for identity errorbar", () => {
    try {
      bindLayer({ geom: "errorbar", aes: { x: { field: "g" } } }, 0, table, []);
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("missing-channel");
    }
  });
});

describe("bind via runPipeline (regression anchors)", () => {
  it("unknown-field surfaces as PipelineError from the public entry", () => {
    try {
      runPipeline(
        gg([{ x: 1 }], aes({ x: "missing", y: "x" }))
          .geomPoint()
          .spec(),
        size,
      );
      expect.unreachable("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PipelineError);
      expect((e as PipelineError).code).toBe("unknown-field");
    }
  });
});

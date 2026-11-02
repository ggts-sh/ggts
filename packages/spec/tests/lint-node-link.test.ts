import { describe, expect, it } from "bun:test";

import { lintSpec } from "../src/lint.ts";
import { validate } from "../src/validate.ts";

describe("node-link-layout", () => {
  it("flags a hub connected to point rows in layer-local data", () => {
    const nodes = [
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 1 },
    ];
    const spec = {
      layers: [
        {
          geom: "segment",
          data: { values: nodes.slice(1).map((n) => ({ x: 0, y: 0, xend: n.x, yend: n.y })) },
          aes: {
            x: { field: "x" },
            y: { field: "y" },
            xend: { field: "xend" },
            yend: { field: "yend" },
          },
        },
        { geom: "point", data: { values: nodes }, aes: { x: { field: "x" }, y: { field: "y" } } },
      ],
    };
    const result = validate(spec, { lint: true });
    expect(result.ok).toBe(true);
    expect(result.advisories?.map((a) => a.code)).toContain("node-link-layout");
    expect(lintSpec(spec)).toEqual(result.advisories);
    expect(result.advisories?.find((a) => a.code === "node-link-layout")?.path).toBe("/layers/0");
  });

  const hubSpec = () => {
    const nodes = [
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 1 },
    ];
    return {
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [
        {
          geom: "segment",
          data: {
            values: nodes.slice(1).map((n) => ({ x: 0, y: 0, xend: n.x, yend: n.y, panel: "a" })),
          },
          aes: { xend: { field: "xend" }, yend: { field: "yend" } },
        },
        { geom: "point", data: { values: nodes.map((n) => ({ ...n, panel: "a" })) } },
      ],
    };
  };

  it("does not join coordinates across different facet panels", () => {
    const spec = hubSpec();
    for (const row of spec.layers[1]!.data.values) row.panel = "b";
    expect(
      lintSpec({ ...spec, facet: { wrap: { field: "panel" } } }).map((a) => a.code),
    ).not.toContain("node-link-layout");
  });

  it("keeps facet degree counts separate and honors closed levels", () => {
    const spec = hubSpec();
    expect(lintSpec({ ...spec, facet: { wrap: { field: "panel" } } }).map((a) => a.code)).toContain(
      "node-link-layout",
    );
    expect(
      lintSpec({ ...spec, facet: { wrap: { field: "panel", levels: ["b"] } } }).map((a) => a.code),
    ).not.toContain("node-link-layout");
    spec.layers[0]!.data.values[2]!.panel = "b";
    expect(
      lintSpec({ ...spec, facet: { wrap: { field: "panel" } } }).map((a) => a.code),
    ).not.toContain("node-link-layout");
  });

  it("uses the inclusive 80% endpoint threshold", () => {
    const spec = hubSpec();
    const edges = spec.layers[0]!.data.values;
    edges.push(
      { x: 0, y: 0, xend: 8, yend: 9, panel: "a" },
      { x: 0, y: 0, xend: 9, yend: 8, panel: "a" },
    );
    expect(lintSpec(spec).map((a) => a.code)).toContain("node-link-layout");
    edges.push({ x: 0, y: 0, xend: 7, yend: 8, panel: "a" });
    expect(lintSpec(spec).map((a) => a.code)).not.toContain("node-link-layout");
  });

  it("excludes slopes without hubs, axis-aligned ranges, and unmatched annotations", () => {
    const slope = hubSpec();
    slope.layers[0]!.data.values.pop();
    expect(lintSpec(slope).map((a) => a.code)).not.toContain("node-link-layout");
    for (const axis of ["x", "y"] as const) {
      const range = hubSpec();
      for (const layer of range.layers) {
        for (const row of layer.data.values) {
          row[axis] = 0;
          if (axis === "x" && "xend" in row) row.xend = 0;
          if (axis === "y" && "yend" in row) row.yend = 0;
        }
      }
      expect(lintSpec(range).map((a) => a.code)).not.toContain("node-link-layout");
    }
    const annotation = hubSpec();
    for (const row of annotation.layers[1]!.data.values) row.x += 0.01;
    expect(lintSpec(annotation).map((a) => a.code)).not.toContain("node-link-layout");
  });

  it("skips noncontinuous scales, moved/statistical layers, missing evidence, and limits", () => {
    const spec = hubSpec();
    for (const type of ["band", "point", "ordinal"]) {
      expect(lintSpec({ ...spec, scales: { x: { type } } }).map((a) => a.code)).not.toContain(
        "node-link-layout",
      );
    }
    for (const override of [
      { position: "jitter" },
      { stat: "sum" },
      { aes: { x: null } },
      { data: { name: "runtime" } },
    ]) {
      expect(
        lintSpec({ ...spec, layers: [spec.layers[0], { ...spec.layers[1], ...override }] }).map(
          (a) => a.code,
        ),
      ).not.toContain("node-link-layout");
    }
    for (const options of [
      { limits: { maxRows: 6 } },
      { limits: { maxBytes: 1 } },
      {
        profile: {
          fields: [
            { name: "x", type: "quantitative" as const },
            { name: "y", type: "quantitative" as const },
          ],
        },
      },
    ]) {
      expect(lintSpec(spec, options).map((a) => a.code)).not.toContain("node-link-layout");
      expect(
        validate(spec, { ...options, lint: true }).advisories?.map((a) => a.code) ?? [],
      ).not.toContain("node-link-layout");
    }
  });

  it("resolves named columns and broadcasts layers missing grid facet fields", () => {
    const spec = {
      data: { values: [{ region: "a", group: "b" }] },
      datasets: {
        edges: {
          columns: {
            sx: [0, 0, 0],
            sy: [0, 0, 0],
            ex: [1, 2, 3],
            ey: [2, 3, 1],
            region: ["a", "a", "a"],
          },
        },
        nodes: { columns: { px: [0, 1, 2, 3], py: [0, 2, 3, 1], group: ["b", "b", "b", "b"] } },
      },
      layers: [
        {
          geom: "segment",
          data: { name: "edges" },
          aes: {
            x: { field: "sx" },
            y: { field: "sy" },
            xend: { field: "ex" },
            yend: { field: "ey" },
          },
        },
        { geom: "point", data: { name: "nodes" }, aes: { x: { field: "px" }, y: { field: "py" } } },
      ],
      facet: { rows: { field: "region" }, cols: { field: "group" } },
    };
    const result = validate(spec, { lint: true });
    expect(result.ok).toBe(true);
    expect(result.advisories?.map((a) => a.code)).toContain("node-link-layout");
    expect(lintSpec(spec)).toEqual(result.advisories);
    const absentPanel = { ...spec, data: { values: [{ region: "c", group: "d" }] } };
    expect(lintSpec(absentPanel).map((a) => a.code)).not.toContain("node-link-layout");
    expect(
      validate(absentPanel, { lint: true }).advisories?.map((a) => a.code) ?? [],
    ).not.toContain("node-link-layout");
  });

  it("requires continuous axes across all layers, unless explicitly pinned", () => {
    const spec = hubSpec();
    for (const extra of [
      { geom: "point", data: { values: [{ x: "category", y: 1 }] } },
      { geom: "col", data: { values: [{ x: 1, y: 1 }] } },
      {
        geom: "segment",
        data: { values: [{ x: 1, y: 1, end: "category" }] },
        aes: { xend: { field: "end" }, yend: { value: 2 } },
      },
    ]) {
      const mixed = { ...spec, layers: [...spec.layers, extra] };
      expect(lintSpec(mixed).map((a) => a.code)).not.toContain("node-link-layout");
      expect(
        lintSpec({ ...mixed, scales: { x: { type: "linear" } } }).map((a) => a.code),
      ).toContain("node-link-layout");
    }
  });

  it("ignores inherited endpoint mappings on point layers", () => {
    const spec = hubSpec();
    const result = validate(
      {
        ...spec,
        aes: { ...spec.aes, xend: { field: "unused" } },
        layers: [
          spec.layers[0],
          {
            ...spec.layers[1],
            data: {
              values: spec.layers[1]!.data.values.map((row) => ({ ...row, unused: "category" })),
            },
          },
        ],
      },
      { lint: true },
    );
    expect(result.ok).toBe(true);
    expect(result.advisories?.map((a) => a.code)).toContain("node-link-layout");
  });

  it("keeps signed zero facet identities distinct", () => {
    const spec = hubSpec();
    const layers = spec.layers.map((layer, index) => ({
      ...layer,
      data: { values: layer.data.values.map((row) => ({ ...row, panel: index === 0 ? -0 : 0 })) },
    }));
    expect(
      lintSpec({ ...spec, layers, facet: { wrap: { field: "panel" } } }).map((a) => a.code),
    ).not.toContain("node-link-layout");
  });
});

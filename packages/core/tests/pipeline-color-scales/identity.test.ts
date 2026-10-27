import { describe, expect, it } from "bun:test";

import { defaultTooltipRows, resolveInspection } from "../../src/interaction-entry.js";
import { runPipeline } from "../../src/pipeline.js";

import { pointColors, pointSpec, size } from "./fixtures.ts";

describe("identity color scales", () => {
  it("forwards valid identity colors and applies explicit invalid/NA policies", () => {
    const model = runPipeline(
      pointSpec(["#f00", "#00ff00", "red", null], {
        type: "identity",
        naValue: "#aaa",
        unknownValue: "#333",
      }),
      size,
    );
    expect(model.scales.color?.kind).toBe("identity");
    expect(pointColors(model)).toEqual(["#ff0000", "#00ff00", "#333333", "#aaaaaa"]);
    expect(model.scene.legends).toHaveLength(0);
    expect(model.guidePlans.some((candidate) => candidate.aesthetic === "color")).toBe(false);
  });

  it("omits constant identity paint from default tooltip rows while retaining the public field (#1844)", () => {
    const model = runPipeline(
      {
        data: {
          values: [
            { label: "Alpha", count: 30, color: "#0072B2" },
            { label: "Beta", count: 18, color: "#0072B2" },
          ],
        },
        aes: { x: { field: "label" }, y: { field: "count" } },
        layers: [{ geom: "col", aes: { fill: { field: "color" } } }],
        scales: {
          x: { type: "band" },
          y: { type: "linear" },
          fill: { type: "identity" },
        },
      },
      size,
    );
    const seed = model.candidates.candidate(0);
    if (seed === null) throw new Error("expected candidate(0)");

    const exact = resolveInspection({
      model,
      seed,
      mode: "exact",
      state: "transient",
      source: "pointer",
      keyOf: () => null,
    });
    expect(exact.focus.fields.map((f) => `${f.channel}:${f.field}:${String(f.value)}`)).toEqual([
      "x:label:Alpha",
      "y:count:30",
      "fill:color:#0072B2",
    ]);
    expect(
      defaultTooltipRows(exact.focus.fields, "exact").map((r) => `${r.label}: ${String(r.value)}`),
    ).toEqual(["label: Alpha", "count: 30"]);

    const xGroup = resolveInspection({
      model,
      seed,
      mode: "x",
      state: "transient",
      source: "pointer",
      keyOf: () => null,
    });
    expect(
      defaultTooltipRows(xGroup.focus.fields, "x").map((r) => `${r.label}: ${String(r.value)}`),
    ).toEqual(["count: 30"]);
  });
});

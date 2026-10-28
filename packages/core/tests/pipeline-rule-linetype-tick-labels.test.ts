/**
 * Grouped dot-stack parity (#1825): a constant `params.linetype` on rule
 * layers, and author-given tick labels at explicit position breaks.
 */
import { aes, gg, type PortableSpec } from "@ggts-sh/spec";
import { describe, expect, it } from "bun:test";

import { runPipeline } from "../src/pipeline.ts";
import { renderToSVGString } from "../src/render-svg-full.ts";

const size = { width: 400, height: 300 };
const rows = [
  { x: 1, y: 2, g: "a", day: "2026-01-01" },
  { x: 14, y: 4, g: "b", day: "2026-12-01" },
];

function ruleLinetype(spec: PortableSpec): string | undefined {
  const model = runPipeline(spec, size);
  const rule = model.scene.batches.find((b) => b.kind === "segments" && b.layerIndex === 1);
  if (rule?.kind !== "segments") throw new Error("no rule segments batch");
  return rule.linetype;
}

describe("rule params.linetype (#1825)", () => {
  it("draws a dashed hline from the constant param", () => {
    const spec = gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .geomHline({ yintercept: 3, linetype: "dashed" })
      .spec();
    expect(ruleLinetype(spec)).toBe("dashed");
    expect(renderToSVGString(spec, size)).toContain("stroke-dasharray");
  });

  it("applies to vline and the data-driven rule form", () => {
    const vline = gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .geomVline({ xintercept: 2, linetype: "dotted" })
      .spec();
    expect(ruleLinetype(vline)).toBe("dotted");
    const mapped = gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .geomRule({ aes: { x: null, y: "y" }, linetype: "longdash" })
      .spec();
    expect(ruleLinetype(mapped)).toBe("longdash");
  });

  it("lets a constant aes.linetype win over the param", () => {
    const spec = gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .geomHline({ yintercept: 3, linetype: "dashed", aes: { linetype: { value: "dotted" } } })
      .spec();
    expect(ruleLinetype(spec)).toBe("dotted");
  });
});

function xTickLabels(spec: PortableSpec): string[] {
  const model = runPipeline(spec, size);
  return (model.scene.panels[0]?.axisX ?? []).map((tick) => tick.label);
}

describe("position labels array (#1825)", () => {
  it("names each numeric break in order", () => {
    const spec = gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .scaleXContinuous({ breaks: [4, 14], labels: ["Group A", "Group B"] })
      .spec();
    expect(xTickLabels(spec)).toEqual(["Group A", "Group B"]);
  });

  it("formats non-break values with the default format in tooltips", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scaleXContinuous({ breaks: [4, 14], labels: ["Group A", "Group B"] })
        .spec(),
      size,
    );
    expect(model.axisFormatters.x(14)).toBe("Group B");
    expect(model.axisFormatters.x(5)).toBe("5");
  });

  it("names band breaks, and follows the break order rather than the domain order", () => {
    const spec = gg(rows, aes({ x: "g", y: "y" }))
      .geomPoint()
      .scaleXDiscrete({ breaks: ["b", "a"], labels: ["Bee", "Ay"] })
      .spec();
    expect(xTickLabels(spec).toSorted()).toEqual(["Ay", "Bee"]);
    const ticks = runPipeline(spec, size).scene.panels[0]!.axisX!;
    expect(ticks.find((tick) => tick.value === "a")?.label).toBe("Ay");
  });

  it("names temporal breaks", () => {
    const spec = gg(rows, aes({ x: "day", y: "y" }))
      .geomPoint()
      .scaleXDate({ breaks: ["2026-03-01", "2026-09-01"], labels: ["Spring", "Autumn"] })
      .spec();
    expect(xTickLabels(spec)).toEqual(["Spring", "Autumn"]);
  });

  it("drops the label of a break outside the domain together with its tick", () => {
    const spec = gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .scaleXContinuous({ breaks: [4, 400], labels: ["Group A", "Far"] })
      .spec();
    expect(xTickLabels(spec)).toEqual(["Group A"]);
  });
});

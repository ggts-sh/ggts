import { describe, expect, it } from "vitest";
import { KNOWN_GEOMS } from "@ggts-sh/spec";

import * as react from "../src/index.js";

function geomComponentName(geom: string): string {
  return `Geom${geom
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}`;
}

describe("@ggts-sh/react public surface", () => {
  it("exports GGPlot and every KNOWN_GEOMS child", () => {
    expect(react.GGPlot).toBeTruthy();
    for (const geom of KNOWN_GEOMS) {
      const name = geomComponentName(geom);
      expect(react, name).toHaveProperty(name);
      expect((react as Record<string, unknown>)[name]).toBeTypeOf("function");
    }
  });

  it("exports grammar children and interaction", () => {
    expect(react.ThemeMinimal).toBeTypeOf("function");
    expect(react.ScaleXLog10).toBeTypeOf("function");
    expect(react.ScaleColorDiscrete).toBeTypeOf("function");
    expect(react.Labs).toBeTypeOf("function");
    expect(react.FacetWrap).toBeTypeOf("function");
    expect(react.CoordFlip).toBeTypeOf("function");
    expect(react.GuideLegend).toBeTypeOf("function");
    expect(react.Inspect).toBeTypeOf("function");
    expect(react.createPlotInteraction).toBeTypeOf("function");
    expect(react.registerBasic).toBeTypeOf("function");
    expect(react.registerAll).toBeTypeOf("function");
    expect(react.installTemporal).toBeTypeOf("function");
  });
});

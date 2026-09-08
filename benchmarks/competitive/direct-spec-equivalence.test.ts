import { beforeAll, describe, expect, it } from "bun:test";

import {
  registerBasicAreas,
  registerBasicBars,
  registerBasicLines,
  registerBasicPoints,
  registerBandGuide,
  registerOrdinalColor,
} from "@ggsvelte/core/headless/register";
import {
  bundleAreaCanvas,
  bundleLineCanvas,
  bundleScatterCanvas,
} from "./adapters/ggsvelte-canvas";
import {
  bundleAreaSvg,
  bundleBarsSvg,
  bundleLineSvg,
  bundleScatterSvg,
} from "./adapters/ggsvelte-svg";
import { aes, gg } from "@ggsvelte/spec/portable";
import {
  COLORS,
  makeMultiSeries,
  makeScatter,
  makeStackedBars,
  PLOT_HEIGHT,
  PLOT_WIDTH,
} from "./scenarios";
import { renderToSVGString, runPipeline } from "@ggsvelte/core/headless";

beforeAll(() => {
  registerBasicPoints();
  registerBasicLines();
  registerBasicAreas();
  registerBasicBars();
  registerOrdinalColor();
  registerBandGuide();
});

const options = { width: PLOT_WIDTH, height: PLOT_HEIGHT };

describe("competitive direct specs", () => {
  it("render the same charts as fluent builder sugar", () => {
    const scatter = makeScatter(1_000);
    const series = makeMultiSeries(3, 1_000);
    const bars = makeStackedBars(50, 4);

    expect(bundleScatterSvg(scatter)).toBe(
      renderToSVGString(
        gg(scatter, aes({ x: "x", y: "y", color: "cls" }))
          .geomPoint({ size: 1.5, alpha: 0.7, render: "svg" })
          .scales({
            color: {
              type: "ordinal",
              domain: ["series-0", "series-1", "series-2", "series-3", "series-4"],
              range: COLORS.slice(0, 5),
            },
          })
          .toPortable(),
        options,
      ),
    );
    expect(bundleLineSvg(series)).toBe(
      renderToSVGString(
        gg(series, aes({ x: "x", y: "y", color: "series", group: "series" }))
          .geomLine()
          .toPortable(),
        options,
      ),
    );
    expect(bundleAreaSvg(series)).toBe(
      renderToSVGString(
        gg(series, aes({ x: "x", y: "y", fill: "series", group: "series" }))
          .geomArea({ position: "identity" })
          .toPortable(),
        options,
      ),
    );
    expect(bundleBarsSvg(bars)).toBe(
      renderToSVGString(
        gg(bars, aes({ x: "category", y: "value", fill: "stack" }))
          .geomCol({ render: "svg" })
          .scales({
            fill: {
              type: "ordinal",
              domain: ["stack-0", "stack-1", "stack-2", "stack-3"],
              range: COLORS.slice(0, 4),
            },
          })
          .toPortable(),
        options,
      ),
    );
  });

  it("build the same canvas models as named-data builder sugar", () => {
    const scatter = makeScatter(1_000);
    const series = makeMultiSeries(3, 1_000);
    const dataName = "main";

    const scatterDirect = bundleScatterCanvas(scatter) as ReturnType<typeof runPipeline>;
    const scatterBuilder = runPipeline(
      gg({ name: dataName }, aes({ x: "x", y: "y", color: "cls" }))
        .geomPoint({ size: 1.5, alpha: 0.7, render: "canvas" })
        .theme("void")
        .guides({ color: { type: "none" } })
        .toPortable(),
      { ...options, data: { [dataName]: scatter } },
    );
    expect({ scene: scatterDirect.scene, layerBackends: scatterDirect.layerBackends }).toEqual({
      scene: scatterBuilder.scene,
      layerBackends: scatterBuilder.layerBackends,
    });

    const lineDirect = bundleLineCanvas(series) as ReturnType<typeof runPipeline>;
    const lineBuilder = runPipeline(
      gg({ name: dataName }, aes({ x: "x", y: "y", color: "series", group: "series" }))
        .geomLine({ render: "canvas" })
        .theme("void")
        .guides({ color: { type: "none" } })
        .toPortable(),
      { ...options, data: { [dataName]: series } },
    );
    expect({ scene: lineDirect.scene, layerBackends: lineDirect.layerBackends }).toEqual({
      scene: lineBuilder.scene,
      layerBackends: lineBuilder.layerBackends,
    });

    const areaDirect = bundleAreaCanvas(series) as ReturnType<typeof runPipeline>;
    const areaBuilder = runPipeline(
      gg({ name: dataName }, aes({ x: "x", y: "y", fill: "series", group: "series" }))
        .geomArea({ position: "identity", render: "canvas" })
        .theme("void")
        .guides({ fill: { type: "none" } })
        .toPortable(),
      { ...options, data: { [dataName]: series } },
    );
    expect({ scene: areaDirect.scene, layerBackends: areaDirect.layerBackends }).toEqual({
      scene: areaBuilder.scene,
      layerBackends: areaBuilder.layerBackends,
    });
  });
});

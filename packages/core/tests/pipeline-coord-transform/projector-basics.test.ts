import { describe, expect, it } from "bun:test";

import { aes, coord_transform, gg, guideAxis } from "@ggts-sh/spec";

import { FONT_METRICS } from "../../src/layout/font-metrics.ts";
import { MetricsTableMeasurer } from "../../src/layout/measure.ts";
import { runPipeline } from "../../src/pipeline.ts";
import { size } from "./fixtures.ts";

describe("pipeline post-stat coord_transform — projector basics", () => {
  it("projects points and axis ticks after identity scale training", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1 },
          { x: 10, y: 2 },
          { x: 100, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales({
          x: {
            type: "linear",
            domain: [1, 100],
            expand: { mult: 0, add: 0 },
            breaks: [1, 10, 100],
          },
        })
        .coord(coord_transform({ x: { transform: "log10", expand: false } }))
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("linear");
    if (model.scales.x.type !== "linear") throw new Error("expected continuous x");
    expect(model.scales.x.transform).toBe("identity");
    const points = model.scene.batches.find((batch) => batch.kind === "points");
    if (points?.kind !== "points") throw new Error("expected points");
    const [x1, x10, x100] = [points.positions[0]!, points.positions[2]!, points.positions[4]!];
    expect(x10 - x1).toBeCloseTo(x100 - x10, 4);
    const tick10 = model.scene.axes.x.ticks.find((tick) => tick.value === 10);
    expect(tick10?.pos).toBeCloseTo(model.scene.panels[0]!.width / 2, 4);
    expect(
      model.scene.panels[0]!.grid.x.some(
        (position) => Math.abs(position - model.scene.panels[0]!.width / 2) < 0.0001,
      ),
    ).toBe(true);
  });
  it("keeps projected grid breaks while suppressing colliding axis labels", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1 },
          { x: 1000, y: 2 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales({
          x: {
            type: "linear",
            domain: [1, 1000],
            expand: { mult: 0, add: 0 },
            breaks: [200, 400, 600, 800, 1000],
          },
        })
        .coordTransform({ x: { transform: "log10", expand: false } })
        .spec(),
      { width: 320, height: 360 },
    );
    const axis = model.scene.panels[0]!.axisX!;
    expect(model.scene.panels[0]!.grid.x).toHaveLength(5);
    expect(axis.filter((tick) => tick.label !== "")).toHaveLength(3);
    expect(axis.find((tick) => tick.value === 1000)?.label).toBe("1000");
  });
  it("measures projected-label overlap with the resolved guide font size", () => {
    const renderAt = (labelSize: number) =>
      runPipeline(
        gg(
          [
            { x: 1, y: 1 },
            { x: 1000, y: 2 },
          ],
          aes({ x: "x", y: "y" }),
        )
          .geomPoint()
          .scales({
            x: {
              type: "linear",
              domain: [1, 1000],
              expand: { mult: 0, add: 0 },
              breaks: [200, 400, 600, 800, 1000],
            },
          })
          .guides({ x: guideAxis({ theme: { labelSize } }) })
          .coordTransform({ x: { transform: "log10", expand: false } })
          .spec(),
        { width: 320, height: 360 },
      );

    const large = renderAt(24).scene.panels[0]!.axisX!;
    expect(large.every((tick) => tick.labelSize === 24)).toBe(true);
    const visible = large.filter((tick) => tick.label !== "").toSorted((a, b) => a.pos - b.pos);
    const measurer = new MetricsTableMeasurer(FONT_METRICS);
    for (let index = 1; index < visible.length; index++) {
      const previous = visible[index - 1]!;
      const current = visible[index]!;
      const previousRight = previous.pos + measurer.measureWidth(previous.label, 24) / 2;
      const currentLeft = current.pos - measurer.measureWidth(current.label, 24) / 2;
      expect(previousRight + 4).toBeLessThanOrEqual(currentLeft);
    }
  });
  it("omits ticks outside exact coordinate limits without changing scale breaks", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 1 },
          { x: 100, y: 2 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales({
          x: {
            type: "linear",
            domain: [0, 100],
            expand: { mult: 0, add: 0 },
            breaks: [0, 20, 50, 80, 100],
          },
        })
        .coordTransform({ x: { transform: "identity", limits: [20, 80], expand: false } })
        .spec(),
      size,
    );
    expect(model.scene.panels[0]!.axisX?.map((tick) => tick.value)).toEqual([20, 50, 80]);
    expect(model.scene.panels[0]!.grid.x).toHaveLength(3);
  });
  it("builds independent coordinate projectors for free-scale facets", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1, group: "small" },
          { x: 10, y: 2, group: "small" },
          { x: 100, y: 1, group: "large" },
          { x: 1000, y: 2, group: "large" },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .facet({ wrap: "group", scales: "free_x" })
        .coordTransform({ x: "log10" })
        .spec(),
      size,
    );
    expect(model.coordProjectors).toHaveLength(2);
    expect(model.coordProjectors[0]!.x.coordinateDomain).not.toEqual(
      model.coordProjectors[1]!.x.coordinateDomain,
    );
    const pointBatches = model.scene.batches.filter((batch) => batch.kind === "points");
    expect(pointBatches).toHaveLength(2);
    expect(Array.from(pointBatches[0]!.positions)).toEqual(Array.from(pointBatches[1]!.positions));
  });
});

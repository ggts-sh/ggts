/**
 * Characterization tests for panel layout placement contracts.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { STRIP_BAND } from "../src/scene.ts";

const size = { width: 640, height: 400 };

describe("panel layout via runPipeline", () => {
  it("single panel fills the plot interior with both axes", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 10 },
          { x: 2, y: 20 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      size,
    );
    expect(model.scene.panels).toHaveLength(1);
    const p = model.scene.panels[0]!;
    expect(p.width).toBeGreaterThan(200);
    expect(p.height).toBeGreaterThan(150);
    expect(p.axisX).not.toBeNull();
    expect(p.axisY).not.toBeNull();
    expect(
      model.guidePlans
        .filter((plan) => plan.type === "axis")
        .map((plan) => [plan.aesthetic, plan.scaleType] as const),
    ).toEqual([
      ["x", "linear"],
      ["y", "linear"],
    ]);
  });

  it("facet wrap places panels on a grid with strips", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1, g: "a" },
          { x: 2, y: 2, g: "b" },
          { x: 3, y: 3, g: "c" },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .facet({ wrap: "g" })
        .spec(),
      size,
    );
    expect(model.scene.panels).toHaveLength(3);
    expect(model.scene.panels.map((p) => p.strip).toSorted()).toEqual(["a", "b", "c"]);
    // strips reserve a band above panels
    expect(model.scene.panels[0]!.y).toBeGreaterThanOrEqual(STRIP_BAND);
  });

  it("facet free_x shows x axes on more than the bottom edge row", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1, g: "a" },
          { x: 10, y: 2, g: "b" },
          { x: 100, y: 3, g: "c" },
          { x: 2, y: 4, g: "d" },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .facet({ wrap: "g", scales: "free_x", ncol: 2 })
        .spec(),
      size,
    );
    expect(model.scene.panels).toHaveLength(4);
    const withX = model.scene.panels.filter((p) => p.axisX !== null);
    expect(withX.length).toBeGreaterThanOrEqual(2);
  });

  it("facet free_y shows y axes on every column (not only the left edge)", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 1, g: "a" },
          { x: 2, y: 10, g: "b" },
          { x: 3, y: 100, g: "c" },
          { x: 4, y: 2, g: "d" },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .facet({ wrap: "g", scales: "free_y", ncol: 2 })
        .spec(),
      size,
    );
    expect(model.scene.panels).toHaveLength(4);
    // free_y: each column gets its own y axis chrome
    const withY = model.scene.panels.filter((p) => p.axisY !== null);
    expect(withY.length).toBeGreaterThanOrEqual(2);
  });

  it("legend reserves right margin when fill is mapped", () => {
    const model = runPipeline(
      gg(
        [
          { g: "a", y: 1 },
          { g: "b", y: 2 },
        ],
        aes({ x: "g", y: "y", fill: "g" }),
      )
        .geomCol()
        .spec(),
      size,
    );
    expect(model.scene.legends.length).toBeGreaterThan(0);
    const panel = model.scene.panels[0]!;
    // legend occupies right of the plot; panel should not span full width
    expect(panel.x + panel.width).toBeLessThan(size.width - 8);
  });

  it("labs and flip swap axis title orientation on the scene", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 10 },
          { x: 2, y: 20 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .labs({ x: "Miles", y: "Gallons", title: "Mileage" })
        .coord({ type: "flip" })
        .spec(),
      size,
    );
    expect(model.scene.title).toBe("Mileage");
    // under flip, semantic x title renders on the vertical axis
    expect(model.scene.axes.y.title).toBe("Miles");
    expect(model.scene.axes.x.title).toBe("Gallons");
  });

  it("humanizes default axis and legend titles from camelCase fields (#961)", () => {
    const model = runPipeline(
      gg(
        [
          { bloomYear: 1850, bloomRefDate: 100, regionName: "A" },
          { bloomYear: 1900, bloomRefDate: 110, regionName: "B" },
        ],
        aes({ x: "bloomYear", y: "bloomRefDate", color: "regionName" }),
      )
        .geomPoint()
        .spec(),
      size,
    );
    expect(model.scene.axes.x.title).toBe("Bloom year");
    expect(model.scene.axes.y.title).toBe("Bloom ref date");
    expect(model.scene.legends[0]?.title).toBe("Region name");
  });

  it("keeps explicit labs including empty string to hide axis titles (#961)", () => {
    const model = runPipeline(
      gg(
        [
          { bloomYear: 1850, bloomRefDate: 100 },
          { bloomYear: 1900, bloomRefDate: 110 },
        ],
        aes({ x: "bloomYear", y: "bloomRefDate" }),
      )
        .geomPoint()
        .labs({ x: "", y: "Peak bloom" })
        .spec(),
      size,
    );
    expect(model.scene.axes.x.title).toBe("");
    expect(model.scene.axes.y.title).toBe("Peak bloom");
  });
});

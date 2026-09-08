/**
 * Connected marks with all-singleton groups — parity warning (#1271).
 *
 * A discrete x joins default grouping (decision 0005, ggplot2 parity), so
 * band-x area/line with a discrete fill/color derives one group per
 * (category, series) cell and each ribbon/stroke degenerates to a single
 * observation — silently. ggplot2's geom_path warns here; ggts now warns
 * for line AND area (`group-single-observation`), naming the aes.group
 * remedy. Mixed group sizes, single groups, and explicit aes.group stay
 * silent.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { runPipeline } from "../../src/pipeline.ts";

const size = { width: 640, height: 400 };

function singletonWarnings(model: ReturnType<typeof runPipeline>) {
  return model.warnings.filter((w) => w.code === "group-single-observation");
}

describe("group-single-observation warning (#1271)", () => {
  const bandData = {
    x: ["m1", "m3", "m0", "m1", "m2", "m3", "m4"],
    y: [2, 2, 3, 3, 0.5, 3, 3],
    g: ["b", "b", "a", "a", "a", "a", "a"],
  };

  it("warns for band-x stacked area with a discrete fill", () => {
    const model = runPipeline(
      gg(bandData, aes({ x: "x", y: "y", fill: "g" }))
        .geomArea()
        .spec(),
      size,
    );
    expect(singletonWarnings(model).length).toBe(1);
  });

  it("warns for a line whose derived groups are all singletons", () => {
    const model = runPipeline(
      gg(
        {
          x: ["a", "b", "c"],
          y: [1, 2, 3],
          c: ["r", "s", "t"],
        },
        aes({ x: "x", y: "y", color: "c" }),
      )
        .geomLine()
        .spec(),
      size,
    );
    expect(singletonWarnings(model).length).toBe(1);
  });

  it("stays silent when aes.group joins the categories into series", () => {
    const model = runPipeline(
      gg(bandData, aes({ x: "x", y: "y", fill: "g", group: "g" }))
        .geomArea()
        .spec(),
      size,
    );
    expect(singletonWarnings(model).length).toBe(0);
  });

  it("stays silent for continuous-x multi-row groups", () => {
    const model = runPipeline(
      gg(
        {
          x: [0, 1, 2, 0, 1, 2],
          y: [1, 2, 1, 3, 3, 3],
          g: ["b", "b", "b", "a", "a", "a"],
        },
        aes({ x: "x", y: "y", fill: "g" }),
      )
        .geomArea()
        .spec(),
      size,
    );
    expect(singletonWarnings(model).length).toBe(0);
  });

  it("stays silent when group sizes are mixed", () => {
    // ggplot2 warns only when EVERY group is a single observation.
    const model = runPipeline(
      gg(
        {
          x: [0, 1, 2, 5],
          y: [1, 2, 1, 4],
          g: ["a", "a", "a", "b"],
        },
        aes({ x: "x", y: "y", color: "g" }),
      )
        .geomLine()
        .spec(),
      size,
    );
    expect(singletonWarnings(model).length).toBe(0);
  });

  it("stays silent for a single group with many rows", () => {
    const model = runPipeline(
      gg({ x: [0, 1, 2], y: [1, 2, 1] }, aes({ x: "x", y: "y" }))
        .geomLine()
        .spec(),
      size,
    );
    expect(singletonWarnings(model).length).toBe(0);
  });

  it("warns once on the final model under facets", () => {
    const model = runPipeline(
      gg(
        {
          x: ["m0", "m1", "m0", "m1"],
          y: [1, 2, 3, 4],
          g: ["a", "b", "a", "b"],
          p: ["p1", "p1", "p2", "p2"],
        },
        aes({ x: "x", y: "y", fill: "g" }),
      )
        .geomArea()
        .facet({ wrap: "p" })
        .spec(),
      size,
    );
    expect(singletonWarnings(model).length).toBe(1);
  });
});

import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { planStrata } from "../src/strata.ts";

const size = { width: 640, height: 400 };
const rows = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i, label: `p${i}` }));

describe("planStrata", () => {
  it("groups contiguous same-backend batches; glyphs stay SVG", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint({ render: "canvas" })
        .geomLine({ render: "canvas" })
        .geomText({ aes: { label: "label" } })
        .spec(),
      size,
    );
    const strata = planStrata(model.scene, model.layerBackends);
    expect(strata.map((stratum) => stratum.backend)).toEqual(["canvas", "svg"]);
    expect(strata[0]!.batches).toHaveLength(2);
    expect(strata[1]!.batches[0]!.kind).toBe("glyphs");
  });

  it("preserves an svg/canvas/svg sandwich from interleaved hints", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomLine({ render: "svg" })
        .geomPoint({ render: "canvas" })
        .geomLine({ render: "svg", linewidth: 0.5 })
        .spec(),
      size,
    );
    const strata = planStrata(model.scene, model.layerBackends);
    expect(strata.map((stratum) => stratum.backend)).toEqual(["svg", "canvas", "svg"]);
  });

  it("keeps a text layer forced to canvas in an SVG stratum", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomText({ aes: { label: "label" }, render: "canvas" })
        .spec(),
      size,
    );
    const strata = planStrata(model.scene, model.layerBackends);
    expect(strata.map((stratum) => stratum.backend)).toEqual(["svg"]);
  });
});

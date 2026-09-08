/**
 * Characterization tests for preparePanels (bind + facet + frame phase).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { preparePanels } from "../src/pipeline/prepare-panels.ts";
import { PipelineError, runPipeline } from "../src/pipeline.ts";
import type { Advisory, PipelineWarning } from "../src/pipeline/types.ts";

const size = { width: 640, height: 400 };

describe("preparePanels", () => {
  it("binds rows and builds one frame for a simple point layer", () => {
    const warnings: PipelineWarning[] = [];
    const advisories: Advisory[] = [];
    const prepared = preparePanels(
      gg(
        [
          { x: 1, y: 2 },
          { x: 2, y: 3 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .spec(),
      size,
      warnings,
      advisories,
    );
    expect(prepared.emptyData).toBe(false);
    expect(prepared.bindings).toHaveLength(1);
    expect(prepared.panelFrames).toHaveLength(1);
    expect(prepared.panelFrames[0]![0]!.n).toBe(2);
    expect(prepared.faceted).toBe(false);
  });

  it("emits empty-data warning and no bindings when data is empty", () => {
    const warnings: PipelineWarning[] = [];
    const prepared = preparePanels(
      {
        data: { values: [] },
        layers: [{ geom: "point", aes: { x: { field: "x" }, y: { field: "y" } } }],
      },
      size,
      warnings,
      [],
    );
    expect(prepared.emptyData).toBe(true);
    expect(prepared.bindings).toHaveLength(0);
    expect(warnings.some((w) => w.code === "empty-data")).toBe(true);
  });

  it("partitions facet wrap panels before framing", () => {
    const prepared = preparePanels(
      gg(
        [
          { x: 1, y: 1, g: "b" },
          { x: 2, y: 2, g: "a" },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .facet({ wrap: "g" })
        .spec(),
      size,
      [],
      [],
    );
    expect(prepared.faceted).toBe(true);
    expect(prepared.facetPanels).toHaveLength(2);
    expect(prepared.facetPanels.map((p) => p.label)).toEqual(["a", "b"]);
  });
});

describe("preparePanels via runPipeline", () => {
  it("unknown-field still surfaces as PipelineError", () => {
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

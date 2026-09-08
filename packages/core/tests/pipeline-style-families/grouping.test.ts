import { describe, expect, it } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";

import { SpecValidationError } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.js";

import { viewport } from "./fixtures.ts";

describe("style grouping contracts", () => {
  it("keeps continuous mapped styles out of grouping and discrete stroke styles in grouping", () => {
    const rows = [
      { x: 1, y: 1, alpha: 0.2, kind: "a" },
      { x: 2, y: 2, alpha: 0.4, kind: "a" },
      { x: 3, y: 3, alpha: 0.6, kind: "b" },
      { x: 4, y: 4, alpha: 0.8, kind: "b" },
    ];
    const continuous = runPipeline(
      fromAny({
        data: { values: rows },
        aes: { x: { field: "x" }, y: { field: "y" }, alpha: { field: "alpha" } },
        layers: [{ geom: "smooth", params: { method: "lm", se: false } }],
        scales: { alpha: { type: "sequential" } },
      }),
      viewport,
    );
    const onePath = continuous.scene.batches.find((batch) => batch.kind === "paths");
    if (onePath?.kind !== "paths") throw new Error("expected smooth path");
    expect(onePath.pathOffsets).toHaveLength(2);

    const discrete = runPipeline(
      fromAny({
        data: { values: rows },
        aes: { x: { field: "x" }, y: { field: "y" }, linetype: { field: "kind" } },
        layers: [{ geom: "smooth", params: { method: "lm", se: false } }],
        scales: { linetype: { type: "ordinal" } },
      }),
      viewport,
    );
    const twoPaths = discrete.scene.batches.find((batch) => batch.kind === "paths");
    if (twoPaths?.kind !== "paths") throw new Error("expected grouped smooth paths");
    expect(twoPaths.pathOffsets).toHaveLength(3);
    expect([...twoPaths.linetypeIndexes!]).toEqual([0, 1]);

    const binned = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, value: 1 },
            { x: 2, y: 2, value: 2 },
            { x: 3, y: 3, value: 8 },
            { x: 4, y: 4, value: 9 },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, linetype: { field: "value" } },
        layers: [{ geom: "smooth", params: { method: "lm", se: false } }],
        scales: { linetype: { type: "binned", breaks: [0, 5, 10] } },
      }),
      viewport,
    );
    const binnedPaths = binned.scene.batches.find((batch) => batch.kind === "paths");
    if (binnedPaths?.kind !== "paths") throw new Error("expected binned smooth paths");
    expect(binnedPaths.pathOffsets).toHaveLength(3);
    expect([...binnedPaths.linetypeIndexes!]).toEqual([0, 1]);

    const temporalBinned = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, when: "01/02/2024" },
            { x: 2, y: 2, when: "02/02/2024" },
            { x: 3, y: 3, when: "08/02/2024" },
            { x: 4, y: 4, when: "09/02/2024" },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, linewidth: { field: "when" } },
        layers: [{ geom: "smooth", params: { method: "lm", se: false } }],
        scales: {
          linewidth: {
            type: "binned",
            temporalKind: "date",
            parse: "dmy",
            breaks: ["01/02/2024", "05/02/2024", "10/02/2024"],
          },
        },
      }),
      viewport,
    );
    const temporalPaths = temporalBinned.scene.batches.find((batch) => batch.kind === "paths");
    if (temporalPaths?.kind !== "paths") throw new Error("expected temporal binned paths");
    expect(temporalPaths.pathOffsets).toHaveLength(3);

    // Unparseable temporal breaks are rejected at validation (scale-binned-breaks)
    // before the pipeline trainer can throw style-binned-breaks.
    let unparseableBreaksError: unknown;
    try {
      runPipeline(
        fromAny({
          data: {
            values: [
              { x: 1, y: 1, when: "01/02/2024" },
              { x: 2, y: 2, when: "08/02/2024" },
            ],
          },
          aes: { x: { field: "x" }, y: { field: "y" }, linewidth: { field: "when" } },
          layers: [{ geom: "line" }],
          scales: {
            linewidth: {
              type: "binned",
              temporalKind: "date",
              parse: "dmy",
              breaks: ["01/02/2024", "not-a-date", "10/02/2024"],
            },
          },
        }),
        viewport,
      );
    } catch (error) {
      unparseableBreaksError = error;
    }
    expect(unparseableBreaksError).toBeInstanceOf(SpecValidationError);
    expect(
      (unparseableBreaksError as SpecValidationError).errors.map((item) => item.code),
    ).toContain("scale-binned-breaks");
  });

  it("normalizes a reversed binned style domain before grouping", () => {
    // The style trainer normalizes an authored domain with Math.min/max; the
    // grouping path must too, or a reversed domain like [10, 0] yields descending
    // breaks that treat every in-domain value as out-of-bounds — collapsing the
    // grouped lines instead of binning them like the rendered scale.
    const rows = [
      { x: 1, y: 1, w: 1 },
      { x: 2, y: 2, w: 1 },
      { x: 3, y: 3, w: 9 },
      { x: 4, y: 4, w: 9 },
    ];
    const pathCountForDomain = (domain: number[]): number => {
      const model = runPipeline(
        fromAny({
          data: { values: rows },
          aes: { x: { field: "x" }, y: { field: "y" }, linewidth: { field: "w" } },
          layers: [{ geom: "smooth", params: { method: "lm", se: false } }],
          scales: { linewidth: { type: "binned", domain } },
        }),
        viewport,
      );
      const paths = model.scene.batches.find((batch) => batch.kind === "paths");
      if (paths?.kind !== "paths") throw new Error("expected smooth paths");
      return paths.pathOffsets.length;
    };
    // Values 1 and 9 fall in distinct default bins → two grouped lines. The
    // reversed domain must bin identically to the ascending one.
    expect(pathCountForDomain([0, 10])).toBe(3);
    expect(pathCountForDomain([10, 0])).toBe(pathCountForDomain([0, 10]));
  });

  it("bins faceted styles on the global extent, not panel-local extents", () => {
    // Two panels whose local value ranges differ wildly; with global bins each
    // panel's points fall in a single bin (one line), so grouping must not split
    // them using panel-local rescaled bins.
    const model = runPipeline(
      fromAny({
        data: {
          values: [
            { g: "p1", x: 1, y: 1, band: 0 },
            { g: "p1", x: 2, y: 2, band: 0 },
            { g: "p1", x: 3, y: 3, band: 1 },
            { g: "p1", x: 4, y: 4, band: 1 },
            { g: "p2", x: 1, y: 1, band: 99 },
            { g: "p2", x: 2, y: 2, band: 99 },
            { g: "p2", x: 3, y: 3, band: 100 },
            { g: "p2", x: 4, y: 4, band: 100 },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, linetype: { field: "band" } },
        layers: [{ geom: "line" }],
        facet: { wrap: { field: "g" } },
        scales: { linetype: { type: "binned" } },
      }),
      viewport,
    );
    const pathBatches = model.scene.batches.filter((batch) => batch.kind === "paths");
    const totalSubpaths = pathBatches.reduce(
      (sum, batch) => sum + (batch.kind === "paths" ? batch.pathOffsets.length - 1 : 0),
      0,
    );
    // Global [0,100] bins put p1 (0,1) in bin 0 and p2 (99,100) in the top bin —
    // one line per panel. Panel-local binning would rescale each to [low,high]
    // and split every panel into two one-value groups (4 subpaths).
    expect(totalSubpaths).toBe(2);
  });
});

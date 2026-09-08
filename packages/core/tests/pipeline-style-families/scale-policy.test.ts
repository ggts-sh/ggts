import { describe, expect, it } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";

import { SpecValidationError } from "@ggts-sh/spec";

import { runPipeline } from "../../src/pipeline.js";

import { viewport } from "./fixtures.ts";

describe("style scale policy and validation", () => {
  it("supports manual, binned, identity, and explicit exhaustion policy", () => {
    const manual = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, group: "a" },
            { x: 2, y: 2, group: "b" },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, shape: { field: "group" } },
        layers: [{ geom: "point" }],
        scales: { shape: { type: "manual", domain: ["a", "b"], range: ["circle", "diamond"] } },
      }),
      viewport,
    );
    const points = manual.scene.batches.find((batch) => batch.kind === "points");
    if (points?.kind !== "points") throw new Error("expected points");
    expect([...points.shapeIndexes!]).toEqual([0, 3]);
    expect(manual.scene.legends.find((legend) => legend.scale === "shape")).toBeDefined();

    const binned = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, value: 1 },
            { x: 2, y: 2, value: 1 },
            { x: 1, y: 2, value: 9 },
            { x: 2, y: 3, value: 9 },
          ],
        },
        aes: {
          x: { field: "x" },
          y: { field: "y" },
          group: { field: "value" },
          linetype: { field: "value" },
        },
        layers: [{ geom: "line" }],
        scales: { linetype: { type: "binned", breaks: [0, 5, 10], range: ["solid", "dashed"] } },
      }),
      viewport,
    );
    const paths = binned.scene.batches.find((batch) => batch.kind === "paths");
    if (paths?.kind !== "paths") throw new Error("expected paths");
    expect([...paths.linetypeIndexes!]).toEqual([0, 1]);

    expect(() =>
      runPipeline(
        fromAny({
          data: {
            values: Array.from({ length: 8 }, (_, index) => ({
              x: index,
              y: index,
              group: `g${index}`,
            })),
          },
          aes: { x: { field: "x" }, y: { field: "y" }, shape: { field: "group" } },
          layers: [{ geom: "point" }],
        }),
        viewport,
      ),
    ).toThrow(expect.objectContaining({ code: "style-palette-exhausted" }));
  });

  it("resolves after-stat style mappings instead of dropping them", () => {
    const model = runPipeline(
      fromAny({
        data: { values: [{ category: "a" }, { category: "a" }, { category: "b" }] },
        aes: { x: { field: "category" }, alpha: { stat: "count" } },
        layers: [{ geom: "bar" }],
        scales: { alpha: { type: "sequential", domain: [1, 2], range: [0.25, 1] } },
      }),
      viewport,
    );
    const rects = model.scene.batches.find((batch) => batch.kind === "rects");
    if (rects?.kind !== "rects") throw new Error("expected bars");
    expect([...rects.alphas!].toSorted((left, right) => left - right)).toEqual([0.25, 1]);
    expect(
      [
        model.candidates.candidate(0)?.alphaValue,
        model.candidates.candidate(1)?.alphaValue,
      ].toSorted((left, right) => (left ?? 0) - (right ?? 0)),
    ).toEqual([1, 2]);
  });

  it("rejects unsupported continuous shape and incompatible geom mappings with fixes", () => {
    expect(() =>
      runPipeline(
        fromAny({
          data: { values: [{ x: 1, y: 2, value: 3 }] },
          aes: { x: { field: "x" }, y: { field: "y" }, shape: { field: "value" } },
          layers: [{ geom: "point" }],
          scales: { shape: { type: "sequential" } },
        }),
        viewport,
      ),
    ).toThrow(expect.objectContaining({ code: "unsupported-aesthetic-scale" }));

    expect(() =>
      runPipeline(
        fromAny({
          data: { values: [{ x: 1, y: 2, group: "a" }] },
          aes: { x: { field: "x" }, y: { field: "y" }, shape: { field: "group" } },
          layers: [{ geom: "line" }],
        }),
        viewport,
      ),
    ).toThrow(expect.objectContaining({ code: "unsupported-geom-aesthetic" }));
  });

  it("routes null to naValue and out-of-domain to unknownValue with warnings", () => {
    const model = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, amount: 10 },
            { x: 2, y: 2, amount: null },
            { x: 3, y: 3, amount: 200 },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "amount" } },
        layers: [{ geom: "point" }],
        scales: {
          size: {
            type: "sequential",
            domain: [0, 100],
            range: [2, 10],
            naValue: 1,
            unknownValue: 99,
          },
        },
      }),
      viewport,
    );
    const points = model.scene.batches.find((batch) => batch.kind === "points");
    if (points?.kind !== "points") throw new Error("expected points");
    // size interpolates by area: sqrt(2^2 + 0.1*(10^2-2^2)) = sqrt(13.6) in-range;
    // null -> naValue (1); 200 is OOB -> unknownValue (99).
    expect([...points.sizes!]).toEqual([Math.fround(Math.sqrt(13.6)), 1, 99]);
    expect(model.warnings.some((warning) => warning.code === "style-na-values")).toBe(true);
    expect(model.warnings.some((warning) => warning.code === "style-unknown-values")).toBe(true);
  });

  it("clamps out-of-domain values under oob squish without an unknown warning", () => {
    const model = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, amount: 10 },
            { x: 2, y: 2, amount: 200 },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "amount" } },
        layers: [{ geom: "point" }],
        scales: { size: { type: "sequential", domain: [0, 100], range: [2, 10], oob: "squish" } },
      }),
      viewport,
    );
    const points = model.scene.batches.find((batch) => batch.kind === "points");
    if (points?.kind !== "points") throw new Error("expected points");
    // 200 clamps to the domain max (100) -> range max (10) rather than the unknown style.
    expect([...points.sizes!]).toEqual([Math.fround(Math.sqrt(13.6)), 10]);
    expect(model.warnings.some((warning) => warning.code === "style-unknown-values")).toBe(false);
  });

  // #1311: sequential style warn path must index the batch semantic array.
  it("counts unknown sequential style values for null, unparseable, and OOB (#1311)", () => {
    const model = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, amount: 10 },
            { x: 2, y: 2, amount: null },
            { x: 3, y: 3, amount: "nope" },
            { x: 4, y: 4, amount: 200 },
            { x: 5, y: 5, amount: Number.POSITIVE_INFINITY },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "amount" } },
        layers: [{ geom: "point" }],
        scales: {
          size: {
            type: "sequential",
            domain: [0, 100],
            range: [2, 10],
            naValue: 1,
            unknownValue: 99,
          },
        },
      }),
      viewport,
    );
    // null → NA; "nope", 200 (OOB), Infinity → unknown.
    expect(model.warnings.filter((warning) => warning.code === "style-na-values")).toEqual([
      { code: "style-na-values", message: "1 size value(s) use the NA style." },
    ]);
    expect(model.warnings.filter((warning) => warning.code === "style-unknown-values")).toEqual([
      { code: "style-unknown-values", message: "3 size value(s) use the unknown style." },
    ]);
  });

  it("counts unknown binned style values without counting null as unknown (#1311)", () => {
    const model = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1, amount: 2 },
            { x: 2, y: 2, amount: null },
            { x: 3, y: 3, amount: "nope" },
            { x: 4, y: 4, amount: 50 },
            { x: 5, y: 5, amount: 150 },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "amount" } },
        layers: [{ geom: "point" }],
        scales: {
          size: {
            type: "binned",
            breaks: [0, 10, 100],
            range: [2, 10],
            naValue: 1,
            unknownValue: 99,
          },
        },
      }),
      viewport,
    );
    // null → NA; "nope" and 150 (above last break) → unknown; 2 and 50 in bins.
    expect(model.warnings.filter((warning) => warning.code === "style-na-values")).toEqual([
      { code: "style-na-values", message: "1 size value(s) use the NA style." },
    ]);
    expect(model.warnings.filter((warning) => warning.code === "style-unknown-values")).toEqual([
      { code: "style-unknown-values", message: "2 size value(s) use the unknown style." },
    ]);
  });

  it("cycles finite shapes past the palette when onExhaust is cycle", () => {
    const model = runPipeline(
      fromAny({
        data: {
          values: Array.from({ length: 8 }, (_, index) => ({
            x: index,
            y: index,
            group: `g${index}`,
          })),
        },
        aes: { x: { field: "x" }, y: { field: "y" }, shape: { field: "group" } },
        layers: [{ geom: "point" }],
        scales: { shape: { type: "ordinal", onExhaust: "cycle" } },
      }),
      viewport,
    );
    const points = model.scene.batches.find((batch) => batch.kind === "points");
    if (points?.kind !== "points") throw new Error("expected points");
    // Seven named symbols; the eighth group wraps to the first instead of throwing.
    expect([...points.shapeIndexes!]).toEqual([0, 1, 2, 3, 4, 5, 6, 0]);
  });

  it("rejects a binned domain that disagrees with its boundaries", () => {
    // Domain/breaks disagreement is now a validation-time scale-binned-domain
    // (pre-empting runtime style-domain-invalid).
    let domainBreaksError: unknown;
    try {
      runPipeline(
        fromAny({
          data: { values: [{ x: 1, y: 1, amount: 3 }] },
          aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "amount" } },
          layers: [{ geom: "point" }],
          scales: { size: { type: "binned", domain: [0, 50], breaks: [0, 5, 10], range: [2, 6] } },
        }),
        viewport,
      );
    } catch (error) {
      domainBreaksError = error;
    }
    expect(domainBreaksError).toBeInstanceOf(SpecValidationError);
    expect((domainBreaksError as SpecValidationError).errors.map((item) => item.code)).toContain(
      "scale-binned-domain",
    );
  });

  it("fails deterministically when temporal style values cannot be parsed", () => {
    expect(() =>
      runPipeline(
        fromAny({
          data: {
            values: [
              { x: 1, y: 1, when: "2024-01-01" },
              { x: 2, y: 2, when: "not-a-date" },
            ],
          },
          aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "when" } },
          layers: [{ geom: "point" }],
          scales: { size: { type: "sequential", temporalKind: "date", parse: "ymd" } },
        }),
        viewport,
      ),
    ).toThrow(expect.objectContaining({ code: "style-temporal-parse" }));
  });

  it("rejects temporal values mapped to a binned finite style", () => {
    // shape/linetype do not support date/datetime (capability contract); a
    // temporal column under type:"binned" must fail loudly, not silently map to
    // the unknown symbol or throw a misleading style-domain-empty.
    expect(() =>
      runPipeline(
        fromAny({
          data: {
            values: [
              { x: 1, y: 1, when: "2024-01-01" },
              { x: 2, y: 2, when: "2024-06-01" },
            ],
          },
          aes: { x: { field: "x" }, y: { field: "y" }, shape: { field: "when" } },
          layers: [{ geom: "point" }],
          scales: { shape: { type: "binned", breaks: [0, 1, 2] } },
        }),
        viewport,
      ),
    ).toThrow(expect.objectContaining({ code: "unsupported-aesthetic-scale" }));
  });

  it("resolves a smooth se after-stat mapping to linewidth instead of rejecting it", () => {
    // Previously threw stat-channel-unsupported: se is a published smooth output
    // and must be mappable to a numeric style. It now resolves onto the frame and
    // candidate (interaction truth) rather than being rejected.
    const model = runPipeline(
      fromAny({
        data: {
          values: [
            { x: 1, y: 1 },
            { x: 2, y: 3 },
            { x: 3, y: 2 },
            { x: 4, y: 5 },
            { x: 5, y: 4 },
          ],
        },
        aes: { x: { field: "x" }, y: { field: "y" }, linewidth: { stat: "se" } },
        layers: [{ geom: "smooth", params: { method: "lm", se: true } }],
        scales: { linewidth: { type: "identity" } },
      }),
      viewport,
    );
    const paths = model.scene.batches.find((batch) => batch.kind === "paths");
    if (paths?.kind !== "paths") throw new Error("expected smooth path");
    const width = model.candidates.candidate(0)?.linewidthValue;
    // Identity carries the pointwise standard error (>= 0) as the linewidth value.
    expect(typeof width).toBe("number");
    expect(Number.isFinite(width) && (width as number) >= 0).toBe(true);
  });

  it("rejects sequential style breaks that fall outside the domain", () => {
    expect(() =>
      runPipeline(
        fromAny({
          data: { values: [{ x: 1, y: 1, amount: 50 }] },
          aes: { x: { field: "x" }, y: { field: "y" }, size: { field: "amount" } },
          layers: [{ geom: "point" }],
          scales: { size: { type: "sequential", domain: [0, 100], breaks: [0, 50, 200] } },
        }),
        viewport,
      ),
    ).toThrow(expect.objectContaining({ code: "style-domain-invalid" }));
  });
});

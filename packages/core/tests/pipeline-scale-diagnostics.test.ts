/**
 * PR 3 — data-dependent scale diagnostics ride the RICH channel too.
 *
 * The plan requires pre-stat transform/OOB events to be materialized through
 * the rich `RenderModel.scaleDiagnostics` path (problem/cause/fixes/docs +
 * bounded evidence), not left only in the lean `{ code, message }` warning
 * channel. This suite pins that both channels carry the event, and the rich
 * entry is complete and deduplicated per axis/field.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg, scaleXLog10 } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";

const size = { width: 640, height: 400 };

// One non-positive x under a log10 scale → one transform-domain drop.
const rows = [
  { x: 1, y: 1 },
  { x: 10, y: 2 },
  { x: -5, y: 3 },
  { x: 100, y: 4 },
];

describe("scale-transform-domain rich scaleDiagnostics", () => {
  const model = runPipeline(
    gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint()
      .scales(scaleXLog10())
      .spec(),
    size,
  );

  it("still emits the lean warning", () => {
    const warning = model.warnings.find((w) => w.code === "scale-transform-domain");
    expect(warning).toBeDefined();
  });

  it("also materializes a rich ScaleDiagnostic with problem/cause/fixes/docs", () => {
    const rich = model.scaleDiagnostics.find((d) => d.code === "scale-transform-domain");
    expect(rich).toBeDefined();
    expect(rich!.severity).toBe("warning");
    expect(rich!.path).toBe("/scales/x");
    expect(rich!.problem.length).toBeGreaterThan(0);
    expect(rich!.cause.length).toBeGreaterThan(0);
    expect(rich!.fixes.length).toBeGreaterThan(0);
    expect(rich!.documentationUrl.length).toBeGreaterThan(0);
  });

  it("carries bounded evidence: the dropped count and a sample of failing values", () => {
    const rich = model.scaleDiagnostics.find((d) => d.code === "scale-transform-domain");
    expect(rich!.evidence?.failedCount).toBe(1);
    expect(rich!.evidence?.values).toContain(-5);
    // Bounded: never dumps the full column.
    expect((rich!.evidence?.values ?? []).length).toBeLessThanOrEqual(5);
  });

  it("is deduplicated per axis/field (one rich entry, not one per row)", () => {
    const matches = model.scaleDiagnostics.filter((d) => d.code === "scale-transform-domain");
    expect(matches.length).toBe(1);
  });
});

describe("scale-transform-domain multi-field rich diagnostics (#628)", () => {
  it("keeps one rich entry per source field on the same axis (not collapsed by path dedupe)", () => {
    const multiModel = runPipeline(
      {
        data: {
          values: [
            { a: 1, b: 2, y: 1 },
            { a: -3, b: -7, y: 2 },
            { a: 10, b: 20, y: 3 },
          ],
        },
        layers: [
          { geom: "point", aes: { x: { field: "a" }, y: { field: "y" } } },
          { geom: "point", aes: { x: { field: "b" }, y: { field: "y" } } },
        ],
        scales: { x: { type: "linear", transform: "log10" } },
      },
      size,
    );
    const lean = multiModel.warnings.filter((w) => w.code === "scale-transform-domain");
    const rich = multiModel.scaleDiagnostics.filter((d) => d.code === "scale-transform-domain");
    // Lean messages include the field name; both fields must survive.
    expect(lean.length).toBe(2);
    expect(lean.some((w) => w.message.includes('"a"'))).toBe(true);
    expect(lean.some((w) => w.message.includes('"b"'))).toBe(true);
    // Rich channel must not collapse distinct fields that share path `/scales/x`.
    expect(rich.length).toBe(2);
    expect(rich.every((d) => d.path === "/scales/x")).toBe(true);
    expect(rich.some((d) => d.cause.includes('"a"'))).toBe(true);
    expect(rich.some((d) => d.cause.includes('"b"'))).toBe(true);
  });
});

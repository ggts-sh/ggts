/**
 * PR 3 — the two scale-TRAINING diagnostics (baseline transformed origin,
 * break-outside-domain) are materialized on the rich `RenderModel.scaleDiagnostics`
 * channel too, not only the lean warning/advisory channels (plan: "Data-dependent
 * scale warnings are also materialized through the rich scaleDiagnostics path").
 */
import { describe, expect, it } from "bun:test";

import { aes, gg, scaleXContinuous, scaleYLog10 } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";

const size = { width: 640, height: 400 };

describe("rich scaleDiagnostics — scale-baseline-transformed-origin", () => {
  it("materializes the log10 bar baseline advisory with problem/cause/fixes/docs", () => {
    const rows = [
      { g: "a", y: 10 },
      { g: "b", y: 100 },
    ];
    const model = runPipeline(
      gg(rows, aes({ x: "g", y: "y" }))
        .geomCol()
        .scales(scaleYLog10())
        .spec(),
      size,
    );
    // Lean advisory still present…
    expect(model.advisories.some((a) => a.code === "scale-baseline-transformed-origin")).toBe(true);
    // …and now on the rich channel, deduplicated once, on the y axis.
    const rich = model.scaleDiagnostics.filter(
      (d) => d.code === "scale-baseline-transformed-origin",
    );
    expect(rich.length).toBe(1);
    expect(rich[0]!.severity).toBe("advisory");
    expect(rich[0]!.path).toBe("/scales/y");
    expect(rich[0]!.problem.length).toBeGreaterThan(0);
    expect(rich[0]!.cause.length).toBeGreaterThan(0);
    expect(rich[0]!.fixes.length).toBeGreaterThan(0);
    expect(rich[0]!.documentationUrl).toContain("scale-baseline-transformed-origin");
  });
});

describe("rich scaleDiagnostics — scale-break-outside-domain", () => {
  const rows = [
    { x: 1, y: 1 },
    { x: 5, y: 2 },
    { x: 9, y: 3 },
  ];

  it("materializes the omitted-break warning with evidence values + count", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scales(scaleXContinuous({ breaks: [1, 5, 1000] }))
        .spec(),
      size,
    );
    expect(model.warnings.some((w) => w.code === "scale-break-outside-domain")).toBe(true);
    const rich = model.scaleDiagnostics.filter((d) => d.code === "scale-break-outside-domain");
    expect(rich.length).toBe(1);
    expect(rich[0]!.severity).toBe("warning");
    expect(rich[0]!.path).toBe("/scales/x/breaks");
    expect(rich[0]!.evidence?.values).toContain(1000);
    expect(rich[0]!.evidence?.failedCount).toBe(1);
  });

  it("is silent on the rich channel when every break is inside the domain", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .scales(scaleXContinuous({ breaks: [1, 5, 9] }))
        .spec(),
      size,
    );
    expect(model.scaleDiagnostics.some((d) => d.code === "scale-break-outside-domain")).toBe(false);
  });
});

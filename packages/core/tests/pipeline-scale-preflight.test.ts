/**
 * PR 3 — structural scale-config preflight (red-first).
 *
 * The spec surface (position-scale-api.test.ts) deliberately defers structural
 * conflicts to the core pipeline: `normalize()` never throws and leaves a
 * conflicting `{ type: "log", transform: "identity" | "sqrt" }` uncanonicalized.
 * This suite proves the pipeline rejects those (and `zero: true` under a
 * transform with no valid zero) BEFORE any data execution — even for empty
 * data — with the cataloged `scale-type-transform-conflict` /
 * `scale-zero-invalid-for-transform` codes at the plan's JSON paths.
 */
import { describe, expect, it } from "bun:test";

import type { PortableSpec } from "@ggts-sh/spec";

import { runPipeline } from "../src/pipeline.ts";
import { PipelineError } from "../src/pipeline/types.ts";

const size = { width: 640, height: 400 };
const rows = [
  { x: 1, y: 1 },
  { x: 10, y: 2 },
];

/** A minimal PortableSpec with a raw (possibly-conflicting) x scale. */
function specWithXScale(scale: Record<string, unknown>): PortableSpec {
  return {
    data: { columns: { x: rows.map((r) => r.x), y: rows.map((r) => r.y) } },
    aes: { x: { field: "x" }, y: { field: "y" } },
    layers: [{ geom: "point", stat: "identity", position: "identity" }],
    scales: { x: scale },
  } as unknown as PortableSpec;
}

function caught(spec: PortableSpec): PipelineError {
  try {
    runPipeline(spec, size);
  } catch (error) {
    if (error instanceof PipelineError) return error;
    throw error;
  }
  throw new Error("expected runPipeline to throw a PipelineError");
}

describe("scale-type-transform-conflict", () => {
  it("rejects type:log with a conflicting sqrt transform at /scales/x/transform", () => {
    const error = caught(specWithXScale({ type: "log", transform: "sqrt" }));
    expect(error.code).toBe("scale-type-transform-conflict");
    expect(error.path).toBe("/scales/x/transform");
    expect(error.diagnostic?.severity).toBe("error");
  });

  it("rejects type:log with a conflicting identity transform", () => {
    expect(caught(specWithXScale({ type: "log", transform: "identity" })).code).toBe(
      "scale-type-transform-conflict",
    );
  });

  it("rejects a temporal scale asking for a non-identity transform", () => {
    expect(caught(specWithXScale({ type: "time", transform: "log10" })).code).toBe(
      "scale-type-transform-conflict",
    );
  });

  it("accepts the canonical rewrite of a bare type:log (no conflict)", () => {
    // { type: "log" } canonicalizes to { type: "linear", transform: "log10" }.
    expect(() => runPipeline(specWithXScale({ type: "log" }), size)).not.toThrow();
  });

  it("throws even when data is empty (structural, pre-execution)", () => {
    const spec = {
      data: { columns: { x: [], y: [] } },
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [{ geom: "point", stat: "identity", position: "identity" }],
      scales: { x: { type: "log", transform: "sqrt" } },
    } as unknown as PortableSpec;
    expect(caught(spec).code).toBe("scale-type-transform-conflict");
  });
});

describe("scale-zero-invalid-for-transform", () => {
  it("rejects zero:true under log10 (no semantic-zero image) at /scales/x", () => {
    const error = caught(specWithXScale({ type: "linear", transform: "log10", zero: true }));
    expect(error.code).toBe("scale-zero-invalid-for-transform");
    expect(error.path).toBe("/scales/x");
  });

  it("accepts zero:true under sqrt (zero is a valid sqrt input)", () => {
    expect(() =>
      runPipeline(specWithXScale({ type: "linear", transform: "sqrt", zero: true }), size),
    ).not.toThrow();
  });

  it("accepts log10 without an explicit zero:true", () => {
    expect(() =>
      runPipeline(specWithXScale({ type: "linear", transform: "log10" }), size),
    ).not.toThrow();
  });
});

/**
 * Tier-2 data-aware checks: DataProfile and input limits.
 * Split from validate-tier2-data.test.ts.
 * Production: validate-data*.ts (style: validate-data-checks-style.ts).
 */
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it, spyOn } from "bun:test";

import { collectLayerDataChecks } from "../src/validate-data-checks-layer.ts";
import type { FieldEvidenceEntry } from "../src/validate-data-evidence.ts";
import type { DataProfile } from "../src/validate-data.ts";
import { validate } from "../src/validate.ts";

function errorsOf(input: unknown, options?: Parameters<typeof validate>[1]) {
  const result = validate(input, options ?? {});
  if (result.ok) throw new Error("expected validation failure");
  return result.errors;
}

function codesOf(input: unknown, options?: Parameters<typeof validate>[1]) {
  return errorsOf(input, options).map((e) => e.code);
}

describe("tier 2 — DataProfile", () => {
  it("collects field names only for the layer with missing fields", () => {
    const evidence: FieldEvidenceEntry = {
      type: "quantitative",
      allNull: false,
      values: null,
      temporal: null,
    };
    const fields = new Map([
      ["alpha", evidence],
      ["beta", evidence],
    ]);
    const point = { geom: "point" };
    const keyReads = spyOn(fields, "keys");
    let result: ReturnType<typeof collectLayerDataChecks>;
    let enumerations: number;
    try {
      result = collectLayerDataChecks({
        layers: [
          point,
          point,
          { geom: "point", aes: { x: { field: "alpa" }, color: { field: "bta" } } },
        ],
        plotAes: { x: { field: "alpha" }, y: { field: "beta" } },
        plotFields: fields,
        layerMaps: null,
        scaleRequestsTime: () => false,
      });
      enumerations = keyReads.mock.calls.length;
    } finally {
      keyReads.mockRestore();
    }

    expect(result.errors.map((error) => [error.code, error.path])).toEqual([
      ["unknown-field", "/layers/2/aes/x"],
      ["unknown-field", "/layers/2/aes/color"],
    ]);
    expect(result.errors[0]?.message).toContain('Did you mean "alpha"?');
    expect(result.errors[1]?.message).toContain('Did you mean "beta"?');
    expect(result.errors[0]?.allowed).toEqual(["alpha", "beta"]);
    expect(result.errors[0]?.allowed).toBe(result.errors[1]?.allowed);
    expect(enumerations).toBe(1);
  });

  const profile: DataProfile = {
    fields: [
      { name: "city", type: "nominal" },
      { name: "temp", type: "quantitative" },
      { name: "when", type: "temporal" },
    ],
    rowCount: 120,
  };

  it("validates field existence and scale compatibility without data", () => {
    const spec = {
      aes: { x: { field: "cityy" }, y: { field: "temp" } },
      scales: { y: { type: "time" } },
      layers: [{ geom: "point" }],
    };
    const errors = errorsOf(spec, { profile });
    expect(errors.map((e) => e.code)).toEqual(["unknown-field", "scale-type-mismatch"]);
    expect(errors[0]?.message).toContain('Did you mean "city"?');
  });

  it("rejects malformed profiles", () => {
    expect(
      codesOf(
        { layers: [{ geom: "point", aes: { x: { field: "a" }, y: { field: "b" } } }] },
        { profile: fromAny({ fields: [{ name: "a", type: "numeric" }] }) },
      ),
    ).toEqual(["invalid-data-profile"]);
  });

  it("defers a profile-backed temporal numeric style with a working parser", () => {
    // Profile fields carry no sample values, so the temporal decision is null; with an
    // epoch parser the runtime turns the numeric column temporal once data arrives, so
    // the numeric-style check must defer rather than false-reject a spec that renders.
    expect(
      validate(
        {
          aes: { x: { field: "city" }, y: { field: "temp" }, size: { field: "temp" } },
          scales: { size: { type: "sequential", parse: { epoch: "seconds" } } },
          layers: [{ geom: "point" }],
        },
        { profile },
      ).ok,
    ).toBe(true);
  });

  it("rejects a profile-backed temporal numeric style without an epoch parser", () => {
    // Without an epoch parser (or censor recovery), a quantitative profile field with
    // temporalKind stays non-temporal at runtime and throws style-temporal-parse, so
    // validation must reject it rather than defer just because there are no samples.
    const errors = errorsOf(
      {
        aes: { x: { field: "city" }, y: { field: "temp" }, size: { field: "temp" } },
        scales: { size: { type: "sequential", temporalKind: "date" } },
        layers: [{ geom: "point" }],
      },
      { profile },
    );
    expect(errors.map((e) => e.code)).toEqual(["scale-type-mismatch"]);
  });

  it("rejects a profile epoch temporal style requesting an incompatible date kind", () => {
    // Epoch parsing always yields datetime; a profile-backed field with an epoch parser
    // and temporalKind: "date" throws style-temporal-kind at runtime, so the defer must
    // not accept it just because there are no samples.
    const errors = errorsOf(
      {
        aes: { x: { field: "city" }, y: { field: "temp" }, size: { field: "temp" } },
        scales: { size: { type: "sequential", parse: { epoch: "seconds" }, temporalKind: "date" } },
        layers: [{ geom: "point" }],
      },
      { profile },
    );
    expect(errors.map((e) => e.code)).toEqual(["scale-type-mismatch"]);
    expect(errors[0]?.message).toContain("datetime");
  });
});

describe("tier 2 — input limits", () => {
  it("row limit skips data checks with a validation-limit diagnostic", () => {
    const n = 50;
    const spec = {
      data: { columns: { x: Array.from({ length: n }, (_, i) => i) } },
      aes: { x: { field: "x" }, y: { field: "x" } },
      layers: [{ geom: "point" }],
    };
    const errors = errorsOf(spec, { limits: { maxRows: 10 } });
    expect(errors.map((e) => e.code)).toEqual(["validation-limit"]);
    expect(errors[0]?.message).toContain("maxRows");
  });

  it("byte limit skips data checks with a validation-limit diagnostic", () => {
    // Wide strings force estimateBytes over a tiny maxBytes without many rows.
    const fat = "x".repeat(2000);
    const spec = {
      data: { columns: { x: [fat, fat], y: [1, 2] } },
      aes: { x: { field: "missing" }, y: { field: "y" } },
      layers: [{ geom: "point" }],
    };
    const errors = errorsOf(spec, { limits: { maxBytes: 100 } });
    expect(errors.map((e) => e.code)).toEqual(["validation-limit"]);
    expect(errors[0]?.message).toContain("maxBytes");
    // Evidence short-circuit: no unknown-field for "missing".
    expect(errors.some((e) => e.code === "unknown-field")).toBe(false);
  });

  it("depth limit refuses pathological nesting", () => {
    let nested: Record<string, unknown> = { field: "x" };
    for (let i = 0; i < 50; i++) nested = { wrap: nested };
    const errors = errorsOf({ layers: [{ geom: "point" }], junk: nested });
    expect(errors[0]?.code).toBe("validation-limit");
    expect(errors[0]?.message).toContain("maxDepth");
  });

  it("diagnostics are capped by maxDiagnostics", () => {
    const layers = Array.from({ length: 30 }, () => ({ geom: "point" }));
    const errors = errorsOf({ layers }, { limits: { maxDiagnostics: 5 } });
    expect(errors).toHaveLength(6);
    expect(errors.at(-1)?.code).toBe("validation-limit");
  });
});

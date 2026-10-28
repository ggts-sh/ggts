/**
 * Position scale schema + normalize contract (TypeBox parity, type:log matrix,
 * portability of new fields). Helpers/builder: position-scale-helpers.test.ts.
 * Production: schema declarations + normalize-scales + scale-position-helpers.
 */
import { describe, expect, it } from "bun:test";

import * as spec from "../src/index.ts";
import { normalize } from "../src/normalize.ts";
import type { PositionScaleSpec } from "../src/schema.ts";
import { validate } from "../src/validate.ts";

function validateScale(x: unknown, y?: unknown) {
  return validate(
    normalize({
      layers: [{ geom: "point", aes: { x: "a", y: "b" } }],
      // deliberately untyped: exercising schema acceptance/rejection
      scales: { x, ...(y !== undefined && { y }) } as never,
    }),
  );
}

const accepts = (x: unknown): boolean => validateScale(x).ok;

describe("PositionScaleSpec new fields — TypeBox/runtime parity", () => {
  it("accepts transform identity/log10/sqrt on the linear family", () => {
    expect(accepts({ type: "linear", transform: "identity" })).toBe(true);
    expect(accepts({ type: "linear", transform: "log10" })).toBe(true);
    expect(accepts({ type: "linear", transform: "sqrt" })).toBe(true);
  });

  it("rejects an unknown transform value", () => {
    expect(accepts({ type: "linear", transform: "ln" })).toBe(false);
    expect(accepts({ type: "linear", transform: "log2" })).toBe(false);
  });

  it("accepts a binned scale type", () => {
    expect(accepts({ type: "binned" })).toBe(true);
    expect(accepts({ type: "binned", transform: "log10" })).toBe(true);
  });

  it("accepts scalar and tuple expansion", () => {
    expect(accepts({ type: "linear", expand: { mult: 0.05, add: 0 } })).toBe(true);
    expect(accepts({ type: "linear", expand: { mult: [0.05, 0.1] } })).toBe(true);
    expect(accepts({ type: "linear", expand: { add: [1, 2] } })).toBe(true);
    expect(accepts({ type: "linear", expand: {} })).toBe(true);
  });

  it("rejects negative, overlong, and unknown-key expansion", () => {
    expect(accepts({ type: "linear", expand: { mult: -1 } })).toBe(false);
    expect(accepts({ type: "linear", expand: { add: [-1, 0] } })).toBe(false);
    expect(accepts({ type: "linear", expand: { mult: [1, 2, 3] } })).toBe(false);
    expect(accepts({ type: "linear", expand: { bogus: 1 } })).toBe(false);
    expect(accepts({ type: "linear", expand: { mult: "x" } })).toBe(false);
  });

  it("accepts oob censor/squish and rejects others", () => {
    expect(accepts({ type: "linear", oob: "censor" })).toBe(true);
    expect(accepts({ type: "linear", oob: "squish" })).toBe(true);
    expect(accepts({ type: "linear", oob: "drop" })).toBe(false);
  });

  it("accepts finite/null naValue and rejects non-numeric", () => {
    expect(accepts({ type: "linear", naValue: 0 })).toBe(true);
    expect(accepts({ type: "linear", naValue: null })).toBe(true);
    expect(accepts({ type: "linear", naValue: "x" })).toBe(false);
    expect(accepts({ type: "linear", naValue: true })).toBe(false);
  });

  it("accepts numeric minorBreaks and rejects empty/non-numeric", () => {
    expect(accepts({ type: "linear", minorBreaks: [1, 2, 3] })).toBe(true);
    expect(accepts({ type: "linear", minorBreaks: [] })).toBe(false);
    expect(accepts({ type: "linear", minorBreaks: ["a"] })).toBe(false);
  });

  it("caps explicit breaks only when they are binned boundaries", () => {
    const denseBreaks = Array.from({ length: spec.MAX_BINNED_BREAKS + 2 }, (_, index) => index);
    expect(accepts({ type: "linear", breaks: denseBreaks })).toBe(true);
    expect(accepts({ type: "time", breaks: denseBreaks })).toBe(true);
    expect(accepts({ type: "binned", breaks: denseBreaks })).toBe(false);
  });

  it("still rejects genuinely unknown scale keys", () => {
    expect(accepts({ type: "linear", nonsense: 1 })).toBe(false);
  });

  it("accepts band guide layout pins (#407)", () => {
    expect(accepts({ type: "band", guide: { mode: "auto" } })).toBe(true);
    expect(accepts({ type: "band", guide: { mode: "single" } })).toBe(true);
    expect(accepts({ type: "band", guide: { mode: "wrap", wrap: 3 } })).toBe(true);
    expect(accepts({ type: "band", guide: { mode: "rotate", angle: -45 } })).toBe(true);
    expect(accepts({ type: "band", guide: { mode: "off" } })).toBe(true);
    expect(accepts({ type: "band", guide: { angle: -90 } })).toBe(true);
  });

  it("rejects invalid band guide values", () => {
    expect(accepts({ type: "band", guide: { mode: "diagonal" } })).toBe(false);
    expect(accepts({ type: "band", guide: { wrap: 0 } })).toBe(false);
    expect(accepts({ type: "band", guide: { wrap: 99 } })).toBe(false);
    expect(accepts({ type: "band", guide: { bogus: true } })).toBe(false);
  });
});

describe("normalize — canonical type:log matrix", () => {
  const scaleOf = (x: PositionScaleSpec) =>
    normalize({ layers: [{ geom: "point", aes: { x: "a", y: "b" } }], scales: { x } }).scales?.x;

  it("rewrites bare type:log to linear + log10", () => {
    expect(scaleOf({ type: "log" })).toEqual({ type: "linear", transform: "log10" });
  });

  it("rewrites synonymous type:log + transform:log10 to linear + log10", () => {
    expect(scaleOf({ type: "log", transform: "log10" })).toEqual({
      type: "linear",
      transform: "log10",
    });
  });

  it("preserves other options while rewriting log", () => {
    expect(scaleOf({ type: "log", zero: false, domain: [1, 100] })).toEqual({
      type: "linear",
      transform: "log10",
      zero: false,
      domain: [1, 100],
    });
  });

  it("leaves conflicting type:log + transform:identity|sqrt uncanonicalized", () => {
    expect(scaleOf({ type: "log", transform: "identity" })).toEqual({
      type: "log",
      transform: "identity",
    });
    expect(scaleOf({ type: "log", transform: "sqrt" })).toEqual({
      type: "log",
      transform: "sqrt",
    });
  });

  it("never throws on any matrix cell (pure normalize)", () => {
    for (const cell of [
      { type: "log" },
      { type: "log", transform: "log10" },
      { type: "log", transform: "identity" },
      { type: "log", transform: "sqrt" },
    ] as const) {
      expect(() => scaleOf(cell)).not.toThrow();
    }
  });

  it("is idempotent across the matrix", () => {
    for (const cell of [
      { type: "log" },
      { type: "log", transform: "log10" },
      { type: "log", transform: "identity" },
      { type: "linear", transform: "sqrt", expand: { mult: 0.05 } },
      { type: "binned", transform: "log10" },
    ] as const) {
      const once = normalize({
        layers: [{ geom: "point", aes: { x: "a", y: "b" } }],
        scales: { x: cell },
      });
      expect(normalize(once)).toEqual(once);
    }
  });
});

describe("explicit tick labels (#1825)", () => {
  const codes = (x: unknown): string[] => {
    const result = validateScale(x);
    return result.ok ? [] : result.errors.map((error) => error.code);
  };

  it("accepts a labels array the same length as explicit breaks", () => {
    expect(accepts({ type: "linear", breaks: [4, 14], labels: ["Group A", "Group B"] })).toBe(true);
    expect(accepts({ type: "band", breaks: ["b", "a"], labels: ["Bee", "Ay"] })).toBe(true);
    expect(
      accepts({ type: "time", breaks: ["2026-01-01", "2026-07-01"], labels: ["H1", "H2"] }),
    ).toBe(true);
  });

  it("keeps format-string labels valid", () => {
    expect(accepts({ type: "linear", labels: ".1f" })).toBe(true);
  });

  it("rejects a labels array whose length differs from breaks", () => {
    expect(codes({ type: "linear", breaks: [4, 14], labels: ["Group A"] })).toEqual([
      "scale-labels-breaks-length",
    ]);
  });

  it("rejects a labels array without explicit breaks", () => {
    expect(codes({ type: "linear", labels: ["Group A", "Group B"] })).toEqual([
      "scale-labels-breaks-length",
    ]);
  });

  it("rejects a non-string label entry at tier 1", () => {
    expect(accepts({ type: "linear", breaks: [4], labels: [4] })).toBe(false);
  });

  it("normalizes a labels array idempotently and keeps it portable", () => {
    const once = normalize({
      layers: [{ geom: "point", aes: { x: "a", y: "b" } }],
      scales: { x: { type: "linear", breaks: [4, 14], labels: ["Group A", "Group B"] } },
    });
    expect(once.scales?.x?.labels).toEqual(["Group A", "Group B"]);
    expect(normalize(once)).toEqual(once);
    expect(spec.isPortable(once)).toBe(true);
  });
});

describe("portability of the new fields", () => {
  it("keeps a spec with new numeric fields portable", () => {
    const s = normalize({
      layers: [{ geom: "point", aes: { x: "a", y: "b" } }],
      scales: {
        x: { type: "linear", transform: "log10", expand: { mult: 0.05 }, minorBreaks: [1, 2, 5] },
      },
    });
    expect(spec.isPortable(s)).toBe(true);
  });

  it("still rejects a function anywhere in scales (no callbacks)", () => {
    const s = {
      edition: 1,
      layers: [
        { geom: "point", stat: "identity", position: "identity", aes: { x: { field: "a" } } },
      ],
      scales: { x: { type: "linear", transform: (v: number) => v } },
    };
    expect(spec.isPortable(s as never)).toBe(false);
  });
});

// Capability-ledger cross-validation lives in ./capabilities.test.ts.

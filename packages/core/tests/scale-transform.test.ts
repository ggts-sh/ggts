/**
 * PR 3 — pure position transform registry (identity / log10 / sqrt).
 *
 * Forward/inverse round trips, validity boundaries, signed zero, very
 * large/small finite values, monotonicity, immutability, and exhaustive
 * registry lookup with a stable invalid-scale-transform error. The
 * TransformedColumnView cache-invocation counters live alongside these once
 * the view layer exists (same file, added in the transformed-views slice).
 */
import { describe, expect, it } from "bun:test";

import { ColumnTable } from "../src/table.ts";
import type { ColumnTransformConfig } from "../src/scales/transform.ts";
import { ScaleConfigError } from "../src/scales/train.ts";
import {
  columnTransformRunCount,
  getScaleTransform,
  POSITION_TRANSFORM_NAMES,
  resetColumnTransformRunCount,
  scaleTransform,
} from "../src/scales/transform.ts";

const NUMERIC_ONLY = { inferTemporal: false } as const;

function config(
  key: "identity" | "log10" | "sqrt",
  overrides: Partial<Omit<ColumnTransformConfig, "transform">> = {},
): ColumnTransformConfig {
  return {
    transform: scaleTransform(key),
    sourceLimits: overrides.sourceLimits ?? null,
    oob: overrides.oob ?? "censor",
    naValue: overrides.naValue ?? null,
  };
}

describe("transform registry — keys and lookup", () => {
  it("exposes exactly identity, log10, sqrt", () => {
    expect([...POSITION_TRANSFORM_NAMES]).toEqual(["identity", "log10", "sqrt"]);
  });

  it("returns the transform keyed by name", () => {
    for (const key of POSITION_TRANSFORM_NAMES) {
      expect(scaleTransform(key).key).toBe(key);
    }
  });

  it("returns stable references (no per-call allocation)", () => {
    expect(scaleTransform("log10")).toBe(scaleTransform("log10"));
    expect(getScaleTransform("sqrt")).toBe(scaleTransform("sqrt"));
  });

  it("throws a stable invalid-scale-transform error for unknown keys", () => {
    let caught: unknown;
    try {
      getScaleTransform("ln");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ScaleConfigError);
    expect((caught as ScaleConfigError).code).toBe("invalid-scale-transform");
  });
});

describe("@ggts-sh/core root export identity", () => {
  it("re-exports the transform registry through the package root with the same stable-reference guarantee", async () => {
    // Package-boundary import (dist), not the relative ../src import the rest
    // of this file uses — proves @ggts-sh/svelte consumers see the same
    // singleton registry contract as core's own internals.
    const root = await import("@ggts-sh/core");
    expect([...root.POSITION_TRANSFORM_NAMES]).toEqual(["identity", "log10", "sqrt"]);
    expect(root.scaleTransform("log10")).toBe(root.scaleTransform("log10"));
    expect(root.getScaleTransform("sqrt")).toBe(root.scaleTransform("sqrt"));
    expect(root.POSITION_TRANSFORM_NAMES).toBe(root.POSITION_TRANSFORM_NAMES);
  });
});

describe("identity", () => {
  const t = scaleTransform("identity");
  it("is the identity map on finite values", () => {
    for (const v of [-1e6, -3.5, 0, 2, 42, 1e6]) {
      expect(t.forward(v)).toBe(v);
      expect(t.inverse(v)).toBe(v);
    }
  });
  it("accepts every finite value and rejects non-finite", () => {
    expect(t.valid(0)).toBe(true);
    expect(t.valid(-5)).toBe(true);
    expect(t.valid(Number.NaN)).toBe(false);
    expect(t.valid(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("log10", () => {
  const t = scaleTransform("log10");
  it("forward is base-10 log; inverse is 10**x", () => {
    expect(t.forward(1)).toBeCloseTo(0, 12);
    expect(t.forward(10)).toBeCloseTo(1, 12);
    expect(t.forward(1000)).toBeCloseTo(3, 12);
    expect(t.inverse(2)).toBeCloseTo(100, 9);
  });
  it("round-trips inverse(forward(v)) ~= v for positive v", () => {
    for (const v of [1e-6, 0.5, 1, 7, 250, 1e6, 1e18]) {
      expect(t.inverse(t.forward(v))).toBeCloseTo(v, 6);
    }
  });
  it("is valid only for finite strictly-positive values (incl. signed zero)", () => {
    expect(t.valid(1)).toBe(true);
    expect(t.valid(1e-300)).toBe(true);
    expect(t.valid(0)).toBe(false);
    expect(t.valid(-0)).toBe(false);
    expect(t.valid(-1)).toBe(false);
    expect(t.valid(Number.POSITIVE_INFINITY)).toBe(false);
  });
  it("forward is strictly monotonic increasing on its domain", () => {
    const xs = [0.1, 1, 2, 10, 100, 1e5];
    for (let i = 1; i < xs.length; i++) {
      expect(t.forward(xs[i]!)).toBeGreaterThan(t.forward(xs[i - 1]!));
    }
  });
});

describe("sqrt", () => {
  const t = scaleTransform("sqrt");
  it("forward is sqrt; inverse is x**2", () => {
    expect(t.forward(0)).toBe(0);
    expect(t.forward(4)).toBeCloseTo(2, 12);
    expect(t.forward(9)).toBeCloseTo(3, 12);
    expect(t.inverse(3)).toBeCloseTo(9, 9);
  });
  it("round-trips inverse(forward(v)) ~= v for non-negative v", () => {
    for (const v of [0, 0.25, 1, 16, 1000, 1e12]) {
      expect(t.inverse(t.forward(v))).toBeCloseTo(v, 6);
    }
  });
  it("is valid for finite non-negative values including signed zero", () => {
    expect(t.valid(0)).toBe(true);
    expect(t.valid(-0)).toBe(true);
    expect(t.valid(4)).toBe(true);
    expect(t.valid(-0.0001)).toBe(false);
    expect(t.valid(Number.NaN)).toBe(false);
  });
  it("forward is strictly monotonic increasing on its domain", () => {
    const xs = [0, 1, 2, 9, 100, 1e6];
    for (let i = 1; i < xs.length; i++) {
      expect(t.forward(xs[i]!)).toBeGreaterThan(t.forward(xs[i - 1]!));
    }
  });
});

describe("immutability", () => {
  it("registry entries are frozen", () => {
    const t = scaleTransform("log10");
    expect(Object.isFrozen(t)).toBe(true);
    expect(() => {
      (t as { key: string }).key = "sqrt";
    }).toThrow();
  });
});

// Surface contract: the column view types stay importable from the stable
// ./table.js barrel even though in-repo consumers use table-types.js directly.
import type { ParsedColumnView, TransformedColumnView } from "../src/table.js";

describe("column view barrel surface", () => {
  it("exposes ParsedColumnView and TransformedColumnView from ./table.js", () => {
    const parsed = null as unknown as ParsedColumnView | null;
    const transformed = null as unknown as TransformedColumnView | null;
    expect(parsed).toBeNull();
    expect(transformed).toBeNull();
  });
});

describe("TransformedColumnView cache", () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({ x: i + 1, panel: i % 4 }));
  const parent = ColumnTable.fromRows(rows);

  it("runs the transform kernel once per source key across 100 subsets", () => {
    resetColumnTransformRunCount();
    const full = parent.transformed("x", "auto", NUMERIC_ONLY, config("log10"));
    expect(columnTransformRunCount()).toBe(1);
    for (let p = 0; p < 100; p++) {
      const subset = parent.subset([p]);
      subset.transformed("x", "auto", NUMERIC_ONLY, config("log10"));
    }
    // Subsets gather from the parent view; the kernel never re-runs.
    expect(columnTransformRunCount()).toBe(1);
    // The parent view is cached (reference identity).
    expect(parent.transformed("x", "auto", NUMERIC_ONLY, config("log10"))).toBe(full);
  });

  it("subset transformed values and diagnostic counts match selected parent rows", () => {
    const full = parent.transformed("x", "auto", NUMERIC_ONLY, config("log10"));
    const subset = parent.subset([2, 9, 99]);
    const view = subset.transformed("x", "auto", NUMERIC_ONLY, config("log10"));
    expect(view.transformed[0]).toBe(full.transformed[2]);
    expect(view.transformed[1]).toBe(full.transformed[9]);
    expect(view.transformed[2]).toBe(full.transformed[99]);

    const censored = subset.transformed(
      "x",
      "auto",
      NUMERIC_ONLY,
      config("log10", { sourceLimits: [10, 50] }),
    );
    expect(censored.censored).toBe(2);
    expect(censored.squished).toBe(0);

    const squished = subset.transformed(
      "x",
      "auto",
      NUMERIC_ONLY,
      config("log10", { sourceLimits: [10, 50], oob: "squish" }),
    );
    expect(squished.censored).toBe(0);
    expect(squished.squished).toBe(2);
  });

  it("produces distinct views + keys per transform/oob/limits/naValue", () => {
    const a = parent.transformed("x", "auto", NUMERIC_ONLY, config("log10"));
    const b = parent.transformed("x", "auto", NUMERIC_ONLY, config("sqrt"));
    const c = parent.transformed(
      "x",
      "auto",
      NUMERIC_ONLY,
      config("log10", { sourceLimits: [1, 50] }),
    );
    const d = parent.transformed(
      "x",
      "auto",
      NUMERIC_ONLY,
      config("log10", { sourceLimits: [1, 50], oob: "squish" }),
    );
    const e = parent.transformed("x", "auto", NUMERIC_ONLY, config("log10", { naValue: 1 }));
    const keys = [a, b, c, d, e].map((v) => v.transformKey);
    expect(new Set(keys).size).toBe(5);
    expect(a).not.toBe(b);
  });

  it("identity with no OOB/NA aliases the semantic array (no copy, no kernel run)", () => {
    resetColumnTransformRunCount();
    const parsed = parent.parsed("x", "auto", NUMERIC_ONLY);
    const view = parent.transformed("x", "auto", NUMERIC_ONLY, config("identity"));
    expect(view.transformed).toBe(parsed.semantic);
    expect(view.valid).toBe(parsed.valid);
    expect(columnTransformRunCount()).toBe(0);
  });

  it("censors values outside explicit source limits before transform", () => {
    const view = parent.transformed(
      "x",
      "auto",
      NUMERIC_ONLY,
      config("log10", { sourceLimits: [10, 50] }),
    );
    // x = 1..100; below 10 -> {1..9} (9), above 50 -> {51..100} (50)
    expect(view.censored).toBe(59);
    expect(view.valid[0]).toBe(0); // x = 1 censored
    expect(view.valid[9]).toBe(1); // x = 10 kept
    expect(view.transformed[9]!).toBeCloseTo(1, 12); // log10(10)
  });

  it("squishes to the nearest limit before transform", () => {
    const view = parent.transformed(
      "x",
      "auto",
      NUMERIC_ONLY,
      config("log10", { sourceLimits: [10, 50], oob: "squish" }),
    );
    expect(view.squished).toBe(59);
    expect(view.transformed[0]!).toBeCloseTo(1, 12); // x=1 clamped to 10 -> log10(10)=1
    expect(view.transformed[99]!).toBeCloseTo(Math.log10(50), 12); // x=100 clamped to 50
  });

  it("does not mutate the source column or parsed view", () => {
    const parsed = parent.parsed("x", "auto", NUMERIC_ONLY);
    const before = Array.from(parsed.semantic);
    parent.transformed("x", "auto", NUMERIC_ONLY, config("sqrt", { naValue: 2 }));
    expect(Array.from(parsed.semantic)).toEqual(before);
    expect(parent.column("x")[0]).toBe(1);
  });
});

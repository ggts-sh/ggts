/** Layer and scale lint behavior. Node-link matching: lint-node-link.test.ts. */
import { describe, expect, it } from "bun:test";

import { lintSpec, type SpecAdvisory } from "../src/lint.ts";

const codesOf = (advisories: SpecAdvisory[]) => advisories.map((a) => a.code);

describe("line-over-nominal-x", () => {
  const spec = (x: unknown[]) => ({
    data: { columns: { x, y: [1, 2, 3] } },
    aes: { x: { field: "x" }, y: { field: "y" } },
    layers: [{ geom: "line" }],
  });

  it("fires on nominal x", () => {
    const advisories = lintSpec(spec(["cat", "dog", "bird"]));
    expect(codesOf(advisories)).toContain("line-over-nominal-x");
    expect(advisories[0]!.path).toBe("/layers/0/aes/x");
    expect(advisories[0]!.suggestion?.example).toEqual({ geom: "col" });
  });

  it("silent on quantitative or temporal x", () => {
    expect(lintSpec(spec([1, 2, 3]))).toEqual([]);
    expect(lintSpec(spec(["2024-01-01", "2024-01-02", "2024-01-03"]))).toEqual([]);
  });

  it("fires from a DataProfile too, and respects ordinal as ordered", () => {
    const bare = {
      aes: { x: { field: "grade" }, y: { field: "n" } },
      layers: [{ geom: "line" }],
    };
    const nominal = lintSpec(bare, {
      profile: {
        fields: [
          { name: "grade", type: "nominal" },
          { name: "n", type: "quantitative" },
        ],
      },
    });
    expect(codesOf(nominal)).toContain("line-over-nominal-x");
    const ordinal = lintSpec(bare, {
      profile: {
        fields: [
          { name: "grade", type: "ordinal" },
          { name: "n", type: "quantitative" },
        ],
      },
    });
    expect(ordinal).toEqual([]);
  });

  it("skips without evidence (no data, no profile)", () => {
    expect(
      lintSpec({ aes: { x: { field: "x" }, y: { field: "y" } }, layers: [{ geom: "line" }] }),
    ).toEqual([]);
  });
});

describe("discrete-discrete-scatter", () => {
  const spec = (position?: string) => ({
    data: { columns: { a: ["x", "y", "x"], b: ["u", "u", "v"] } },
    aes: { x: { field: "a" }, y: { field: "b" } },
    layers: [{ geom: "point", ...(position !== undefined && { position }) }],
  });

  it("fires on discrete×discrete points and suggests jitter", () => {
    const advisories = lintSpec(spec());
    expect(codesOf(advisories)).toContain("discrete-discrete-scatter");
    expect(advisories[0]!.suggestion?.example).toEqual({ geom: "point", position: "jitter" });
  });

  it("silent when already jittered, or when one axis is continuous", () => {
    expect(lintSpec(spec("jitter"))).toEqual([]);
    const continuous = {
      data: { columns: { a: ["x", "y", "x"], b: [1, 2, 3] } },
      aes: { x: { field: "a" }, y: { field: "b" } },
      layers: [{ geom: "point" }],
    };
    expect(lintSpec(continuous)).toEqual([]);
  });
});

describe("stacked-area-negative", () => {
  const spec = (y: number[], position?: string) => ({
    data: { columns: { x: [1, 2, 3], y, g: ["a", "b", "a"] } },
    aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "g" } },
    layers: [{ geom: "area", ...(position !== undefined && { position }) }],
  });

  it("fires on stacked (default) and fill positions with negative y", () => {
    expect(codesOf(lintSpec(spec([1, -2, 3])))).toContain("stacked-area-negative");
    expect(codesOf(lintSpec(spec([1, -2, 3], "fill")))).toContain("stacked-area-negative");
  });

  it("silent for identity position or all-positive y", () => {
    expect(lintSpec(spec([1, -2, 3], "identity"))).toEqual([]);
    expect(lintSpec(spec([1, 2, 3]))).toEqual([]);
  });

  /**
   * Characterization for negative-scan memoization: layers sharing a y field
   * must still emit one advisory per layer path, while the column is scanned
   * once underneath (same contract as distinctNonNullByField above).
   */
  it("emits per-layer advisories when stacked layers share a negative y field", () => {
    const advisories = lintSpec({
      data: { columns: { x: [1, 2, 3], y: [1, -2, 3], g: ["a", "b", "a"] } },
      aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "g" } },
      layers: [{ geom: "area" }, { geom: "area", position: "fill" }],
    }).filter((a) => a.code === "stacked-area-negative");
    expect(advisories.map((a) => a.path)).toEqual(["/layers/0/aes/y", "/layers/1/aes/y"]);
  });

  it("silent when stacked layers share an all-positive y field", () => {
    // Worst case for the scan (no early exit): must stay silent across layers.
    const advisories = lintSpec({
      data: { columns: { x: [1, 2, 3], y: [1, 2, 3], g: ["a", "b", "a"] } },
      aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "g" } },
      layers: [{ geom: "area" }, { geom: "area", position: "fill" }],
    });
    expect(advisories).toEqual([]);
  });

  it("keeps per-field results independent across layers with different y fields", () => {
    const advisories = lintSpec({
      data: {
        columns: { x: [1, 2, 3], neg: [1, -2, 3], pos: [1, 2, 3], g: ["a", "b", "a"] },
      },
      aes: { x: { field: "x" }, fill: { field: "g" } },
      layers: [
        { geom: "area", aes: { y: { field: "neg" } } },
        { geom: "area", aes: { y: { field: "pos" } } },
      ],
    }).filter((a) => a.code === "stacked-area-negative");
    expect(advisories.map((a) => a.path)).toEqual(["/layers/0/aes/y"]);
    expect(advisories[0]!.message).toContain('"neg"');
  });

  it("uses plot-level evidence even when a layer carries its own same-named column", () => {
    // Lint evidence is one plot-level map per pass (validate.ts shares
    // layerResolved.plot only), so a layer's own data never feeds this rule.
    // The per-field memo in collectLayerLintAdvisories depends on exactly this
    // contract; if lint gains layer-scoped evidence, this test must change
    // along with the memo key.
    const advisories = lintSpec({
      data: { columns: { x: [1, 2, 3], y: [1, 2, 3], g: ["a", "b", "a"] } },
      aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "g" } },
      layers: [{ geom: "area", data: { columns: { y: [-1, -2, -3] } } }],
    });
    expect(advisories).toEqual([]);
  });

  it("fires only on the stacked layer when an identity layer shares the negative field", () => {
    const advisories = lintSpec({
      data: { columns: { x: [1, 2, 3], y: [1, -2, 3], g: ["a", "b", "a"] } },
      aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "g" } },
      layers: [{ geom: "area", position: "identity" }, { geom: "area" }],
    }).filter((a) => a.code === "stacked-area-negative");
    expect(advisories.map((a) => a.path)).toEqual(["/layers/1/aes/y"]);
  });
});

describe("many-discrete-colors", () => {
  const categories = (n: number) => Array.from({ length: n }, (_, i) => `cat-${i}`);
  const spec = (n: number) => ({
    data: { columns: { x: categories(n).map((_, i) => i), g: categories(n) } },
    aes: { x: { field: "x" }, y: { field: "x" }, color: { field: "g" } },
    layers: [{ geom: "point" }],
  });

  it("fires above 10 distinct values with a facet suggestion", () => {
    const advisories = lintSpec(spec(11));
    expect(codesOf(advisories)).toContain("many-discrete-colors");
    expect(advisories[0]!.message).toContain("11 distinct");
    expect(advisories[0]!.suggestion?.example).toEqual({ facet: { wrap: { field: "g" } } });
  });

  it("silent at exactly 10", () => {
    expect(lintSpec(spec(10))).toEqual([]);
  });

  /**
   * Characterization for distinct-count memoization: shared fields must still
   * emit one advisory per layer/channel path with the same count, while the
   * column is scanned once underneath.
   */
  it("emits per-layer advisories for a shared high-cardinality color field", () => {
    const g = categories(12);
    const advisories = lintSpec({
      data: { columns: { x: g.map((_, i) => i), g } },
      aes: { x: { field: "x" }, y: { field: "x" }, color: { field: "g" } },
      layers: [{ geom: "point" }, { geom: "line" }],
    }).filter((a) => a.code === "many-discrete-colors");
    expect(advisories).toHaveLength(2);
    expect(advisories.map((a) => a.path)).toEqual(["/layers/0/aes/color", "/layers/1/aes/color"]);
    expect(advisories.every((a) => a.message.includes("12 distinct"))).toBe(true);
  });

  it("reuses plot-aes color and still fires for color and fill on the same field", () => {
    const g = categories(15);
    const advisories = lintSpec({
      data: { columns: { x: g.map((_, i) => i), g } },
      aes: { x: { field: "x" }, y: { field: "x" }, color: { field: "g" }, fill: { field: "g" } },
      layers: [{ geom: "point" }, { geom: "col", aes: { x: { field: "x" }, y: { field: "x" } } }],
    }).filter((a) => a.code === "many-discrete-colors");
    // Two layers × color (inherited) + fill (plot aes) on first layer only when
    // fill is mapped: point and col both inherit color; both inherit fill.
    expect(advisories.length).toBeGreaterThanOrEqual(2);
    expect(advisories.every((a) => a.message.includes("15 distinct"))).toBe(true);
    expect(advisories.some((a) => a.path.endsWith("/color"))).toBe(true);
    expect(advisories.some((a) => a.path.endsWith("/fill"))).toBe(true);
  });
});

describe("transform-domain-data", () => {
  const spec = (y: number[], scaleY: Record<string, unknown>) => ({
    data: { columns: { x: y.map((_, i) => i + 1), y } },
    aes: { x: { field: "x" }, y: { field: "y" } },
    layers: [{ geom: "point" }],
    scales: { y: scaleY },
  });

  it("fires on mixed-sign data under an authored type:log scale (pre-normalization)", () => {
    const advisories = lintSpec(spec([5, -1, 0, 10], { type: "log" }));
    expect(codesOf(advisories)).toContain("transform-domain-data");
    expect(advisories[0]!.path).toBe("/scales/y");
    // log10 rejects <= 0: both -1 and 0 are out of the transform domain.
    expect(advisories[0]!.message).toContain("2");
  });

  it("fires on canonical transform:log10 (type:linear) with mixed-sign data", () => {
    const advisories = lintSpec(spec([5, -1, 0, 10], { type: "linear", transform: "log10" }));
    expect(codesOf(advisories)).toContain("transform-domain-data");
  });

  it("fires on transform:sqrt when data mixes negative and non-negative values", () => {
    // sqrt rejects < 0 only: 0 is a valid sqrt input, -4 is not.
    const advisories = lintSpec(spec([4, -4, 0, 9], { type: "linear", transform: "sqrt" }));
    expect(codesOf(advisories)).toContain("transform-domain-data");
    expect(advisories[0]!.message).toContain("1");
  });

  it("silent for all-in-domain data or an untransformed scale", () => {
    expect(lintSpec(spec([1, 2, 3], { type: "log" }))).toEqual([]);
    // sqrt: zero is valid, so all-non-negative is silent.
    expect(lintSpec(spec([0, 4, 9], { type: "linear", transform: "sqrt" }))).toEqual([]);
    expect(lintSpec(spec([5, -1, 10], { type: "linear" }))).toEqual([]);
    // all-invalid (no positive companion) is the pipeline's error/warning, not
    // this mixed-data advisory.
    expect(lintSpec(spec([-1, -2, 0], { type: "log" }))).toEqual([]);
  });

  /**
   * Characterization for field-scan memoization (#425): multi-layer reuse of
   * the same mapped field under a transform scale must keep one advisory per
   * axis with stable counts, including plot-aes inheritance.
   */
  it("emits one advisory with stable counts when multiple layers share a mixed field", () => {
    const advisories = lintSpec({
      data: { columns: { x: [1, 2, 3, 4], y: [5, -1, 0, 10] } },
      aes: { x: { field: "x" }, y: { field: "y" } },
      scales: { y: { type: "log" } },
      layers: [{ geom: "point" }, { geom: "line" }, { geom: "smooth" }],
    });
    expect(codesOf(advisories)).toEqual(["transform-domain-data"]);
    expect(advisories[0]!.path).toBe("/scales/y");
    // log10: -1 and 0 out of domain; 5 and 10 in domain.
    expect(advisories[0]!.message).toContain("2 value(s) outside");
    expect(advisories[0]!.message).toContain("2 valid");
  });

  it("reuses plot-level aes y across layers when scanning transform domain", () => {
    const advisories = lintSpec({
      data: { columns: { x: [1, 2, 3], y: [4, -4, 9] } },
      aes: { x: { field: "x" }, y: { field: "y" } },
      scales: { y: { type: "linear", transform: "sqrt" } },
      // Layer aes omit y so effectiveChannel falls back to plot aes.
      layers: [{ geom: "point" }, { geom: "line", aes: { x: { field: "x" } } }],
    });
    expect(codesOf(advisories)).toEqual(["transform-domain-data"]);
    expect(advisories[0]!.message).toContain('field "y"');
    expect(advisories[0]!.message).toContain("1 value(s) outside");
  });

  it("keeps first-hit field ordering when an earlier mixed field wins", () => {
    const advisories = lintSpec({
      data: {
        columns: {
          early: [5, -1, 10],
          late: [1, -2, 3],
          x: [1, 2, 3],
        },
      },
      scales: { y: { type: "log" } },
      layers: [
        { geom: "point", aes: { x: { field: "x" }, y: { field: "early" } } },
        { geom: "line", aes: { x: { field: "x" }, y: { field: "late" } } },
      ],
    });
    expect(codesOf(advisories)).toEqual(["transform-domain-data"]);
    // First mixed field encountered is "early" (1 out of domain: -1).
    expect(advisories[0]!.message).toContain('field "early"');
    expect(advisories[0]!.message).toContain("1 value(s) outside");
    expect(advisories[0]!.message).not.toContain('field "late"');
  });
});

describe("fractional-calendar-years", () => {
  /** Nightingale-style year + month/12 (Apr 1854 … Mar 1856). */
  const nightingaleMonths = (): number[] => {
    const out: number[] = [];
    // Apr 1854 = month index 3 → 1854 + 3/12
    for (let i = 0; i < 24; i++) {
      const monthIndex = 3 + i; // 0-based from Jan 1854
      const year = 1854 + Math.floor(monthIndex / 12);
      const m = monthIndex % 12;
      out.push(year + m / 12);
    }
    return out;
  };

  const areaSpec = (x: number[], scales?: Record<string, unknown>) => ({
    data: {
      columns: {
        x,
        y: x.map((_, i) => (i % 3) + 1),
        g: x.map((_, i) => ["Disease", "Wounds", "Other"][i % 3]!),
      },
    },
    aes: { x: { field: "x" }, y: { field: "y" }, fill: { field: "g" } },
    layers: [{ geom: "area" }],
    ...(scales !== undefined && { scales }),
  });

  it("fires on year+month/12 linear coordinates (the Nightingale pitfall)", () => {
    const advisories = lintSpec(areaSpec(nightingaleMonths()));
    expect(codesOf(advisories)).toContain("fractional-calendar-years");
    const hit = advisories.find((a) => a.code === "fractional-calendar-years")!;
    expect(hit.path).toBe("/aes/x");
    expect(hit.message).toMatch(/month/i);
    expect(hit.message).toMatch(/185\d/);
    expect(hit.suggestion?.example).toEqual({
      scales: { x: { type: "time", labels: "%b %Y" } },
    });
  });

  it("fires when an explicit linear scale is present (not only default)", () => {
    const advisories = lintSpec(
      areaSpec(nightingaleMonths(), { x: { type: "linear", nice: false } }),
    );
    expect(codesOf(advisories)).toContain("fractional-calendar-years");
  });

  it("silent for integer annual years (legitimate linear year series)", () => {
    const years = Array.from({ length: 20 }, (_, i) => 1855 + i);
    expect(lintSpec(areaSpec(years)).filter((a) => a.code === "fractional-calendar-years")).toEqual(
      [],
    );
  });

  it("silent for ordinary quantitative ranges (not year-like)", () => {
    expect(
      lintSpec(areaSpec([0.25, 0.5, 0.75, 1, 1.25, 1.5])).filter(
        (a) => a.code === "fractional-calendar-years",
      ),
    ).toEqual([]);
    expect(
      lintSpec(areaSpec([10.1, 10.2, 10.3, 10.4, 11.1, 11.2])).filter(
        (a) => a.code === "fractional-calendar-years",
      ),
    ).toEqual([]);
  });

  it("silent when the axis is already a time or band scale", () => {
    // Fractional numbers on a time scale are a separate validation problem;
    // this lint targets the silent linear path only.
    expect(
      lintSpec(areaSpec(nightingaleMonths(), { x: { type: "time" } })).filter(
        (a) => a.code === "fractional-calendar-years",
      ),
    ).toEqual([]);
    expect(
      lintSpec(areaSpec(nightingaleMonths(), { x: { type: "band" } })).filter(
        (a) => a.code === "fractional-calendar-years",
      ),
    ).toEqual([]);
  });

  it("silent without inline values (profile-only evidence)", () => {
    const advisories = lintSpec(
      {
        aes: { x: { field: "year" }, y: { field: "rate" } },
        layers: [{ geom: "area" }],
      },
      {
        profile: {
          fields: [
            { name: "year", type: "quantitative" },
            { name: "rate", type: "quantitative" },
          ],
        },
      },
    );
    expect(advisories.filter((a) => a.code === "fractional-calendar-years")).toEqual([]);
  });

  it("silent for day-of-year style fractions that miss the month grid", () => {
    // Continuous within-year fractions not snapped to k/12 (e.g. day/365).
    const days = Array.from({ length: 24 }, (_, i) => 1855 + (i * 15) / 365);
    expect(lintSpec(areaSpec(days)).filter((a) => a.code === "fractional-calendar-years")).toEqual(
      [],
    );
  });

  it("silent for ordinary 1000–9999 measures quantized to quarters/halves", () => {
    // Devin FP: .25/.5/.75 are exactly 3/12, 6/12, 9/12 — not enough months.
    const prices = [1000.5, 2500.25, 3000.75, 4000.5, 5000.25, 6000.5];
    expect(
      lintSpec(areaSpec(prices)).filter((a) => a.code === "fractional-calendar-years"),
    ).toEqual([]);
  });

  it("silent when only a few year-like values sit inside a non-year column", () => {
    const mixed = [...Array.from({ length: 40 }, (_, i) => i + 0.5), 1854.25, 1854.333, 1854.5];
    expect(lintSpec(areaSpec(mixed)).filter((a) => a.code === "fractional-calendar-years")).toEqual(
      [],
    );
  });

  it("silent for fractional years mapped on y (rule is x-only)", () => {
    const months = nightingaleMonths();
    const advisories = lintSpec({
      data: { columns: { x: months.map((_, i) => i), y: months } },
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [{ geom: "line" }],
    }).filter((a) => a.code === "fractional-calendar-years");
    expect(advisories).toEqual([]);
  });

  it("emits one advisory when multiple layers share the field", () => {
    const x = nightingaleMonths();
    const advisories = lintSpec({
      data: { columns: { x, y: x.map(() => 1) } },
      aes: { x: { field: "x" }, y: { field: "y" } },
      layers: [{ geom: "area" }, { geom: "line" }],
    }).filter((a) => a.code === "fractional-calendar-years");
    expect(advisories).toHaveLength(1);
    expect(advisories[0]!.path).toBe("/aes/x");
  });
});

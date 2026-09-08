/**
 * M1 scales config surface and pin/suspend/restore stability.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg } from "@ggts-sh/spec";
import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import type { RectsBatch } from "../../src/scene.ts";
import { salesRows, size } from "./fixtures.ts";

describe("scales config surface", () => {
  const rows = [
    { t: "2026-01-05", v: 3 },
    { t: "2026-03-20", v: 700 },
  ];

  it("time x scale: calendar ticks with default multi-scale labels", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "t", y: "v" }))
        .geomPoint()
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time"); // inferred from ISO strings
    const labels = model.scene.axes.x.ticks.map((t) => t.label);
    expect(labels.length).toBeGreaterThan(1);
    // ~2.5-month same-year span -> span-uniform month+day labels (#962).
    expect(labels).toContain("Feb 2");
    expect(labels.every((label) => !/^\d+$/.test(label))).toBe(true);
    expect(labels.every((label) => /^\w+ \d+$/.test(label))).toBe(true);
  });

  it("labels format strings apply (time pattern + numeric format)", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "t", y: "v" }))
        .geomPoint()
        .scales({ x: { labels: "%Y-%m" }, y: { type: "log" } })
        .spec(),
      size,
    );
    expect(model.scene.axes.x.ticks.every((t) => /^\d{4}-\d{2}$/.test(t.label))).toBe(true);
    // type "log" canonicalizes to the linear family + log10 transform; decade
    // ticks/formatting still key from the transform.
    expect(model.scales.y.type).toBe("linear");
    if (model.scales.y.type !== "band") expect(model.scales.y.transform).toBe("log10");
    const yLabels = model.scene.axes.y.ticks.map((t) => t.label);
    expect(yLabels).toContain("10");
    expect(yLabels).toContain("100");
  });

  it("explicit breaks override tick derivation", () => {
    const model = runPipeline(
      gg(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales({ x: { breaks: [1, 4, 9] } })
        .spec(),
      size,
    );
    expect(model.scene.axes.x.ticks.map((t) => t.label)).toEqual(["1", "4", "9"]);
  });

  it("pinned band domains drop out-of-domain rows with a warning", () => {
    const model = runPipeline(
      gg(salesRows, aes({ x: "city", y: "sales" }))
        .geomCol()
        .scales({ x: { domain: ["Berlin"] } })
        .spec(),
      size,
    );
    const batch = model.scene.batches[0] as RectsBatch;
    expect(batch.rects.length / 4).toBe(2); // Berlin keeps web+store; Oslo drops
    expect(model.warnings.some((w) => w.code === "removed-missing")).toBe(true);
  });

  it("log y with non-positive data warns and drops", () => {
    const model = runPipeline(
      gg(
        [
          { x: 1, y: 0 },
          { x: 2, y: 10 },
          { x: 3, y: 100 },
        ],
        aes({ x: "x", y: "y" }),
      )
        .geomPoint()
        .scales({ y: { type: "log" } })
        .spec(),
      size,
    );
    // Non-positive values are dropped pre-stat by the log10 column transform and
    // surfaced as scale-transform-domain (log-nonpositive is retired).
    expect(model.warnings.some((w) => w.code === "scale-transform-domain")).toBe(true);
    expect(model.warnings.some((w) => w.code === "removed-missing")).toBe(true);
  });

  it("no scale-type advisory when the type is explicit", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "t", y: "v" }))
        .geomPoint()
        .scales({ x: { type: "time" }, y: { type: "linear" } })
        .spec(),
      size,
    );
    expect(model.advisories.some((a) => a.code === "scale-type-inferred")).toBe(false);
  });
});

describe("scale stability through the spec config (pinned/suspend/restore)", () => {
  const spec = (colorConfig?: import("@ggts-sh/spec").ColorScaleSpec) => {
    let b = gg(salesRows, aes({ x: "city", y: "sales", fill: "kind" })).geomCol();
    if (colorConfig) b = b.scales({ fill: colorConfig });
    return b.spec();
  };
  const fillOf = (model: ReturnType<typeof runPipeline>, value: string) => {
    const resolved = model.scales.fill;
    if (resolved?.kind !== "ordinal") throw new Error("expected ordinal fill scale");
    return resolved.scale.colorOf(value);
  };

  it("an explicit domain PINS assignments and SUSPENDS (not discards) stored state", () => {
    // 1. grow mode: web=palette[0], store=palette[1]
    const grown = runPipeline(spec(), size);
    const webColor = fillOf(grown, "web")!;
    const storeColor = fillOf(grown, "store")!;

    // 2. pin an explicit domain that REVERSES the order: colors follow the
    //    domain positions, and out-of-domain values map to unknown
    const pinned = runPipeline(spec({ domain: ["store", "web"] }), {
      ...size,
      prevScales: grown.scales.state,
    });
    expect(fillOf(pinned, "store")).toBe(webColor); // domain position 0
    expect(fillOf(pinned, "web")).toBe(storeColor);
    // stored assignments SUSPENDED, not discarded: state passes through
    expect(pinned.scales.state["fill"]).toEqual(grown.scales.state["fill"]);

    // 3. removing the explicit domain RESTORES the stored assignments
    const restored = runPipeline(spec(), { ...size, prevScales: pinned.scales.state });
    expect(fillOf(restored, "web")).toBe(webColor);
    expect(fillOf(restored, "store")).toBe(storeColor);
  });

  it("out-of-domain values warn and render the unknown color", () => {
    const model = runPipeline(spec({ domain: ["web"] }), size);
    expect(model.warnings.some((w) => w.code === "out-of-domain")).toBe(true);
    expect(fillOf(model, "store")).toBeUndefined();
  });

  it("onExhaust: 'error' throws a structured error beyond the palette", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      city: "X",
      kind: `k${i}`,
      sales: i + 1,
    }));
    const throwing = gg(many, aes({ x: "city", y: "sales", fill: "kind" }))
      .geomCol()
      .scales({ fill: { onExhaust: "error" } })
      .spec();
    try {
      runPipeline(throwing, size);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as PipelineError).code).toBe("palette-exhausted");
    }
    // default: cycle + one-time warning
    const cycling = runPipeline(
      gg(many, aes({ x: "city", y: "sales", fill: "kind" }))
        .geomCol()
        .spec(),
      size,
    );
    expect(cycling.warnings.some((w) => w.code === "palette-exhausted")).toBe(true);
  });

  it("domainMode 'data' opts into legacy rebuild-per-render", () => {
    const first = runPipeline(spec({ domainMode: "data" }), size);
    const webColor = fillOf(first, "web");
    // remove "web": in data mode "store" gets recolored to palette[0]
    const storeOnly = gg(
      salesRows.filter((r) => r.kind === "store"),
      aes({ x: "city", y: "sales", fill: "kind" }),
    )
      .geomCol()
      .scales({ fill: { domainMode: "data" } })
      .spec();
    const second = runPipeline(storeOnly, { ...size, prevScales: first.scales.state });
    expect(fillOf(second, "store")).toBe(webColor);
  });
});

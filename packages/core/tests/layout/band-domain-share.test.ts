/**
 * Facet band guide plans should reuse a frozen scale.rawDomain for the
 * `domain` field instead of allocating a fresh copy per panel (#1340).
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { planBasicAxis } from "../../src/layout/basic-axis.ts";
import { runPipeline } from "../../src/pipeline.ts";
import { trainBand, trainContinuous } from "../../src/scales/train.ts";

const size = { width: 640, height: 400 };

describe("planBasicAxis band domain reuse (#1340)", () => {
  it("reuses frozen scale.rawDomain by reference", () => {
    const scale = trainBand([["a", "b", "c"]]);
    expect(Object.isFrozen(scale.rawDomain)).toBe(true);
    const plan = planBasicAxis({
      aesthetic: "x",
      panelIndex: 0,
      scale,
      ticks: scale.domain.map((value, domainIndex) => ({
        value: domainIndex,
        label: value,
        labeled: true,
        domainIndex,
      })),
      config: undefined,
    });
    expect(plan.domain).toBe(scale.rawDomain);
    expect(Object.isFrozen(plan.domain)).toBe(true);
    expect(plan.domain).toEqual(["a", "b", "c"]);
  });

  it("freezes a copy when rawDomain is not already frozen", () => {
    const scale = trainBand([["a", "b"]]);
    const mutableRaw = ["x", "y"] as unknown[];
    const patched = { ...scale, rawDomain: mutableRaw as readonly unknown[] };
    const plan = planBasicAxis({
      aesthetic: "x",
      panelIndex: 0,
      scale: patched,
      ticks: [
        { value: 0, label: "x", labeled: true, domainIndex: 0 },
        { value: 1, label: "y", labeled: true, domainIndex: 1 },
      ],
      config: undefined,
    });
    expect(plan.domain).not.toBe(mutableRaw);
    expect(Object.isFrozen(plan.domain)).toBe(true);
    expect(plan.domain).toEqual(["x", "y"]);
  });

  it("keeps a two-element frozen domain for continuous axes", () => {
    const { scale } = trainContinuous([Float64Array.of(0, 10)], { type: "linear" });
    const plan = planBasicAxis({
      aesthetic: "y",
      panelIndex: 0,
      scale,
      ticks: [
        { value: 0, label: "0", labeled: true },
        { value: 10, label: "10", labeled: true },
      ],
      config: undefined,
    });
    expect(plan.domain).toHaveLength(2);
    expect(plan.domain).toEqual([scale.domain[0], scale.domain[1]]);
    expect(Object.isFrozen(plan.domain)).toBe(true);
  });
});

describe("facet band guide domain sharing (#1340)", () => {
  const rows = [
    { cat: "a", y: 1, g: "p1" },
    { cat: "b", y: 2, g: "p1" },
    { cat: "a", y: 3, g: "p2" },
    { cat: "b", y: 4, g: "p2" },
    { cat: "c", y: 5, g: "p2" },
  ];

  it("fixed facet scales share one band domain array across panels", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "cat", y: "y" }))
        .geomCol()
        .facet({ wrap: "g" })
        .spec(),
      size,
    );
    const bandPlans = model.guidePlans.filter(
      (plan) => plan.type === "axis" && plan.scaleType === "band" && plan.aesthetic === "x",
    );
    expect(bandPlans.length).toBeGreaterThan(1);
    const first = bandPlans[0]!.domain;
    expect(Object.isFrozen(first)).toBe(true);
    for (const plan of bandPlans) {
      expect(plan.domain).toBe(first);
      expect(plan.domain).toEqual(first);
    }
    // Shared object is the trained scale rawDomain.
    expect(model.scales.x.type).toBe("band");
    if (model.scales.x.type === "band") {
      expect(first).toBe(model.scales.x.rawDomain);
    }
  });

  it("free-x facet scales keep distinct domain arrays per panel", () => {
    const model = runPipeline(
      gg(rows, aes({ x: "cat", y: "y" }))
        .geomCol()
        .facet({ wrap: "g", scales: "free_x" })
        .spec(),
      size,
    );
    const bandPlans = model.guidePlans.filter(
      (plan) => plan.type === "axis" && plan.scaleType === "band" && plan.aesthetic === "x",
    );
    expect(bandPlans.length).toBeGreaterThan(1);
    // p1 has {a,b}, p2 has {a,b,c} under free_x — contents differ; objects must too.
    const domains = bandPlans.map((plan) => plan.domain);
    for (const domain of domains) {
      expect(Object.isFrozen(domain)).toBe(true);
    }
    // At least one pair of panels should not share the same array object.
    const distinct = new Set(domains);
    expect(distinct.size).toBe(domains.length);
  });
});

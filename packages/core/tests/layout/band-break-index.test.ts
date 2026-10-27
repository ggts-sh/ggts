/**
 * Band break → domainIndex resolution: encodeKey map O(D+K), first-occurrence,
 * signed zero / typed identity (trainBand parity).
 */
import { describe, expect, it } from "bun:test";

import {
  deriveTicks,
  firstDomainIndexByEncodeKey,
  type DeriveTicksContext,
} from "../../src/layout/layout-derive-ticks.ts";
import type { Domain } from "../../src/layout/layout-types.ts";
import { MetricsTableMeasurer } from "../../src/layout/measure.ts";
import { FONT_METRICS } from "../../src/layout/font-metrics.ts";
import { layoutDomain } from "../../src/pipeline/layout-helpers.ts";
import { trainBand } from "../../src/scales/train.ts";

const measurer = new MetricsTableMeasurer(FONT_METRICS);

function verticalCtx(extentPx = 400): DeriveTicksContext {
  return {
    orient: "vertical",
    extentPx,
    measurer,
    fontSize: 11,
    marginCapPx: 80,
  };
}

function horizontalCtx(extentPx = 400): DeriveTicksContext {
  return {
    orient: "horizontal",
    extentPx,
    measurer,
    fontSize: 11,
    marginCapPx: 80,
    orthogonalMarginCapPx: 80,
    orthogonalChromePx: 10,
  };
}

describe("firstDomainIndexByEncodeKey", () => {
  it("returns first occurrence for encodeKey identity", () => {
    const lookup = firstDomainIndexByEncodeKey([1, "1", 1, true]);
    expect(lookup(1)).toBe(0);
    expect(lookup("1")).toBe(1);
    expect(lookup(true)).toBe(3);
    expect(lookup(false)).toBe(-1);
  });

  it("keeps signed zero distinct (trainBand encodeKey)", () => {
    const lookup = firstDomainIndexByEncodeKey([0, -0, 1]);
    expect(lookup(0)).toBe(0);
    expect(lookup(-0)).toBe(1);
  });

  it("treats NaN as a single key", () => {
    const lookup = firstDomainIndexByEncodeKey([Number.NaN, 1, Number.NaN]);
    expect(lookup(Number.NaN)).toBe(0);
  });

  it("indexes each rawCategories element at most once (O(D) build)", () => {
    const D = 4_000;
    const raw = Array.from({ length: D }, (_, i) => `cat-${i}`);
    let reads = 0;
    const proxied = new Proxy(raw, {
      get(target, property, receiver): unknown {
        if (typeof property === "string" && /^\d+$/.test(property)) reads++;
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    const lookup = firstDomainIndexByEncodeKey(proxied);
    expect(reads).toBe(D);
    // Lookups must not re-scan rawCategories.
    reads = 0;
    for (let k = 0; k < 200; k++) expect(lookup(`cat-${k * 10}`)).toBe(k * 10);
    expect(reads).toBe(0);
  });
});

describe("deriveTicks band breaks via encodeKey map", () => {
  it("resolves reordered / subset breaks to first domainIndex (legacy vertical)", () => {
    const domain: Domain = {
      type: "band",
      categories: ["a", "b", "c", "d"],
      rawCategories: ["a", "b", "c", "d"],
      breaks: ["c", "a", "missing"],
    };
    const { ticks } = deriveTicks(domain, 4, undefined, 1, verticalCtx());
    expect(ticks.map((t) => ({ value: t.value, domainIndex: t.domainIndex }))).toEqual([
      { value: "c", domainIndex: 2 },
      { value: "a", domainIndex: 0 },
    ]);
  });

  it('resolves signed-zero and typed 1/"1" breaks on measured horizontal path', () => {
    const domain: Domain = {
      type: "band",
      categories: ["0", "-0", "1", "1"], // presentation labels (bandKey)
      rawCategories: [0, -0, 1, "1"],
      breaks: [-0, "1", 0, 1],
      band: {
        aesthetic: "x",
        panelIndex: 0,
        config: {},
      },
    };
    // categories length must match raw for planner; labels are bandKey form
    domain.categories = domain.rawCategories!.map((v) => (Object.is(v, -0) ? "-0" : String(v)));
    const { ticks, empty } = deriveTicks(domain, 4, undefined, 1, horizontalCtx(600));
    expect(empty).toBe(false);
    const byValue = new Map(ticks.map((t) => [t.domainIndex, t.value]));
    // domainIndex points into rawCategories first occurrence
    expect(byValue.get(1)).toBe(-0); // break -0
    expect(byValue.get(3)).toBe("1");
    expect(byValue.get(0)).toBe(0);
    expect(byValue.get(2)).toBe(1);
  });

  it("break resolution does not re-scan rawCategories per break (O(D+K) reads)", () => {
    const D = 3_000;
    const K = 300;
    const raw = Array.from({ length: D }, (_, i) => i);
    const breaks = Array.from({ length: K }, (_, i) => i * 10);
    let reads = 0;
    const rawCategories = new Proxy(raw, {
      get(target, property, receiver): unknown {
        if (typeof property === "string" && /^\d+$/.test(property)) reads++;
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    const domain: Domain = {
      type: "band",
      categories: raw.map(String),
      rawCategories,
      breaks,
    };
    deriveTicks(domain, K, undefined, 1, verticalCtx());
    // Break map plus one frozen guide-plan domain copy: O(D+K), never K·D.
    expect(reads).toBeLessThanOrEqual(2 * D + K);
  });
});

describe("layoutDomain band break dedupe", () => {
  it("keeps first-occurrence order and signed zeros", () => {
    const scale = trainBand([[0, -0, 1, 0]]);
    const domain = layoutDomain(scale, [0, 1, 0, -0, 1]);
    expect(domain.type).toBe("band");
    if (domain.type !== "band") throw new Error("expected band");
    expect(domain.breaks).toEqual([0, 1, -0]);
  });
});

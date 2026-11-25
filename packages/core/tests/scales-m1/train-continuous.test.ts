/**
 * Continuous position scale training (config, transforms, time).
 */
import { describe, expect, it } from "bun:test";

import { ScaleConfigError, trainContinuous } from "../../src/scales/train.ts";
import { scaleTransform } from "../../src/scales/transform.ts";

const DAY = 86_400_000;

describe("trainContinuous — config semantics", () => {
  const data = [Float64Array.from([3, 7, 42])];

  it("nices by default; nice:false keeps the raw extent", () => {
    expect(trainContinuous(data).scale.domain).toEqual([0, 45]);
    expect(trainContinuous(data, { nice: false }).scale.domain).toEqual([3, 42]);
  });

  it("explicit domain pins (nice/zero ignored) and normalizes accordingly", () => {
    const { scale } = trainContinuous(data, { domain: [0, 100], zero: true, nice: true });
    expect(scale.domain).toEqual([0, 100]);
    expect(scale.normalize(50)).toBe(0.5);
  });

  it("zero: true extends the domain to include 0", () => {
    const { scale } = trainContinuous(data, { zero: true, nice: false });
    expect(scale.domain).toEqual([0, 42]);
  });

  it("reverse flips normalize output", () => {
    const { scale } = trainContinuous(data, { domain: [0, 10], reverse: true });
    expect(scale.normalize(0)).toBe(1);
    expect(scale.normalize(10)).toBe(0);
  });

  it("zero-variance domains pad symmetrically (failure policy)", () => {
    const { scale } = trainContinuous([Float64Array.from([5, 5])], { nice: false });
    expect(scale.domain).toEqual([4.5, 5.5]);
  });
});

describe("trainContinuous — transformed-space (log10) training", () => {
  const log10 = scaleTransform("log10");

  it("reads extent evidence only when the domain is inferred", () => {
    const values = Float64Array.of(0, 3);
    const evidence = [values];
    let reads = 0;
    Object.defineProperty(evidence, 0, {
      get() {
        reads++;
        return values;
      },
    });

    const pinned = trainContinuous(evidence, { transform: log10, domain: [1, 100], reverse: true });
    expect(reads).toBe(0);
    expect(pinned.empty).toBe(false);
    expect(pinned.scale.domain).toEqual([1, 100]);
    expect(pinned.scale.evidenceTransformedDomain).toEqual([0, 2]);
    expect(pinned.scale.normalize(1)).toBe(1);
    expect(pinned.scale.invert(0)).toBe(100);

    const inferred = trainContinuous(evidence, { transform: log10, nice: false });
    expect(reads).toBe(1);
    expect(inferred.scale.domain).toEqual([1, 1_000]);
  });

  it("trains affine over transformed evidence and inverse-projects a semantic domain", () => {
    // Evidence is ALREADY transformed (pre-stat log10 of 1,10,100,1000 = 0,1,2,3);
    // the trainer never re-forwards it.
    const training = trainContinuous([Float64Array.from([0, 1, 2, 3])], {
      transform: log10,
      nice: false,
    });
    expect(training.scale.type).toBe("linear");
    expect(training.scale.transform).toBe("log10");
    expect(training.scale.domain).toEqual([1, 1000]);
    // normalize forwards once: normalize(10) = affine(log10(10)=1) = 1/3.
    expect(training.scale.normalize(10)).toBeCloseTo(1 / 3, 12);
    expect(training.scale.normalizeTransformed(1)).toBeCloseTo(1 / 3, 12);
    expect(Number.isNaN(training.scale.normalize(0))).toBe(true);
    expect(Number.isNaN(training.scale.normalize(-5))).toBe(true);
  });

  it("REFUSES an explicit domain outside the transform's valid range", () => {
    expect(() =>
      trainContinuous([Float64Array.from([0, 1])], { transform: log10, domain: [0, 10] }),
    ).toThrow(ScaleConfigError);
    expect(() =>
      trainContinuous([Float64Array.from([0, 1])], { transform: log10, domain: [-1, 10] }),
    ).toThrow(/valid range/);
  });

  it("empty transformed evidence falls back to a default domain", () => {
    const training = trainContinuous([Float64Array.from([])], { transform: log10 });
    expect(training.empty).toBe(true);
    // fallback transformed window [0, 1] inverse-projects to semantic [1, 10].
    expect(training.scale.domain).toEqual([1, 10]);
  });
});

describe("trainContinuous — time scales", () => {
  it("uses the raw extent (never niced) and pads zero-variance by half a day", () => {
    const t0 = Date.UTC(2026, 0, 15);
    const t1 = Date.UTC(2026, 2, 20);
    const { scale } = trainContinuous([Float64Array.from([t0, t1])], { type: "time" });
    expect(scale.domain).toEqual([t0, t1]);
    const single = trainContinuous([Float64Array.from([t0])], { type: "time" });
    expect(single.scale.domain).toEqual([t0 - DAY / 2, t0 + DAY / 2]);
  });
});

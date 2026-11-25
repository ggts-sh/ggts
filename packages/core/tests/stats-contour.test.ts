/**
 * Pure stat_contour marching-squares isolines (#801).
 */
import { describe, expect, it, spyOn } from "bun:test";

import { cellSegments, contourLevels, stitchSegments, statContour } from "../src/stats/contour.ts";

describe("contourLevels", () => {
  it("uses explicit breaks", () => {
    expect(contourLevels(0, 1, { breaks: [0.25, 0.75] })).toEqual([0.25, 0.75]);
  });

  it("spaces bins inclusively from min to max", () => {
    expect(contourLevels(0, 1, { bins: 3 })).toEqual([0, 0.5, 1]);
  });

  it("uses binwidth steps", () => {
    expect(contourLevels(0, 1, { binwidth: 0.5 })).toEqual([0, 0.5, 1]);
  });
});

describe("cellSegments", () => {
  it("cuts the bottom-left corner", () => {
    // SW high, others low → segment bottom-left
    const segs = cellSegments(0, 1, 0, 1, 1, 0, 0, 0, 0.5);
    expect(segs.length).toBe(1);
    const pair = segs[0]!;
    const a = pair[0];
    const b = pair[1];
    expect(a.y).toBeCloseTo(0, 9);
    expect(a.x).toBeCloseTo(0.5, 9);
    expect(b.x).toBeCloseTo(0, 9);
    expect(b.y).toBeCloseTo(0.5, 9);
  });

  it("returns empty when all corners same side", () => {
    expect(cellSegments(0, 1, 0, 1, 0, 0, 0, 0, 0.5)).toEqual([]);
    expect(cellSegments(0, 1, 0, 1, 1, 1, 1, 1, 0.5)).toEqual([]);
  });
});

describe("stitchSegments", () => {
  it("chains collinear segments", () => {
    const lines = stitchSegments([
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    ]);
    expect(lines.length).toBe(1);
    expect(lines[0]!.length).toBe(3);
  });

  it("extends both directions into one polyline", () => {
    // Middle segment first so seed may start mid-chain; must still stitch ends.
    const lines = stitchSegments([
      [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      [
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
    ]);
    expect(lines.length).toBe(1);
    const xs = lines[0]!.map((p) => p.x).toSorted((a, b) => a - b);
    expect(xs).toEqual([0, 1, 2, 3]);
  });

  it("closes a square loop as one polyline", () => {
    const lines = stitchSegments([
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      [
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ],
    ]);
    expect(lines.length).toBe(1);
    // Closed loop: 4 edges → 5 vertices when first point is repeated, or 4 without.
    // Current stitch emits chain length = edges+1 for open; for closed, head meets tail.
    expect(lines[0]!.length).toBeGreaterThanOrEqual(4);
    expect(lines[0]!.length).toBeLessThanOrEqual(5);
  });

  it("keeps multi-component isolines separate", () => {
    const lines = stitchSegments([
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      [
        { x: 10, y: 0 },
        { x: 11, y: 0 },
      ],
    ]);
    expect(lines.length).toBe(2);
    expect(lines.every((line) => line.length === 2)).toBe(true);
  });

  it("does not Array.unshift while stitching a long open chain (issue #977)", () => {
    // Pre-fix: seeding at the high end of an open chain walks backward with
    // chain.unshift per edge → O(E²) copies. Reverse edge order surfaces that.
    const n = 2_000;
    const segments: Array<[{ x: number; y: number }, { x: number; y: number }]> = [];
    for (let i = 0; i < n; i++) {
      segments.push([
        { x: i, y: 0 },
        { x: i + 1, y: 0 },
      ]);
    }
    segments.reverse();
    const unshiftSpy = spyOn(Array.prototype, "unshift");
    try {
      const lines = stitchSegments(segments);
      expect(lines.length).toBe(1);
      expect(lines[0]!.length).toBe(n + 1);
      expect(unshiftSpy).not.toHaveBeenCalled();
    } finally {
      unshiftSpy.mockRestore();
    }
  });
});

describe("statContour", () => {
  it("checks plateau cells only at levels their corners can cross", () => {
    const side = 9;
    const plateau = 100;
    const size = side ** 2;
    const z = new Float64Array(size).fill(plateau);
    z[2 * side + 2] = 109;
    z[6 * side + 6] = 91;
    const input = {
      x: Float64Array.from(z, (_, i) => i % side),
      y: Float64Array.from(z, (_, i) => Math.floor(i / side)),
      z,
      groups: Array.from({ length: size }, () => 0),
      params: { breaks: [92, 94, 96, 98, 102, 104, 106, 108] },
    };
    const isFinite = Number.isFinite;
    let plateauChecks = 0;
    const finite = spyOn(Number, "isFinite").mockImplementation((value) => {
      if (value === plateau) plateauChecks++;
      return isFinite(value);
    });
    let result: ReturnType<typeof statContour>;
    try {
      result = statContour(input);
    } finally {
      finite.mockRestore();
    }

    expect([...new Set(result.level)]).toEqual(input.params.breaks);
    expect(plateauChecks).toBeLessThan(600);
  });

  // 3×3 grid z = x (vertical isolines at constant x where z crosses level)
  function gridXY(n: number): { x: Float64Array; y: Float64Array; z: Float64Array } {
    const x: number[] = [];
    const y: number[] = [];
    const z: number[] = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        x.push(i);
        y.push(j);
        z.push(i); // z = x
      }
    }
    return {
      x: Float64Array.from(x),
      y: Float64Array.from(y),
      z: Float64Array.from(z),
    };
  }

  it("emits isolines for level midway between x columns", () => {
    const g = gridXY(3);
    const result = statContour({
      ...g,
      groups: Array.from({ length: g.x.length }, () => 0),
      params: { breaks: [0.5] },
    });
    expect(result.x.length).toBeGreaterThan(0);
    // All vertices near x=0.5
    for (let i = 0; i < result.x.length; i++) {
      expect(result.x[i]!).toBeCloseTo(0.5, 6);
      expect(result.level[i]!).toBe(0.5);
    }
  });

  it("constant field yields no contours without explicit breaks", () => {
    const n = 4;
    const x: number[] = [];
    const y: number[] = [];
    const z: number[] = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        x.push(i);
        y.push(j);
        z.push(5);
      }
    }
    const result = statContour({
      x: Float64Array.from(x),
      y: Float64Array.from(y),
      z: Float64Array.from(z),
      groups: Array.from({ length: n * n }, () => 0),
      params: { bins: 5 },
    });
    expect(result.x.length).toBe(0);
  });

  it("drops non-finite input rows", () => {
    const g = gridXY(2);
    const x = Float64Array.from([...g.x, Number.NaN]);
    const y = Float64Array.from([...g.y, 0]);
    const z = Float64Array.from([...g.z, 0]);
    const groups = Array.from({ length: x.length }, () => 0);
    const result = statContour({
      x,
      y,
      z,
      groups,
      params: { breaks: [0.5] },
    });
    expect(result.dropped).toBe(1);
  });

  it("groups independently", () => {
    const g0 = gridXY(2);
    const g1 = gridXY(2);
    const x = Float64Array.from([...g0.x, ...g1.x]);
    const y = Float64Array.from([...g0.y, ...g1.y]);
    const z = Float64Array.from([...g0.z, ...g1.z.map((v) => v + 10)]);
    const groups = [
      ...Array.from({ length: g0.x.length }, () => 0),
      ...Array.from({ length: g1.x.length }, () => 1),
    ];
    const result = statContour({
      x,
      y,
      z,
      groups,
      params: { breaks: [0.5, 10.5] },
    });
    expect(new Set(result.groups).size).toBe(2);
  });
});

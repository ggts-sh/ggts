/**
 * Time-of-day position conversion (#831): portable numbers are seconds since midnight.
 * Marks (positionColumn) and detached values (positionValuesToNumeric) must share
 * the same ms-of-day scale space so points align with the axis.
 */
import { describe, expect, it } from "bun:test";
import { aes, gg, scaleXTime } from "@ggts-sh/spec";

import { ColumnTable } from "../../src/table.ts";
import { runPipeline } from "../../src/pipeline.ts";
import {
  positionColumn,
  positionConversionContext,
  positionValuesToNumeric,
} from "../../src/pipeline/temporal-position.ts";

const size = { width: 640, height: 400 };

describe("time-of-day position conversion (#831)", () => {
  const conversion = positionConversionContext({ type: "time", temporalKind: "time" });

  it("maps seconds since midnight to epoch ms on 1970-01-01Z", () => {
    const { values } = positionValuesToNumeric([0, 3600, 12 * 3600 + 30 * 60], conversion);
    expect(values[0]).toBe(0);
    expect(values[1]).toBe(3_600_000);
    expect(values[2]).toBe((12 * 3600 + 30 * 60) * 1000);
  });

  it("extracts clock portion from Date values (UTC)", () => {
    const d = new Date(Date.UTC(2024, 5, 15, 14, 30, 0));
    const { values } = positionValuesToNumeric([d], conversion);
    expect(values[0]).toBe((14 * 3600 + 30 * 60) * 1000);
  });

  it("positionColumn applies the same seconds→ms conversion as detached values", () => {
    const table = ColumnTable.fromRows([
      { t: 0, v: 1 },
      { t: 3600, v: 2 },
      { t: 12 * 3600 + 30 * 60, v: 3 },
    ]);
    const column = positionColumn(table, "t", conversion);
    const detached = positionValuesToNumeric([0, 3600, 12 * 3600 + 30 * 60], conversion).values;
    expect(Array.from(column)).toEqual(Array.from(detached));
    expect(column[1]).toBe(3_600_000);
  });

  it("positionColumn extracts UTC clock from Date cells", () => {
    const table = ColumnTable.fromRows([
      { t: new Date(Date.UTC(2024, 0, 1, 9, 15, 0)), v: 1 },
      { t: new Date(Date.UTC(2024, 5, 15, 18, 0, 0)), v: 2 },
    ]);
    const column = positionColumn(table, "t", conversion);
    expect(column[0]).toBe((9 * 3600 + 15 * 60) * 1000);
    expect(column[1]).toBe(18 * 3600 * 1000);
  });
});

describe("time-of-day full pipeline (#831)", () => {
  it("renders scaleXTime on seconds-since-midnight without temporal-parse error", () => {
    const model = runPipeline(
      gg(
        [
          { t: 0, v: 1 },
          { t: 3600, v: 2 },
          { t: 12 * 3600, v: 3 },
        ],
        aes({ x: "t", y: "v" }),
      )
        .geomPoint()
        .scales(scaleXTime({ nice: false }))
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    if (model.scales.x.type === "band") throw new Error("expected continuous x scale");
    // Domain evidence is in ms-of-day (not raw seconds).
    const [lo, hi] = model.scales.x.domain;
    expect(lo).toBeLessThanOrEqual(0);
    // 12h in ms = 43_200_000; domain max should be near that scale, not ~12.
    expect(hi).toBeGreaterThan(1_000_000);
  });

  it("aligns point x with axis domain under scaleXTime (seconds input)", () => {
    const model = runPipeline(
      gg(
        [
          { t: 0, v: 1 },
          { t: 6 * 3600, v: 2 },
          { t: 12 * 3600, v: 3 },
        ],
        aes({ x: "t", y: "v" }),
      )
        .geomPoint()
        .scales(scaleXTime({ nice: false, domain: [0, 12 * 3600] }))
        .spec(),
      size,
    );
    // Explicit domain is converted to ms-of-day for training.
    expect(model.scales.x.type).toBe("time");
    if (model.scales.x.type === "band") throw new Error("expected continuous x scale");
    // Normalize ms-of-day values through the trained scale; seconds/ms mismatch
    // would pile everything near 0 (seconds << domain in ms).
    const [x0, xMid, x1] = [0, 6 * 3600, 12 * 3600].map((s) => model.scales.x.normalize(s * 1000));
    expect([x0, xMid, x1].every((x) => typeof x === "number" && Number.isFinite(x))).toBe(true);
    expect(x0).toBeLessThan(xMid);
    expect(xMid).toBeLessThan(x1);
    // Midpoint (6h) should be near the center of [0, 12h].
    expect(xMid).toBeGreaterThan(0.4);
    expect(xMid).toBeLessThan(0.6);
  });

  it("accepts Date cells on scaleXTime and extracts clock portion for domain", () => {
    const model = runPipeline(
      gg(
        [
          { t: new Date(Date.UTC(2024, 0, 1, 8, 0, 0)), v: 1 },
          { t: new Date(Date.UTC(2024, 0, 1, 16, 0, 0)), v: 2 },
        ],
        aes({ x: "t", y: "v" }),
      )
        .geomPoint()
        .scales(scaleXTime({ nice: false }))
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    if (model.scales.x.type === "band") throw new Error("expected continuous x scale");
    const [lo, hi] = model.scales.x.domain;
    // 8:00 → 28_800_000 ms; 16:00 → 57_600_000 ms (not full calendar epochs).
    expect(lo).toBeLessThan(100_000_000);
    expect(hi).toBeLessThan(100_000_000);
    expect(hi).toBeGreaterThan(lo);
  });

  it("count/bar on scaleXTime trains domain in ms-of-day (not raw seconds)", () => {
    const model = runPipeline(
      gg([{ t: 3600 }, { t: 3600 }, { t: 7200 }], aes({ x: "t" }))
        .geomBar()
        .scales(scaleXTime({ nice: false }))
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    if (model.scales.x.type === "band") throw new Error("expected continuous x scale");
    const [lo, hi] = model.scales.x.domain;
    // 1h–2h in ms; must not stay in portable seconds (3600…7200).
    expect(lo).toBeGreaterThanOrEqual(3_000_000);
    expect(hi).toBeGreaterThanOrEqual(7_000_000);
    expect(hi).toBeLessThan(100_000_000);
  });
});

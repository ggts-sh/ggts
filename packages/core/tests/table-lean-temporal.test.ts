import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { installTemporal } from "../src/install-temporal.ts";
import { runPipeline } from "../src/pipeline.ts";
import { ColumnTable } from "../src/table.ts";
import { getTemporalRuntime, resetTemporalRuntimeForTests } from "../src/temporal-runtime.ts";

/**
 * Lean `@ggts-sh/core/render` leaves the temporal runtime unset. Unit tests
 * preload the full runtime (bunfig), so this suite clears it and restores after.
 */
describe("lean ColumnTable temporal detection (no runtime)", () => {
  beforeAll(() => {
    resetTemporalRuntimeForTests();
    expect(getTemporalRuntime()).toBeNull();
  });

  afterAll(() => {
    installTemporal();
    expect(getTemporalRuntime()).not.toBeNull();
  });

  it("does not treat ISO strings mixed with numbers as temporal", () => {
    const table = ColumnTable.fromColumns({
      x: ["2024-01-01", 5, "2024-01-03"],
    });
    expect(table.fieldType("x")).toBe("nominal");
    // Numbers must not collapse to epoch-ms near 1970 on a date axis.
    const parsed = table.parsed("x");
    expect(parsed.decision.status).not.toBe("temporal");
    expect(parsed.semantic[1]).toBe(5);
  });

  it("still treats an all-ISO column as temporal", () => {
    const table = ColumnTable.fromColumns({
      x: ["2024-01-01", "2024-01-02", null],
    });
    expect(table.fieldType("x")).toBe("temporal");
    expect(table.parsed("x").decision.status).toBe("temporal");
  });

  it("parses pure number columns without temporal/string coercion side effects", () => {
    const table = ColumnTable.fromColumns({
      x: [1, 2, null, 4.5, Number.NaN],
    });
    const view = table.parsed("x");
    expect(view.decision.status).toBe("nominal");
    expect(view.semantic[0]).toBe(1);
    expect(view.semantic[1]).toBe(2);
    expect(Number.isNaN(view.semantic[2]!)).toBe(true);
    expect(view.semantic[3]).toBe(4.5);
    expect(Number.isNaN(view.semantic[4]!)).toBe(true);
    expect(view.valid[0]).toBe(1);
    expect(view.valid[2]).toBe(0);
    expect(view.valid[4]).toBe(0);
    expect(table.fieldType("x")).toBe("quantitative");
  });

  it("parses pure non-ISO string columns as nominal without inventing numbers", () => {
    // Competitive multi-series color/group columns are short labels ("s0"…);
    // they must stay nominal with an all-invalid semantic (no ISO coercion).
    const table = ColumnTable.fromColumns({
      series: ["s0", "s1", "s0", null, "s2"],
    });
    const view = table.parsed("series");
    expect(view.decision.status).toBe("nominal");
    expect(table.fieldType("series")).toBe("nominal");
    expect(table.discreteness("series")).toBe("discrete");
    for (let i = 0; i < view.semantic.length; i++) {
      expect(Number.isNaN(view.semantic[i]!)).toBe(true);
      expect(view.valid[i]).toBe(0);
    }
  });

  it("fieldType uses lite decision without a second typeof walk on pure columns", () => {
    // Pure numbers → quantitative; pure labels → nominal; both paths must
    // agree with nonTemporalFieldType on the same cells (#1468).
    const nums = ColumnTable.fromColumns({ x: [0, 1, 2, null, 3] });
    expect(nums.parsed("x").decision.parserKey).toBe("lite:numbers");
    expect(nums.fieldType("x")).toBe("quantitative");
    expect(nums.discreteness("x")).toBe("continuous");
    const labels = ColumnTable.fromColumns({ g: ["a", "b", "a"] });
    expect(labels.parsed("g").decision.parserKey).toBe("lite:labels");
    expect(labels.fieldType("g")).toBe("nominal");
    expect(labels.discreteness("g")).toBe("discrete");
  });

  it("fieldType still classifies pure Date columns as temporal on the lean path", () => {
    // Devin #1477: first-cell probe would have returned nominal; nonTemporalFieldType
    // must still run for lite:auto / Date-only columns.
    const table = ColumnTable.fromColumns({
      when: [new Date("2024-01-01T00:00:00Z"), new Date("2024-01-02T00:00:00Z")],
    });
    expect(table.parsed("when").decision.parserKey).toBe("lite:auto");
    expect(table.fieldType("when")).toBe("temporal");
  });

  it("fieldType still classifies mixed number/text as nominal on the lean path", () => {
    const table = ColumnTable.fromColumns({ mixed: [1, "a", 2] });
    expect(table.parsed("mixed").decision.parserKey).toBe("lite:auto");
    expect(table.fieldType("mixed")).toBe("nominal");
  });

  it("still coerces numeric text columns via Number (CSV-ish weights)", () => {
    // Must not take the all-NaN label fast path — lean and full runtime agree.
    const table = ColumnTable.fromColumns({
      w: ["1", "2.5", " 3 ", null, "-4"],
    });
    const view = table.parsed("w");
    expect(view.decision.status).toBe("nominal");
    expect(view.semantic[0]).toBe(1);
    expect(view.semantic[1]).toBe(2.5);
    expect(view.semantic[2]).toBe(3);
    expect(Number.isNaN(view.semantic[3]!)).toBe(true);
    expect(view.semantic[4]).toBe(-4);
    expect(view.valid[0]).toBe(1);
    expect(view.valid[3]).toBe(0);
  });

  it("still coerces mixed ISO + non-ISO strings via cellsToNumeric semantics", () => {
    const table = ColumnTable.fromColumns({
      mixed: ["2024-01-01", "label", "2024-01-03"],
    });
    const view = table.parsed("mixed");
    expect(view.decision.status).toBe("nominal");
    expect(view.semantic[0]).toBe(Date.UTC(2024, 0, 1));
    expect(Number.isNaN(view.semantic[1]!)).toBe(true);
    expect(view.semantic[2]).toBe(Date.UTC(2024, 0, 3));
  });
});

describe("lean pipeline: date-axis charts without temporal runtime", () => {
  beforeAll(() => {
    resetTemporalRuntimeForTests();
    expect(getTemporalRuntime()).toBeNull();
  });

  afterAll(() => {
    installTemporal();
    expect(getTemporalRuntime()).not.toBeNull();
  });

  it("renders a plain ISO date-axis chart instead of crashing on planTemporalAxis", () => {
    const model = runPipeline(
      gg(
        [
          { date: "2024-01-01", value: 1 },
          { date: "2024-01-02", value: 2 },
          { date: "2024-01-03", value: 3 },
        ],
        aes({ x: "date", y: "value" }),
      )
        .geomPoint()
        .spec(),
      { width: 400, height: 300 },
    );
    expect(model.scales.x.type).toBe("time");
    expect(model.scene.panels).toHaveLength(1);
    const axisX = model.scene.panels[0]?.axisX ?? [];
    expect(axisX.length).toBeGreaterThan(0);
    // Labels come from the lean timeTicks path (formatTime), not a thrown runtime error.
    expect(axisX.some((tick) => tick.label.length > 0)).toBe(true);
  });
});

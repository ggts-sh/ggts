/**
 * Auto temporal scales must still reject invalid timezone names up front
 * (Devin #1278). The lean/auto early-return must not skip timezone validation.
 */
import { describe, expect, it } from "bun:test";

import { aes, gg } from "@ggts-sh/spec";

import { PipelineError, runPipeline } from "../../src/pipeline.ts";
import { size } from "./fixtures.ts";

const dateRows = [
  { date: "2024-01-01", value: 1 },
  { date: "2024-01-02", value: 2 },
];

const datetimeRows = [
  { date: "2024-01-01T10:00:00", value: 1 },
  { date: "2024-01-02T10:00:00", value: 2 },
];

describe("temporal pipeline: auto parser timezone preflight", () => {
  it("rejects an invalid timezone with a clear configuration error on auto parse", () => {
    let caught: unknown;
    try {
      runPipeline(
        gg(dateRows, aes({ x: "date", y: "value" }))
          .geomLine()
          .scaleXDate({ timezone: "Not/A_Zone" })
          .spec(),
        size,
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PipelineError);
    const message = (caught as PipelineError).message;
    expect(message).toMatch(/invalid or unsupported timezone/i);
    expect(message).toMatch(/Not\/A_Zone/);
    // Must not fall through to the generic "could not be parsed strictly" path.
    expect(message).not.toMatch(/could not be parsed strictly/i);
  });

  it("accepts a valid timezone on auto parse", () => {
    const model = runPipeline(
      gg(datetimeRows, aes({ x: "date", y: "value" }))
        .geomLine()
        .scaleXDatetime({ timezone: "America/New_York", nice: false })
        .spec(),
      size,
    );
    expect(model.scales.x.type).toBe("time");
    expect(model.scene.panels.length).toBeGreaterThan(0);
  });
});

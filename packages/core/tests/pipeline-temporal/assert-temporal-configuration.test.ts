/**
 * Unit tests for assertTemporalConfiguration (lean runtime + config errors).
 * Pipeline timezone preflight is covered in auto-timezone-preflight.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { installTemporal } from "../../src/install-temporal.ts";
import {
  assertTemporalConfiguration,
  temporalPreflightDocs,
} from "../../src/pipeline/temporal-preflight-shared.ts";
import { AUTO_POSITION_CONVERSION } from "../../src/pipeline/temporal-position.ts";
import { PipelineError } from "../../src/pipeline/types.ts";
import { getTemporalRuntime, resetTemporalRuntimeForTests } from "../../src/temporal-runtime.ts";

describe("assertTemporalConfiguration", () => {
  beforeAll(() => {
    resetTemporalRuntimeForTests();
    expect(getTemporalRuntime()).toBeNull();
  });

  afterAll(() => {
    installTemporal();
    expect(getTemporalRuntime()).not.toBeNull();
  });

  it("no-ops for forced discrete axes even with an explicit parser", () => {
    expect(() => {
      assertTemporalConfiguration("x", {
        ...AUTO_POSITION_CONVERSION,
        parser: "ymd",
        forcedDiscrete: true,
      });
    }).not.toThrow();
  });

  it("allows auto parser without the temporal runtime", () => {
    expect(() => {
      assertTemporalConfiguration("y", AUTO_POSITION_CONVERSION);
    }).not.toThrow();
  });

  it("rejects explicit parsers when the temporal runtime is missing", () => {
    let caught: unknown;
    try {
      assertTemporalConfiguration("x", {
        ...AUTO_POSITION_CONVERSION,
        parser: "ymd",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PipelineError);
    const err = caught as PipelineError;
    expect(err.code).toBe("temporal-parse-failed");
    expect(err.path).toBe("/scales/x");
    expect(err.message).toMatch(/explicit temporal parser/i);
    expect(err.message).toMatch(/@ggts-sh\/core\/temporal|@ggts-sh\/core \(full\)/);
    expect(err.diagnostic?.documentationUrl).toBe(temporalPreflightDocs("temporal-parse-failed"));
  });

  it("rejects invalid timezone configuration on auto parse without a runtime", () => {
    // Timezone validation still runs for auto so mistyped zones fail early.
    let caught: unknown;
    try {
      assertTemporalConfiguration("y", {
        ...AUTO_POSITION_CONVERSION,
        options: { timezone: "Not/A_Zone" },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PipelineError);
    const err = caught as PipelineError;
    expect(err.code).toBe("temporal-parse-failed");
    expect(err.path).toBe("/scales/y");
    expect(err.message).toMatch(/invalid temporal parser configuration/i);
    expect(err.message).toMatch(/Not\/A_Zone|timezone/i);
    expect(err.diagnostic?.documentationUrl).toBe(temporalPreflightDocs("temporal-parse-failed"));
  });
});

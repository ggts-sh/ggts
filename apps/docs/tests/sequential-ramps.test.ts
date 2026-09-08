import { SEQUENTIAL_SCHEME_NAMES } from "@ggts-sh/spec";
import { describe, expect, it } from "vitest";

import { SEQUENTIAL_RAMP_ROWS } from "../src/lib/catalog/sequential-ramps";

describe("SEQUENTIAL_RAMP_ROWS", () => {
  it("covers every registered sequential scheme in registry order", () => {
    expect(SEQUENTIAL_RAMP_ROWS.map((row) => row.name)).toEqual([...SEQUENTIAL_SCHEME_NAMES]);
  });

  it("gives every row a non-empty ramp of hex colors", () => {
    expect(SEQUENTIAL_RAMP_ROWS.length).toBeGreaterThan(10);
    for (const row of SEQUENTIAL_RAMP_ROWS) {
      expect(row.colors.length, row.name).toBeGreaterThan(0);
      for (const color of row.colors) {
        expect(color, `${row.name}: ${color}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it("starts viridis at the canonical dark purple", () => {
    const viridis = SEQUENTIAL_RAMP_ROWS.find((row) => row.name === "viridis");
    expect(viridis?.colors[0]).toBe("#440154");
  });
});

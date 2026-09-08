/**
 * Theme registry: catalog completeness, documented ordering, and LEGACY
 * edition-1 inheritance contracts (split from sequential-and-theme).
 */
import { THEME_NAMES } from "@ggts-sh/spec";
import { describe, expect, it } from "bun:test";

import { BUILTIN_THEMES, LEGACY_BUILTIN_THEMES } from "../../src/theme.ts";

describe("theme registry", () => {
  it("keeps every edition theme table complete against the spec registry", () => {
    expect(Object.keys(BUILTIN_THEMES).toSorted()).toEqual([...THEME_NAMES].toSorted());
    expect(Object.keys(LEGACY_BUILTIN_THEMES).toSorted()).toEqual([...THEME_NAMES].toSorted());
  });

  it("registers BUILTIN_THEMES keys in the documented catalog order", () => {
    expect(Object.keys(BUILTIN_THEMES)).toEqual([
      "default",
      "hrbr",
      "minimal",
      "light",
      "dark",
      "ggplot2",
      "grey",
      "gray",
      "classic",
      "bw",
      "few",
      "clean",
      "fivethirtyeight",
      "economist",
      "tufte",
      "linedraw",
      "void",
      "stata",
      "stata_s1color",
      "solarized",
      "solarizeddark",
      "economist_white",
      "solarized_2",
      "solarized_2dark",
      "wsj",
      "hc",
      "hcdark",
      "pander",
      "base",
      "igray",
      "map",
      "solid",
      "test",
    ]);
  });

  it("LEGACY light/dark/minimal tip contracts (no stale tip leak from foundation spread)", () => {
    // LEGACY dark elevates paper only; border tracks legacy rgba grid.
    expect(LEGACY_BUILTIN_THEMES.dark.tooltipPaper).toBe("#22262d");
    expect(LEGACY_BUILTIN_THEMES.dark.tooltipPaper).not.toBe(LEGACY_BUILTIN_THEMES.dark.paper);
    expect(LEGACY_BUILTIN_THEMES.dark.tooltipInk).toBe(LEGACY_BUILTIN_THEMES.dark.ink);
    expect(LEGACY_BUILTIN_THEMES.dark.tooltipBorder).toBe(LEGACY_BUILTIN_THEMES.dark.grid);
    expect(LEGACY_BUILTIN_THEMES.dark.tooltipBorder).toBe("rgba(230,232,235,0.16)");

    expect(LEGACY_BUILTIN_THEMES.light.tooltipPaper).toBe(LEGACY_BUILTIN_THEMES.light.paper);
    expect(LEGACY_BUILTIN_THEMES.light.tooltipBorder).toBe(LEGACY_BUILTIN_THEMES.light.grid);

    expect(LEGACY_BUILTIN_THEMES.minimal.tooltipBorder).toBe(LEGACY_BUILTIN_THEMES.minimal.grid);
    expect(LEGACY_BUILTIN_THEMES.minimal.tooltipBorder).toBe("rgba(128,128,128,0.12)");
  });

  it("LEGACY light/dark keep transparent letterbox gutters (edition-1 paper overrides)", () => {
    // paper is opaque, but letterboxFill stays "none" so fixed-aspect margins
    // remain see-through over the host page (prior LEGACY_BASE behavior).
    expect(LEGACY_BUILTIN_THEMES.light.paper).toBe("#ffffff");
    expect(LEGACY_BUILTIN_THEMES.light.letterboxFill).toBe("none");
    expect(LEGACY_BUILTIN_THEMES.dark.paper).toBe("#16181d");
    expect(LEGACY_BUILTIN_THEMES.dark.letterboxFill).toBe("none");
    expect(LEGACY_BUILTIN_THEMES.minimal.letterboxFill).toBe("none");
  });
});

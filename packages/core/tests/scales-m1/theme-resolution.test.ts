/**
 * Theme registry: named-theme resolution contracts and resolve mechanics
 * (split from sequential-and-theme).
 */
import { THEME_NAMES } from "@ggts-sh/spec";
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "bun:test";

import { BUILTIN_THEMES, resolveTheme, themeVar, UnknownThemeError } from "../../src/theme.ts";

describe("theme registry", () => {
  const interactionColorRoles = [
    "interactionInk",
    "focusRing",
    "crosshair",
    "selectionFill",
    "selectionStroke",
    "tooltipPaper",
    "tooltipInk",
    "tooltipBorder",
    "toolActive",
  ] as const;

  it("resolves the edition-2 typography and structural theme tokens", () => {
    expect(resolveTheme()).toBe(BUILTIN_THEMES.default);
    expect(resolveTheme("default").fontFamily).toContain("Roboto Condensed");
    expect(resolveTheme("hrbr").axisLineX).toBe(false);
    expect(resolveTheme("classic").axisLineX).toBe(true);
    expect(resolveTheme("dark").paper).toBe("#16181d");
    expect(resolveTheme("light").gridWidth).toBe(0.25);
  });

  it("resolves theme_grey / theme_gray as aliases of the ggplot2 grey-panel look (#824)", () => {
    const ggplot2 = resolveTheme("ggplot2");
    // Prefer shared token maps (not a re-skin): same object identity as ggplot2.
    expect(resolveTheme("grey")).toBe(ggplot2);
    expect(resolveTheme("gray")).toBe(ggplot2);
    expect(BUILTIN_THEMES.grey).toBe(BUILTIN_THEMES.ggplot2);
    expect(BUILTIN_THEMES.gray).toBe(BUILTIN_THEMES.ggplot2);
    // Grey-panel signature (not the hrbr/default white panel).
    expect(ggplot2.panel).toBe("#ebebeb");
    expect(ggplot2.grid.toLowerCase()).toBe("#ffffff");
  });

  it("registers theme_test as a pinned high-contrast snapshot theme (#823)", () => {
    // Stability contract: fixed literals so product-theme sweeps (#753-style)
    // cannot silently retarget the test chrome. Not an alias of light/classic.
    expect(THEME_NAMES).toContain("test");
    expect(THEME_NAMES.at(-1)).toBe("test");
    const tokens = resolveTheme("test");
    expect(tokens.paper).toBe("#ffffff");
    expect(tokens.panel).toBe("#ffffff");
    expect(tokens.ink).toBe("#000000");
    expect(tokens.accent).toBe("#000000");
    expect(tokens.grid).toBe("#cccccc");
    expect(tokens.axisText).toBe("#000000");
    expect(tokens.axisLine).toBe("#000000");
    expect(tokens.tickColor).toBe("#000000");
    expect(tokens.panelBorder).toBe("#000000");
    expect(tokens.fontFamily).toBe("Helvetica, Arial, sans-serif");
    expect(tokens.fontSize).toBe(11);
    expect(tokens.axisTextSize).toBe(12);
    expect(tokens.titleSize).toBe(14);
    expect(tokens.subtitleSize).toBe(12);
    expect(tokens.axisTitleSize).toBe(11);
    expect(tokens.captionSize).toBe(9);
    expect(tokens.stripSize).toBe(11);
    expect(tokens.axisLineWidth).toBe(0.5);
    expect(tokens.tickWidth).toBe(0.5);
    expect(tokens.tickLength).toBe(4);
    expect(tokens.gridWidth).toBe(0.5);
    expect(tokens.panelBorderWidth).toBe(0.5);
    expect(tokens.ticksX).toBe(true);
    expect(tokens.ticksY).toBe(true);
    expect(tokens.gridX).toBe(true);
    expect(tokens.gridY).toBe(true);
    expect(tokens.axisLineX).toBe(true);
    expect(tokens.axisLineY).toBe(true);
    expect(tokens.showPanelBorder).toBe(true);
    // Not a silent alias of product themes that still evolve.
    expect(tokens.fontFamily).not.toBe(resolveTheme("default").fontFamily);
    expect(tokens.grid).not.toBe(resolveTheme("classic").grid);
  });

  it("registers theme_bw as a white-panel print theme distinct from light and ggplot2 (#820)", () => {
    // Independent contract from ggplot2's published complete-theme role:
    // white panel + grey grid + rectangular border (not grey-panel/white-grid
    // ggplot2, and not light's thinner/lighter chrome).
    expect(THEME_NAMES).toContain("bw");
    const bw = resolveTheme("bw");
    const light = resolveTheme("light");
    const ggplot2 = resolveTheme("ggplot2");

    expect(bw.paper).toBe("#ffffff");
    expect(bw.panel).toBe("#ffffff");
    expect(bw.grid).not.toBe("none");
    expect(bw.grid).not.toBe("#ffffff");
    expect(bw.showPanelBorder).toBe(true);
    expect(bw.ticksX).toBe(true);
    expect(bw.ticksY).toBe(true);
    expect(bw.axisLineX).toBe(false);
    expect(bw.axisLineY).toBe(false);
    expect(bw.axisTextSize).toBeGreaterThanOrEqual(12);
    expect(bw.panelBorder).toBe("#333333");
    expect(bw.grid).toBe("#e5e5e5");

    // Distinct from cousins that already ship.
    expect(bw.panel).not.toBe(ggplot2.panel);
    expect(bw.grid).not.toBe(ggplot2.grid);
    expect(bw.panelBorder).not.toBe(light.panelBorder);
    expect(bw.gridWidth).not.toBe(light.gridWidth);
  });

  it("resolves theme_linedraw as high-contrast black-line chrome (#821)", () => {
    const t = resolveTheme("linedraw");
    const classic = resolveTheme("classic");
    const ggplot2 = resolveTheme("ggplot2");

    // White panel (not ggplot2 grey); black monochrome chrome.
    expect(t.panel).toBe("#ffffff");
    expect(t.paper).toBe("#ffffff");
    expect(t.panel).not.toBe(ggplot2.panel);
    expect(t.ink.toLowerCase()).toBe("#000000");
    expect(t.grid.toLowerCase()).toBe("#000000");
    expect(t.panelBorder.toLowerCase()).toBe("#000000");
    expect(t.tickColor.toLowerCase()).toBe("#000000");
    expect(t.axisText.toLowerCase()).toBe("#000000");
    // Grid present (classic suppresses grid entirely).
    expect(t.gridX).toBe(true);
    expect(t.gridY).toBe(true);
    expect(classic.gridX).toBe(false);
    expect(t.showPanelBorder).toBe(true);
    expect(t.ticksX).toBe(true);
    expect(t.ticksY).toBe(true);
    expect(t.axisTextSize).toBeGreaterThanOrEqual(12);
    // Hairline black grid — not solid graph paper.
    expect(t.gridWidth).toBeLessThanOrEqual(0.35);
  });

  it("keeps axis tick labels readable on light/minimal family themes (#753)", () => {
    // 8.8px was unreadable next to 15px titles and ~12–16px tooltips on the
    // docs homepage hero. Floor is intentionally above 11 so axis chrome is
    // not fine print at 640×400.
    for (const name of [
      "light",
      "minimal",
      "ggplot2",
      "classic",
      "few",
      "bw",
      "linedraw",
      "grey",
      "gray",
      "test",
    ] as const) {
      expect(resolveTheme(name).axisTextSize, name).toBeGreaterThanOrEqual(12);
    }
    expect(resolveTheme("default").axisTitleSize).toBeGreaterThanOrEqual(11);
  });

  it("object themes override roles over a named base", () => {
    const tokens = resolveTheme({
      name: "dark",
      accent: "#ff0000",
      focusRing: "#00ff00",
      interactionMuted: 0.5,
      tooltipPaper: "#111111",
    });
    expect(tokens.accent).toBe("#ff0000");
    expect(tokens.ink).toBe(BUILTIN_THEMES.dark.ink);
    expect(tokens.focusRing).toBe("#00ff00");
    expect(tokens.interactionMuted).toBe(0.5);
    expect(tokens.tooltipPaper).toBe("#111111");
  });

  it("unknown names throw (tier-1 error) and themeVar wraps --gg-* vars", () => {
    expect(() => resolveTheme(fromAny("darkk"))).toThrow(UnknownThemeError);
    expect(themeVar("ink", BUILTIN_THEMES.default)).toBe("var(--gg-ink, #262626)");
  });

  it("resolves the complete interaction visual language as CSS-variable roles", () => {
    for (const name of Object.keys(BUILTIN_THEMES) as (keyof typeof BUILTIN_THEMES)[]) {
      const tokens = resolveTheme(name);
      for (const role of interactionColorRoles) {
        expect(tokens[role], `${name}.${role}`).toBeTruthy();
        expect(themeVar(role, tokens), `${name}.${role} CSS variable`).toBe(
          `var(--gg-${role}, ${tokens[role]})`,
        );
      }
      expect(tokens.interactionMuted, `${name}.interactionMuted`).toBeGreaterThan(0);
      expect(tokens.interactionMuted, `${name}.interactionMuted`).toBeLessThan(1);
      expect(themeVar("interactionMuted", tokens)).toBe(
        `var(--gg-interactionMuted, ${tokens.interactionMuted})`,
      );
    }

    expect(BUILTIN_THEMES.default.tooltipPaper).toBe(BUILTIN_THEMES.default.paper);
    expect(BUILTIN_THEMES.default.tooltipInk).toBe(BUILTIN_THEMES.default.ink);
    // dark elevates tip paper above chart surface (see elevated problem-theme tests).
    expect(BUILTIN_THEMES.dark.tooltipInk).toBe(BUILTIN_THEMES.dark.ink);
    expect(BUILTIN_THEMES.default.selectionFill).toContain("rgba(");
    expect(BUILTIN_THEMES.dark.selectionFill).toContain("rgba(");
  });
});

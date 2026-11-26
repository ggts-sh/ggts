import { describe, expect, it } from "bun:test";

import {
  isMarksOnlyTheme,
  MARKS_ONLY_DARK_SITE_ROLES,
  MARKS_ONLY_THEME_NAMES,
  marksOnlyDarkSiteCssVars,
  marksOnlyDarkSiteShellPath,
  marksOnlyThemeRoles,
} from "../apps/docs/src/lib/marks-only-theme-contrast.ts";
import { THEME_SPECIMENS } from "../apps/docs/src/lib/theme-specimens/catalog.ts";
import { themeSpecimenStaticSvg } from "../apps/docs/src/lib/theme-specimens/static-svg.ts";

describe("marks-only theme contrast (docs dark shell)", () => {
  it("names only void, map, and solid", () => {
    expect([...MARKS_ONLY_THEME_NAMES].toSorted()).toEqual(["map", "solid", "void"]);
    for (const name of MARKS_ONLY_THEME_NAMES) {
      expect(isMarksOnlyTheme(name)).toBe(true);
    }
    expect(isMarksOnlyTheme("default")).toBe(false);
    expect(isMarksOnlyTheme("dark")).toBe(false);
    expect(isMarksOnlyTheme("tufte")).toBe(false);
  });

  it("returns high-contrast roles only for marks-only themes on the dark site", () => {
    expect(marksOnlyThemeRoles("void", "dark")).toEqual(MARKS_ONLY_DARK_SITE_ROLES);
    expect(marksOnlyThemeRoles("map", "dark")).toEqual(MARKS_ONLY_DARK_SITE_ROLES);
    expect(marksOnlyThemeRoles("solid", "dark")).toEqual(MARKS_ONLY_DARK_SITE_ROLES);

    expect(marksOnlyThemeRoles("void", "light")).toEqual({});
    expect(marksOnlyThemeRoles("map", "light")).toEqual({});
    expect(marksOnlyThemeRoles("default", "dark")).toEqual({});
    expect(marksOnlyThemeRoles("dark", "dark")).toEqual({});
  });

  it("dark-site shell paths match the gen-theme-static-shells contract", () => {
    expect(marksOnlyDarkSiteShellPath("void")).toBe("/theme-shells/theme-void-dark-site.svg");
    expect(marksOnlyDarkSiteShellPath("map")).toBe("/theme-shells/theme-map-dark-site.svg");
    expect(marksOnlyDarkSiteShellPath("solid")).toBe("/theme-shells/theme-solid-dark-site.svg");
  });

  it("catalog marks-only specimens exist so dual shells are not orphans", () => {
    const names = new Set(THEME_SPECIMENS.map((s) => s.name));
    for (const name of MARKS_ONLY_THEME_NAMES) {
      expect(names.has(name), name).toBe(true);
    }
  });

  it("dark-site static SVG bakes light ink fallbacks (not the default dark ink)", () => {
    const voidSpecimen = THEME_SPECIMENS.find((s) => s.name === "void");
    expect(voidSpecimen).toBeDefined();
    if (voidSpecimen === undefined) return;

    const light = themeSpecimenStaticSvg({
      name: voidSpecimen.name,
      kind: voidSpecimen.kind,
      scheme: voidSpecimen.scheme,
      height: 380,
    });
    const dark = themeSpecimenStaticSvg({
      name: voidSpecimen.name,
      kind: voidSpecimen.kind,
      scheme: voidSpecimen.scheme,
      height: 380,
      themeRoles: MARKS_ONLY_DARK_SITE_ROLES,
    });

    // themeVar form: var(--gg-ink, <token>). Dark site must not fall back to HRBR ink.
    expect(light).toContain("var(--gg-ink, #262626)");
    expect(dark).toContain(`var(--gg-ink, ${MARKS_ONLY_DARK_SITE_ROLES.ink})`);
    expect(dark).not.toContain("var(--gg-ink, #262626)");
    expect(dark).not.toEqual(light);
  });

  it("does not remap interactionInk (keeps white-halo crosshair labels legible)", () => {
    const roles = marksOnlyThemeRoles("void", "dark");
    expect(roles).not.toHaveProperty("interactionInk");
    expect(roles).not.toHaveProperty("toolActive");
    expect(roles).not.toHaveProperty("tooltipPaper");
    expect(roles).toHaveProperty("ink", MARKS_ONLY_DARK_SITE_ROLES.ink);
  });

  it("emits host CSS vars for gallery frames only when marks-only + dark", () => {
    expect(marksOnlyDarkSiteCssVars("map", "dark")).toBe(
      [
        `--gg-ink:${MARKS_ONLY_DARK_SITE_ROLES.ink}`,
        `--gg-stripText:${MARKS_ONLY_DARK_SITE_ROLES.stripText}`,
        `--gg-axisText:${MARKS_ONLY_DARK_SITE_ROLES.axisText}`,
        `--gg-axisLine:${MARKS_ONLY_DARK_SITE_ROLES.axisLine}`,
        `--gg-tickColor:${MARKS_ONLY_DARK_SITE_ROLES.tickColor}`,
      ].join(";"),
    );
    expect(marksOnlyDarkSiteCssVars("void", "light")).toBe("");
    expect(marksOnlyDarkSiteCssVars("classic", "dark")).toBe("");
    expect(marksOnlyDarkSiteCssVars(undefined, "dark")).toBe("");
  });
});

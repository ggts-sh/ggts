/**
 * theme_void (#822) — chrome-free complete theme for maps / pure marks.
 *
 * Contract: no axis lines, ticks, tick labels, grid, or panel border/fill;
 * mark geometry remains. Labels gate is theme-level (labelsX/labelsY).
 */
import { aes, gg, THEME_NAMES } from "@ggts-sh/spec";
import { describe, expect, it } from "bun:test";

import { runPipeline } from "../src/pipeline.ts";
import { renderToSVGString } from "../src/render-svg-full.ts";
import { BUILTIN_THEMES, resolveTheme } from "../src/theme.ts";

const size = { width: 480, height: 320 };
const rows = [
  { x: 1, y: 2 },
  { x: 2, y: 4 },
  { x: 3, y: 3 },
];

describe("theme_void registry (#822)", () => {
  it('registers "void" in THEME_NAMES and BUILTIN_THEMES', () => {
    expect(THEME_NAMES).toContain("void");
    expect(BUILTIN_THEMES.void).toBeDefined();
    expect(resolveTheme("void")).toBe(BUILTIN_THEMES.void);
  });

  it("suppresses cartesian chrome tokens", () => {
    const t = resolveTheme("void");
    expect(t.paper).toBe("none");
    expect(t.panel).toBe("none");
    expect(t.grid).toBe("none");
    expect(t.gridWidth).toBe(0);
    expect(t.gridX).toBe(false);
    expect(t.gridY).toBe(false);
    expect(t.axisLineX).toBe(false);
    expect(t.axisLineY).toBe(false);
    expect(t.ticksX).toBe(false);
    expect(t.ticksY).toBe(false);
    expect(t.labelsX).toBe(false);
    expect(t.labelsY).toBe(false);
    expect(t.showPanelBorder).toBe(false);
  });

  it("keeps labelsX/labelsY true on every labeled builtin (no layout regression)", () => {
    // ggthemes theme_map/theme_solid blank all axis text like theme_void —
    // marks-only surfaces by definition (#1158).
    const MARKS_ONLY = new Set(["void", "map", "solid"]);
    for (const name of THEME_NAMES) {
      if (MARKS_ONLY.has(name)) continue;
      const t = resolveTheme(name);
      expect(t.labelsX, `${name}.labelsX`).toBe(true);
      expect(t.labelsY, `${name}.labelsY`).toBe(true);
    }
  });
});

describe("theme_void render contract (#822)", () => {
  const voidSpec = () =>
    gg(rows, aes({ x: "x", y: "y" }))
      .geomPoint({ size: 4 })
      .theme("void")
      .labs({ title: "Void chrome check", x: "X", y: "Y" })
      .spec();

  it("SVG has no axis lines, tick marks, tick labels, grid lines, or panel border", () => {
    const svg = renderToSVGString(voidSpec(), size);
    expect(svg).not.toContain("gg-axis-line");
    expect(svg).not.toContain("gg-panel-border");
    // Empty gg-grid group may still be emitted; no stroke lines inside it.
    const gridGroups = svg.match(/<g class="gg-grid"[^>]*>[\s\S]*?<\/g>/g) ?? [];
    for (const group of gridGroups) {
      expect(group).not.toContain("<line");
    }
    // Tick groups keep a11y <title> tooltips; no visible tick marks or labels.
    const tickGroups = svg.match(/<g class="gg-tick[^"]*"[^>]*>[\s\S]*?<\/g>/g) ?? [];
    expect(tickGroups.length).toBeGreaterThan(0);
    for (const group of tickGroups) {
      expect(group).not.toContain("<line");
      expect(group).not.toContain("<text");
    }
    // paper: "none" → no opaque plot-wide paper rect.
    expect(svg).not.toContain('class="gg-paper"');
  });

  it("scene axis ticks carry showLabel false on both axes", () => {
    const model = runPipeline(voidSpec(), size);
    for (const panel of model.scene.panels) {
      for (const tick of panel.axisX ?? []) {
        expect(tick.showLabel).toBe(false);
      }
      for (const tick of panel.axisY ?? []) {
        expect(tick.showLabel).toBe(false);
      }
    }
  });

  it("still draws mark geometry (points remain)", () => {
    const svg = renderToSVGString(voidSpec(), size);
    expect(svg).toMatch(/<circle |class="gg-points|gg-point/);
  });

  it("explicit guide showLabels:true cannot resurrect void labels (theme wins on labels gate)", () => {
    // Theme labelsX/Y false AND guide showLabels true → still false.
    const model = runPipeline(
      gg(rows, aes({ x: "x", y: "y" }))
        .geomPoint()
        .theme("void")
        .guides({
          x: { type: "axis", showLabels: true },
          y: { type: "axis", showLabels: true },
        })
        .spec(),
      size,
    );
    for (const panel of model.scene.panels) {
      for (const tick of [...(panel.axisX ?? []), ...(panel.axisY ?? [])]) {
        expect(tick.showLabel).toBe(false);
      }
    }
  });
});

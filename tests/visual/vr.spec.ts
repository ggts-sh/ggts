/**
 * Enforced VR smoke suite — scenarios from smoke-matrix.ts only.
 * Full dual-theme × every example is intentionally gone; gallery lights live
 * under apps/docs/static/previews and may lag the renderer.
 */
import { expect, test, type Page } from "@playwright/test";

import { rows as legendFocusRows } from "../../examples/interaction/legend-focus/data.js";
import { renderToSVGString, runPipeline } from "../../packages/core/src/render-entry.js";
import type { SceneDiscreteLegend } from "../../packages/core/src/scene.js";
import { settleVisualState } from "./helpers/deterministic";
import { LEGEND_TITLE_SCENARIOS } from "./legend-title-scenarios";
import {
  SMOKE_SCENARIOS,
  type InteractionHandlerId,
  type InteractionSmokeScenario,
} from "./smoke-matrix";

const EXPECTED_PLOTS: Readonly<Record<string, number>> = {
  "interaction/linked-views": 2,
  "interaction/legend-focus": 3,
};

function exampleVrPath(exampleId: string): string {
  return `/examples/${exampleId}`;
}

async function shotExample(
  page: Page,
  exampleId: string,
  theme: "light" | "dark",
  basename: string,
): Promise<void> {
  await page.goto(`${exampleVrPath(exampleId)}?vr&theme=${theme}`);
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await settleVisualState(page, EXPECTED_PLOTS[exampleId] ?? 1);
  await expect(page.locator(".gg-example-frame")).toHaveScreenshot(basename);
}

const INTERACTION_HANDLERS: Record<
  InteractionHandlerId,
  (page: Page, scenario: InteractionSmokeScenario) => Promise<void>
> = {
  async "tooltip-pinned"(page, scenario) {
    await page.goto("/examples/interaction/tooltip?vr&theme=light");
    await settleVisualState(page);
    const mark = page.locator(".gg-points circle").first();
    const box = await mark.boundingBox();
    if (box === null) throw new Error("expected an inspectable point");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator(".gg-tooltip")).toBeVisible();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    // Chart-owned pin state — demo `.event-status` is hidden under ?vr (#650).
    await expect(page.locator(".gg-tooltip-pinned")).toBeVisible();
    await expect(page.locator(".gg-example-frame")).toHaveScreenshot(scenario.basename);
  },

  async "legend-focus-committed"(page, scenario) {
    // Match example vrWidth (960) so the three-up layout stays in-viewport for clicks.
    await page.setViewportSize({ width: 1000, height: 720 });
    await page.goto("/examples/interaction/legend-focus?vr&theme=light");
    await settleVisualState(page, 3);
    const firstLegendEntry = page.locator(".gg-legend-target").first();
    const focusedSeries = (await firstLegendEntry.innerText()).trim();
    await firstLegendEntry.click();
    await expect(firstLegendEntry).toHaveAttribute("aria-pressed", "true");
    // Demo status/summary chrome is hidden under ?vr; assert chart focus only (#650).
    //
    // Scoped to the first plot (SVG points) and counted from the example's own
    // data. A page-wide count would be `2 * series + 1` across the three plots —
    // the canvas plot contributes no DOM marks and the third adds a line path —
    // which encodes layout trivia instead of the property under test. A hard
    // assertion here also blocks baselines from landing (#421), so it must not
    // restate a row count that any dataset change invalidates.
    const focusedRows = legendFocusRows.filter((row) => row.series === focusedSeries).length;
    expect(
      focusedRows,
      `legend entry "${focusedSeries}" must match rows in the data`,
    ).toBeGreaterThan(0);
    const firstPlot = page.locator(".gg-plot-root").first();
    await expect(firstPlot.locator("[data-gg-focused='true']")).toHaveCount(focusedRows);
    await expect(page.locator(".gg-example-frame")).toHaveScreenshot(scenario.basename);
  },

  async "interval-selected"(page, scenario) {
    await page.goto("/examples/interaction/brush-zoom?vr&theme=light");
    await settleVisualState(page);
    const selectArea = page.getByRole("button", { name: "Select area" });
    await selectArea.click();
    await expect(selectArea).toHaveAttribute("aria-pressed", "true");
    const capture = page.locator(".gg-capture");
    const box = await capture.boundingBox();
    if (box === null) throw new Error("expected an interval capture surface");
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.75);
    await page.mouse.up();
    await expect(page.locator(".gg-selection")).toBeVisible();
    await expect(page.locator(".gg-example-frame")).toHaveScreenshot(scenario.basename);
  },

  async "tool-rail"(page, scenario) {
    await page.setViewportSize({ width: 460, height: 820 });
    await page.goto("/examples/interaction/brush-zoom?vr&theme=light");
    await settleVisualState(page);
    await page.locator(".gg-example-frame").evaluate((element) => {
      (element as HTMLElement).style.setProperty("width", "440px", "important");
    });
    await expect(page.locator(".gg-plot-root")).toHaveClass(/gg-narrow-tools/);
    await expect(page.locator("svg.gg-plot").first()).toHaveAttribute("width", "440");
    const rail = page.locator(".gg-tool-rail");
    await expect(rail).toBeVisible();
    await page.getByRole("button", { name: "Select area" }).click();
    const capture = page.locator(".gg-capture");
    const captureBox = await capture.boundingBox();
    if (captureBox === null) throw new Error("expected an interval capture surface");
    await page.mouse.move(captureBox.x + 80, captureBox.y + 80);
    await page.mouse.down();
    await page.mouse.move(captureBox.x + 180, captureBox.y + 180);
    await page.mouse.up();
    await expect(page.getByRole("button", { name: "Clear all selections" })).toBeVisible();
    await expect(page.locator(".gg-example-frame")).toHaveScreenshot(scenario.basename);
  },

  async "dark-tooltip"(page, scenario) {
    // Hover-open a tip so elevated dark tooltipPaper is in the golden (not just
    // the chart surface). Pin path is covered by tooltip-pinned under light.
    await page.goto("/examples/interaction/tooltip?vr&theme=dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await settleVisualState(page);
    const mark = page.locator(".gg-points circle").first();
    const box = await mark.boundingBox();
    if (box === null) throw new Error("expected an inspectable point");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator(".gg-tooltip")).toBeVisible();
    await expect(page.locator(".gg-example-frame")).toHaveScreenshot(scenario.basename);
  },

  async "forced-colors"(page, scenario) {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/examples/interaction/brush-zoom?vr&theme=light");
    await settleVisualState(page);
    const zoomArea = page.getByRole("button", { name: "Zoom area" });
    await zoomArea.click();
    await expect(zoomArea).toHaveAttribute("aria-pressed", "true");
    const capture = page.locator(".gg-capture");
    const box = await capture.boundingBox();
    if (box === null) throw new Error("expected an area capture surface");
    await capture.dispatchEvent("pointerdown", {
      clientX: box.x + box.width * 0.25,
      clientY: box.y + box.height * 0.25,
      pointerId: 13,
      button: 0,
      buttons: 1,
    });
    await capture.dispatchEvent("pointermove", {
      clientX: box.x + box.width * 0.7,
      clientY: box.y + box.height * 0.7,
      pointerId: 13,
      buttons: 1,
    });
    await expect(page.locator(".gg-area-draft-zoom")).toBeVisible();
    await expect(page.locator(".gg-zoom-label")).toBeVisible();
    await expect(page.locator(".gg-example-frame")).toHaveScreenshot(scenario.basename);
    await capture.dispatchEvent("pointercancel", { pointerId: 13 });
  },
};

for (const scenario of SMOKE_SCENARIOS) {
  if (scenario.kind === "example") {
    test(`${scenario.exampleId} — ${scenario.theme}`, async ({ page }) => {
      await shotExample(page, scenario.exampleId, scenario.theme, scenario.basename);
    });
    continue;
  }
  const handler = INTERACTION_HANDLERS[scenario.handler];
  test(`interaction — ${scenario.handler}`, async ({ page }) => {
    await handler(page, scenario);
  });
}

/**
 * Discrete legend titles, rendered by the public core pipeline into a
 * standalone white page. The wide seat keeps the adaptive title on the key
 * row; the narrow seat moves it above the keys. Geometry is asserted before
 * the screenshot so a placement regression fails on the property, not only on
 * pixels (#1884–#1886). No gallery example is changed for these seats.
 */
test.describe("legend title placement", () => {
  for (const scenario of LEGEND_TITLE_SCENARIOS) {
    test(`discrete legend title — ${scenario.id}`, async ({ page }) => {
      await page.setViewportSize({ width: scenario.width, height: scenario.height });

      const model = runPipeline(scenario.spec, {
        width: scenario.width,
        height: scenario.height,
      });
      const legend = model.scene.legends.find(
        (candidate): candidate is SceneDiscreteLegend =>
          candidate.type === "discrete" && candidate.direction === "horizontal",
      );
      if (legend === undefined) {
        throw new Error("expected a horizontal discrete legend in the scene");
      }
      const firstKey = legend.entries[0];
      if (firstKey === undefined) throw new Error("expected at least one legend key");
      const titleX = legend.titleX;
      const titleY = legend.titleY;
      if (titleX === undefined || titleY === undefined) {
        throw new Error("expected discrete legend title baselines in the scene");
      }
      const keyRows = new Set(legend.entries.map((entry) => entry.y));
      if (scenario.expected === "same-row") {
        expect(keyRows.size, "wide scenario keeps every key on one row").toBe(1);
        expect(titleX, "wide title sits left of the keys").toBeLessThan(firstKey.x);
        expect(titleY, "wide title baseline sits in the key row").toBeGreaterThan(firstKey.y);
        expect(titleY).toBeLessThan(firstKey.y + (firstKey.height ?? 24));
      } else {
        expect(keyRows.size, "narrow scenario wraps keys onto several rows").toBeGreaterThan(1);
        expect(titleY, "narrow title baseline sits above the keys").toBeLessThan(firstKey.y);
      }

      const svg = renderToSVGString(scenario.spec, {
        width: scenario.width,
        height: scenario.height,
      });
      await page.setContent(
        '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
          "<style>html,body{margin:0;padding:0;background:#ffffff;color-scheme:light}" +
          "svg.gg-plot{display:block}</style></head><body>" +
          `${svg}</body></html>`,
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const plot = page.locator("svg.gg-plot");
      const legendNode = plot.locator(".gg-legend");
      await expect(legendNode).toHaveClass(/gg-legend-bottom/);
      await expect(legendNode).toHaveClass(/gg-legend-horizontal/);

      const titleBox = await legendNode.locator(".gg-legend-title").boundingBox();
      if (titleBox === null) throw new Error("expected a visible legend title");
      const labels = await legendNode.locator(".gg-legend-label").evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            row: Number(node.getAttribute("y")),
          };
        }),
      );
      expect(labels.length, "one rendered label per legend key").toBe(legend.entries.length);
      const firstLabel = labels[0];
      if (firstLabel === undefined) throw new Error("expected at least one legend label");
      // Rows come from the laid-out SVG baseline, not glyph ink, so labels with
      // different ascenders cannot split one visual row.
      const renderedRows = new Set(labels.map((label) => label.row));

      if (scenario.expected === "same-row") {
        expect(renderedRows.size, "wide scenario renders one label row").toBe(1);
        expect(
          Math.abs(titleBox.y + titleBox.height / 2 - (firstLabel.y + firstLabel.height / 2)),
        ).toBeLessThanOrEqual(3);
        expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(firstLabel.x);
      } else {
        expect(renderedRows.size, "narrow scenario renders several label rows").toBeGreaterThan(1);
        expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(firstLabel.y);
      }

      await expect(plot).toHaveScreenshot(scenario.basename);
    });
  }
});

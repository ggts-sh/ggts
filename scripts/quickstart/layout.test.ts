/**
 * Gate G6 — the finished chart's data-panel aspect, not the outer SVG
 * aspect. PR #1073 targeted outer 2.5:1 and crushed the panel to ~5.8:1;
 * this pins the panel across widths.
 */
import { runPipeline } from "@ggts-sh/core";
import { describe, expect, it } from "bun:test";

import { SAKURA_STEPS, foldSakura } from "../quickstart.ts";
import { makeRows } from "./test-helpers.ts";

const rows = makeRows();
const finished = foldSakura(SAKURA_STEPS.length, rows);

/** Target width:height of the finished fold's *data panel*, not the outer SVG. */
const SAKURA_PANEL_ASPECT = 2.5;
const CHROME_PROBE_HEIGHT = 600;
const SAKURA_HEIGHT_PROBE_WIDTHS = [360, 480, 560, 660, 768, 800, 1000] as const;

describe("gate G6 — finished chart panel aspect, not outer SVG aspect", () => {
  it("keeps the data panel near 2.5:1 after axis chrome (no title/caption)", () => {
    // Outer height targets the panel: PR #1073 set outer 2.5:1 and crushed the
    // panel to ~5.8:1. Assert the panel at several widths. Finished lesson has
    // no title/subtitle/caption so chrome is axis titles only.
    for (const width of SAKURA_HEIGHT_PROBE_WIDTHS) {
      const size = measureSakuraFinishedSize(width);
      const aspect = size.panelWidth / size.panelHeight;
      expect(
        aspect,
        `width ${String(width)}: panel ${String(size.panelWidth)}×${String(size.panelHeight)}`,
      ).toBeGreaterThanOrEqual(SAKURA_PANEL_ASPECT - 0.2);
      expect(aspect).toBeLessThanOrEqual(SAKURA_PANEL_ASPECT + 0.2);
    }
  });
});

function measureSakuraFinishedSize(width: number): {
  width: number;
  height: number;
  panelWidth: number;
  panelHeight: number;
} {
  const model = runPipeline(finished.spec, { width, height: CHROME_PROBE_HEIGHT });
  const panel = model.scene.panels[0];
  if (panel === undefined) {
    throw new Error(`measureSakuraFinishedSize(${String(width)}): no panel`);
  }
  const chromeTop = panel.y;
  const chromeBottom = CHROME_PROBE_HEIGHT - panel.y - panel.height;
  const chromeSide = width - panel.width;
  const panelWidth = Math.max(width - chromeSide, 1);
  const panelHeight = panelWidth / SAKURA_PANEL_ASPECT;
  const height = Math.round(chromeTop + panelHeight + chromeBottom);
  const check = runPipeline(finished.spec, { width, height });
  const checked = check.scene.panels[0];
  if (checked === undefined) {
    throw new Error(`measureSakuraFinishedSize(${String(width)}): re-probe has no panel`);
  }
  return {
    width,
    height,
    panelWidth: checked.width,
    panelHeight: checked.height,
  };
}

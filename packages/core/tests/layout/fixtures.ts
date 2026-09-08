/**
 * Shared fixtures for two-pass layout characterization tests.
 */
import type { PositionScaleSpec } from "@ggts-sh/spec";

import {
  DEFAULT_LAYOUT_THEME,
  type Domain,
  type LayoutInput,
  type LayoutTheme,
} from "../../src/layout/layout.ts";
import { MetricsTableMeasurer } from "../../src/layout/measure.ts";
import { FONT_METRICS } from "../../src/layout/font-metrics.ts";

export const SPANISH = [
  "Resolución",
  "Corrección (errores o erratas)",
  "Sentencia",
  "Orden",
  "Otro",
];

export const bandX = (categories: string[], config: Partial<PositionScaleSpec> = {}): Domain => ({
  type: "band",
  categories,
  rawCategories: categories,
  band: {
    aesthetic: "x",
    panelIndex: 0,
    config: { type: "band", ...config },
  },
});

export const MODE_RANK = { "single-line": 0, wrapped: 1, rotated: 2 } as const;

export const measurer = new MetricsTableMeasurer(FONT_METRICS);
export const theme: LayoutTheme = DEFAULT_LAYOUT_THEME;

export const lin = (min: number, max: number): Domain => ({ type: "linear", min, max });
export const band = (...categories: string[]): Domain => ({ type: "band", categories });

export const base = (over: Partial<LayoutInput>): LayoutInput => ({
  width: 640,
  height: 400,
  x: lin(0, 100),
  y: lin(0, 1000),
  measurer,
  ...over,
});

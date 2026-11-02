/**
 * Discrete legend-title placement scenarios for the enforced VR suite.
 *
 * Both scenarios render a real bottom/horizontal discrete legend from the
 * public core pipeline. `titlePosition` is deliberately unset: the wide seat
 * must keep the title on the key row, the narrow seat must move it above the
 * keys (adaptive placement, issues #1884–#1886).
 *
 * The specs pin a white paper and the metric-compatible font stack so the
 * screenshot is readable and deterministic in the pinned Playwright container.
 */
import type { SpecInput } from "@ggts-sh/spec";

export type LegendTitleRowExpectation = "same-row" | "title-above-keys";

export interface LegendTitleScenario {
  readonly id: "fit" | "wrap";
  readonly basename: string;
  /** Chart width/height; also the page viewport for the screenshot. */
  readonly width: number;
  readonly height: number;
  readonly expected: LegendTitleRowExpectation;
  readonly spec: SpecInput;
}

const LIGHT_VR_THEME = {
  paper: "#ffffff",
  panel: "#ffffff",
  ink: "#262626",
  axisText: "#4d4d4d",
  grid: "#e6e6e6",
  fontFamily: "Helvetica, Arial, sans-serif",
} as const;

function legendTitleSpec(input: {
  title: string;
  categories: readonly string[];
  rows: readonly { x: number; y: number; group: string }[];
}): SpecInput {
  return {
    edition: 2,
    data: { values: [...input.rows] },
    layers: [{ geom: "point", aes: { x: "x", y: "y", color: "group" } }],
    scales: {
      color: { type: "ordinal", domain: [...input.categories] },
    },
    guides: { color: { type: "legend", position: "bottom" } },
    labs: { color: input.title },
    theme: LIGHT_VR_THEME,
  };
}

export const LEGEND_TITLE_SCENARIOS: readonly LegendTitleScenario[] = [
  {
    id: "fit",
    basename: "legend-title-fit-light.png",
    width: 720,
    height: 240,
    expected: "same-row",
    spec: legendTitleSpec({
      title: "Cohort",
      categories: ["Alpha", "Beta", "Gamma"],
      rows: [
        { x: 1, y: 4, group: "Alpha" },
        { x: 2, y: 7, group: "Beta" },
        { x: 3, y: 5, group: "Gamma" },
      ],
    }),
  },
  {
    id: "wrap",
    basename: "legend-title-wrap-light.png",
    width: 360,
    height: 260,
    expected: "title-above-keys",
    spec: legendTitleSpec({
      title: "Survey region",
      categories: [
        "Northern Europe",
        "Southern Europe",
        "Western Europe",
        "Eastern Europe",
        "North America",
        "South America",
      ],
      rows: [
        { x: 1, y: 4, group: "Northern Europe" },
        { x: 2, y: 7, group: "Southern Europe" },
        { x: 3, y: 5, group: "Western Europe" },
        { x: 4, y: 8, group: "Eastern Europe" },
        { x: 5, y: 6, group: "North America" },
        { x: 6, y: 3, group: "South America" },
      ],
    }),
  },
];

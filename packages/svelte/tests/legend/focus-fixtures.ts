/**
 * Shared SceneLegend fixtures for pure legend focus unit suites.
 */
import type { SceneLegend } from "@ggts-sh/core";

export const discreteFill: SceneLegend = {
  type: "discrete",
  scale: "fill",
  title: "Channel",
  x: 10,
  y: 12,
  width: 124,
  height: 72,
  swatchSize: 12,
  entries: [
    { value: "web", label: "Web", color: "#123456", y: 18 },
    { value: "store", label: "Store", color: "#654321", y: 42 },
  ],
};

export const discreteColor: SceneLegend = {
  type: "discrete",
  scale: "color",
  title: "Tone",
  x: 200,
  y: 12,
  width: 100,
  height: 48,
  swatchSize: 12,
  entries: [{ value: "a", label: "A", color: "#000", y: 18 }],
};

export const ramp: SceneLegend = {
  type: "ramp",
  scale: "color",
  title: "Score",
  x: 10,
  y: 12,
  width: 80,
  height: 120,
  rampWidth: 12,
  rampHeight: 80,
  stops: [
    [0, "#000"],
    [1, "#fff"],
  ],
  ticks: [{ y: 0, label: "10" }],
};

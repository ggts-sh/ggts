import { aes, fillPaintLinear, gg, glow, strokePaintLinear } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { series } from "./data.js";

export default defineExample(
  gg(series, aes({ x: "x", ymin: "lo", ymax: "hi" }))
    .geomRibbon({
      alpha: 0.85,
      outline: "both",
      fillPaint: fillPaintLinear({
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 1,
        space: "mark",
        stops: [
          { offset: 0, color: "#4c78a8", opacity: 0.9 },
          { offset: 1, color: "#f58518", opacity: 0.75 },
        ],
        fallback: "#4c78a8",
      }),
      strokePaint: strokePaintLinear({
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 0,
        space: "panel",
        stops: [
          { offset: 0, color: "#1a1a1a" },
          { offset: 1, color: "#666666" },
        ],
        fallback: "#1a1a1a",
      }),
      glow: glow({ color: "#4c78a8", radius: 5, opacity: 0.35 }),
      linewidth: 1.25,
    })
    .geomLine({
      aes: { x: "x", y: "mid" },
      linewidth: 1.5,
    })
    .labs({
      title: "What a ribbon can be painted with",
      subtitle: "One interval band carrying a gradient fill, a gradient stroke and a glow",
      x: "x",
      y: "value",
      caption: "Within-mark paint (not a data scale); solid fallbacks remain for a11y.",
    })
    .spec(),
);

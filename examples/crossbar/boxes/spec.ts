import { aes, gg, scaleXDiscrete, scaleYContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { groupIntervals } from "./data.js";

export default defineExample(
  // Thumbnail contract: three tall interval boxes with a fat mid line so
  // the crossbar reads at the 96×96 geoms-index crop.
  gg(groupIntervals, aes({ x: "group", y: "mid", ymin: "lo", ymax: "hi" }))
    .scales({
      ...scaleXDiscrete({ domain: ["A", "B", "C"] }),
      ...scaleYContinuous({ limits: [0, 12] }),
    })
    .geomCrossbar({
      width: 0.55,
      linewidth: 1.8,
      fatten: 3.2,
      aes: aes({
        color: { value: "#1a202c" },
        fill: { value: "#cbd5e1" },
      }),
    })
    .theme("minimal")
    .labs({
      title: "Interval boxes with mid line",
      subtitle: "Three identity boxes from ymin to ymax with a horizontal line at y",
      x: "Group",
      y: "Value",
    })
    .spec(),
);

import { aes, gg, scaleXDiscrete, scaleYContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { groupIntervals } from "./data.js";

export default defineExample(
  // Thumbnail contract: three thick stems plus large mid points so the
  // point-on-range mark reads at the 96×96 geoms-index crop.
  gg(groupIntervals, aes({ x: "group", y: "mid", ymin: "lo", ymax: "hi" }))
    .scales({
      ...scaleXDiscrete({ domain: ["A", "B", "C"] }),
      ...scaleYContinuous({ limits: [0, 12] }),
    })
    .geomPointrange({
      linewidth: 2.6,
      size: 5.5,
      aes: aes({ color: { value: "#1a202c" } }),
    })
    .theme("minimal")
    .labs({
      title: "Stem plus mid point",
      subtitle: "Three identity intervals with a point at (x, y)",
      x: "Group",
      y: "Value",
    })
    .spec(),
);

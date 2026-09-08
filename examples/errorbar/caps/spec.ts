import { aes, gg, scaleXDiscrete, scaleYContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { groupIntervals } from "./data.js";

export default defineExample(
  // Thumbnail contract: three tall stems with end caps only — no jitter
  // cloud — so the caps read at the 96×96 geoms-index crop.
  gg(groupIntervals, aes({ x: "group", ymin: "lo", ymax: "hi" }))
    .scales({
      ...scaleXDiscrete({ domain: ["A", "B", "C"] }),
      ...scaleYContinuous({ limits: [0, 12] }),
    })
    .geomErrorbar({
      width: 0.55,
      linewidth: 2.6,
      aes: aes({ color: { value: "#1a202c" } }),
    })
    .theme("minimal")
    .labs({
      title: "Capped error bars",
      subtitle: "Three identity intervals with end caps at ymin and ymax",
      x: "Group",
      y: "Value",
    })
    .spec(),
);

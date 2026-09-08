import { aes, gg, scaleXDiscrete, scaleYContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { groupIntervals } from "./data.js";

export default defineExample(
  // Thumbnail contract: three thick stems only — no end caps — so the
  // bare linerange reads at the 96×96 geoms-index crop.
  gg(groupIntervals, aes({ x: "group", ymin: "lo", ymax: "hi" }))
    .scales({
      ...scaleXDiscrete({ domain: ["A", "B", "C"] }),
      ...scaleYContinuous({ limits: [0, 12] }),
    })
    .geomLinerange({
      linewidth: 3.2,
      aes: aes({ color: { value: "#1a202c" } }),
    })
    .theme("minimal")
    .labs({
      title: "Bare vertical stems",
      subtitle: "Three identity intervals from ymin to ymax without end caps",
      x: "Group",
      y: "Value",
    })
    .spec(),
);

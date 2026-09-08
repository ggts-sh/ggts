import { aes, gg, scaleXContinuous, scaleYContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { stairVertices } from "./data.js";

export default defineExample(
  // Thumbnail contract: a few tall hv stairs, no dense ECDF cloud of points.
  gg(stairVertices, aes({ x: "x", y: "y" }))
    .scales({
      ...scaleXContinuous({ limits: [0.5, 5.5] }),
      ...scaleYContinuous({ limits: [0, 6] }),
    })
    .geomStep({
      direction: "hv",
      linewidth: 3.4,
      aes: aes({ color: { value: "#1a202c" } }),
    })
    .theme("minimal")
    .labs({
      title: "Thick staircase",
      subtitle: "Five vertices joined horizontal-then-vertical",
      x: "x",
      y: "y",
    })
    .spec(),
);

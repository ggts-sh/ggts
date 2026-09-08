import { aes, gg, scaleFillContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { chocolateRatingGrid } from "./data.js";

export default defineExample(
  gg(chocolateRatingGrid, aes({ x: "cocoaPercent", y: "rating", fill: "bars" }))
    .geomRaster()
    .scales(scaleFillContinuous({ scheme: "viridis" }))
    .theme("few")
    .labs({
      title: "Where chocolate reviews cluster",
      subtitle: "Count of bars at each cocoa percent and rating. Darker cells hold more reviews",
      x: "Cocoa (%)",
      y: "Rating (1–4)",
      fill: "Bars",
    })
    .spec(),
);

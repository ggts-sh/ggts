import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { coffeeRatings } from "./data.js";

export default defineExample(
  // Linear RQ fits at the default 0.25 / 0.5 / 0.75 quantiles of y given x.
  gg(coffeeRatings, aes({ x: "aroma", y: "flavor" }))
    .geomPoint({ alpha: 0.3, size: 2 })
    .geomQuantile({ linewidth: 1.4 })
    .theme("classic")
    .labs({
      title: "Flavor against aroma in cupping scores",
      subtitle: "Lower quartile, median, and upper quartile of flavor as aroma rises",
      x: "Aroma",
      y: "Flavor",
    })
    .spec(),
);

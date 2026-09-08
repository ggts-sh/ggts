import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { earthDensity } from "./data.js";

export default defineExample(
  // geom_hline is sugar for rule + yintercept annotation (#818).
  // Thumbnail contract: one thick horizontal mark only — no series line, so
  // the geom reads as a threshold bar at index thumbnail size.
  gg(earthDensity, aes({ x: "trial", y: "density" }))
    .geomPoint({ size: 2.2, alpha: 0.55 })
    .geomHline({
      yintercept: 5.517,
      linewidth: 2.6,
      aes: aes({ color: { value: "#2f6fed" } }),
    })
    .theme("minimal")
    .labs({
      title: "One horizontal threshold",
      subtitle: "Twenty-nine density readings with a line at the modern earth density 5.517",
      x: "Determination",
      y: "Density of the earth (water = 1)",
    })
    .spec(),
);

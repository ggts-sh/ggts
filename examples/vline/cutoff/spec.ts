import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { earthDensity } from "./data.js";

export default defineExample(
  // geom_vline is sugar for rule + xintercept annotation (#818).
  // Thumbnail contract: one thick vertical mark only — no series line, so
  // the geom reads as a cutoff bar at index thumbnail size.
  gg(earthDensity, aes({ x: "trial", y: "density" }))
    .geomPoint({ size: 2.2, alpha: 0.55 })
    .geomVline({
      xintercept: 6.5,
      linewidth: 2.6,
      aes: aes({ color: { value: "#d4615c" } }),
    })
    .theme("minimal")
    .labs({
      title: "One vertical cutoff",
      subtitle: "Wire changed after this trial",
      x: "Determination",
      y: "Density of the earth (water = 1)",
    })
    .spec(),
);

import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { earthDensity } from "./data.js";

export default defineExample(
  // Annotation form: fixed intercepts, inherits NO plot aes (like
  // ggplot2's geom_vline/geom_hline with inherit.aes = FALSE). Both
  // intercepts come from the source's own documentation - Cavendish refitted
  // the torsion balance with a stiffer wire after the sixth determination,
  // and the modern value of the earth's density is 5.517.
  //
  // Thumbnail contract: show BOTH axes of geom_rule as a crosshair. Drop the
  // connecting line so the rules, not a series chart, read at index size.
  gg(earthDensity, aes({ x: "trial", y: "density" }))
    .geomPoint({ size: 2.2, alpha: 0.55 })
    .geomRule({
      xintercept: 6.5,
      linewidth: 2.2,
      aes: aes({ color: { value: "#d4615c" } }),
    })
    .geomRule({
      yintercept: 5.517,
      linewidth: 2.2,
      aes: aes({ color: { value: "#2f6fed" } }),
    })
    .theme("minimal")
    .labs({
      title: "A crosshair of two fixed intercepts",
      subtitle: "Apparatus change (vertical) and modern value (horizontal)",
      x: "Determination",
      y: "Density of the earth (water = 1)",
    })
    .spec(),
);

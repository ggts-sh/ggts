import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { observations } from "./data.js";

export default defineExample(
  gg(observations, aes({ x: "bill", y: "mass" }))
    .geomPoint({ size: 3.2, alpha: 0.8 })
    .facet({ wrap: "island", ncol: 3 })
    .theme("clean")
    .labs({
      title: "Coordinate interval selection across facets",
      subtitle: "333 Palmer penguins by island — one interval, applied in every panel",
      x: "Bill length (mm)",
      y: "Body mass (g)",
    })
    .spec(),
);

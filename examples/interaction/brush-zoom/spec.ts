import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { field } from "./data.js";

export default defineExample(
  gg(field, aes({ x: "bill", y: "mass", color: "species" }))
    .geomPoint({ size: 2.5, alpha: 0.8 })
    .theme("light")
    .labs({
      title: "Select an interval or brush to zoom",
      subtitle: "333 Palmer penguins",
      x: "Bill length (mm)",
      y: "Body mass (g)",
      color: "Species",
    })
    .spec(),
);

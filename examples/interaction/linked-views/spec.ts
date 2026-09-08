import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { penguins } from "./data.js";

export default defineExample(
  gg(penguins, aes({ x: "flipper", y: "mass", color: "species" }))
    .geomPoint({ size: 4, alpha: 0.86 })
    .theme("minimal")
    .labs({
      title: "Selection shared by plots, controls, and a table",
      subtitle: "Five Palmer penguins per species, so every linked row fits in the table",
      x: "Flipper length (mm)",
      y: "Body mass (g)",
      color: "Species",
    })
    .spec(),
);

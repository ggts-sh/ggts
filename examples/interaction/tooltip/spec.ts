import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { penguins } from "./data.js";

export default defineExample(
  gg(penguins, aes({ x: "flipper", y: "mass", color: "species" }))
    .geomPoint({ size: 3, alpha: 0.8 })
    .theme("light")
    .labs({
      title: "Inspect a shared x value, then pin",
      subtitle: "333 penguins. Many share a flipper length",
      x: "Flipper length (mm)",
      y: "Body mass (g)",
      color: "Species",
    })
    .spec(),
);

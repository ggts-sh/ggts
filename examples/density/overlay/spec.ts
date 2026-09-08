import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { galtonChildren } from "./data.js";

export default defineExample(
  gg(galtonChildren, aes({ x: "height", fill: "gender" }))
    .geomDensity({ alpha: 0.45 })
    .scaleFillDiscrete({
      domain: ["Daughters", "Sons"],
      scheme: "wsj_red_green",
    })
    .theme("minimal")
    .labs({
      title: "Two densities on one axis",
      subtitle: "Son and daughter heights",
      x: "Height (inches)",
      y: "Density",
      fill: "Child",
    })
    .spec(),
);

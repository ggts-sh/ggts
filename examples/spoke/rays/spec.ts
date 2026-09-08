import { aes, gg, scaleXContinuous, scaleYContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { rays } from "./data.js";

export default defineExample(
  // Thumbnail contract: eight long thick rays, not a dense hillside field.
  gg(rays, aes({ x: "x", y: "y", angle: "angle", radius: "radius" }))
    .scales({
      ...scaleXContinuous({ limits: [-5, 5] }),
      ...scaleYContinuous({ limits: [-5, 5] }),
    })
    .geomSpoke({
      linewidth: 3.2,
      lineend: "round",
      alpha: 1,
      aes: aes({ color: { value: "#1a202c" } }),
    })
    .coordFixed()
    .theme("minimal")
    .labs({
      title: "Eight rays from one origin",
      subtitle: "Radius is length in data units",
      x: "x",
      y: "y",
    })
    .spec(),
);

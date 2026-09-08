import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { maungaWhauSlope } from "./data.js";

export default defineExample(
  // geom_spoke draws one segment per row from (x, y) along angle for radius.
  // It is the geom for a field: a direction and a size at every place, which
  // is what a slope, a wind or a current is.
  gg(maungaWhauSlope, aes({ x: "east", y: "north", angle: "angle", radius: "fall" }))
    .geomSpoke({ linewidth: 1.6, lineend: "round", alpha: 0.9 })
    .geomPoint({ size: 2, alpha: 0.7 })
    .coordFixed()
    .theme("classic")
    .labs({
      title: "Direction and length from each point",
      subtitle: "Flow off a hillside as angle and radius from each cell",
      x: "Metres east",
      y: "Metres north",
    })
    .spec(),
);

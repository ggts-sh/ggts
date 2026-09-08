import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { maungaWhau } from "./data.js";

export default defineExample(
  gg(maungaWhau, aes({ x: "east", y: "north", z: "height" }))
    .geomContour({ bins: 10, linewidth: 1 })
    .coordFixed()
    .theme("classic")
    .labs({
      title: "Contours of height on a grid",
      subtitle: "Elevation bands on Maunga Whau from a regular height matrix",
      x: "Metres east",
      y: "Metres north",
    })
    .spec(),
);

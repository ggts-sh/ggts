import { aes, gg, guideNone } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { pumpNeighbourhoods } from "./data.js";

export default defineExample(
  // geom_sf_text puts a plain label at each geometry's representative point,
  // worked out from the exterior ring rather than supplied as x and y.
  gg(pumpNeighbourhoods, aes({ fill: "pump", label: "pump" }))
    .geomSf({ alpha: 0.35, linewidth: 0.8 })
    .geomSfText({ size: 11 })
    .guides({ fill: guideNone() })
    .coordFixed()
    .theme("classic")
    .labs({
      title: "Every pump in Snow's Soho, named",
      subtitle: "Plain labels at the centre of the area each pump served",
    })
    .spec(),
);

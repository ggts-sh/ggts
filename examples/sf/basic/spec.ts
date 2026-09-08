import { aes, gg, scaleFillContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { heightRings } from "./data.js";

export default defineExample(
  // geom_sf reads a GeoJSON Geometry per row from the geometry column, already
  // projected into the panel's units - three rows here, one per height ring.
  gg(heightRings, aes({ fill: "height" }))
    .geomSf({ alpha: 0.55, linewidth: 0.9 })
    .scales(scaleFillContinuous({ scheme: "viridis" }))
    .coordFixed()
    .theme("classic")
    .labs({
      title: "Simple features as filled polygons",
      subtitle: "Elevation bands on a hill drawn from simple-feature rings",
      fill: "Metres",
    })
    .spec(),
);

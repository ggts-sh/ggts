import { aes, gg, scaleFillContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { fijiQuakes } from "./data.js";

export default defineExample(
  gg(fijiQuakes, aes({ x: "long", y: "lat" }))
    .geomHex({ bins: 18 })
    .scales(scaleFillContinuous({ scheme: "viridis" }))
    .theme("minimal")
    .labs({
      title: "Hex bins for a dense cloud",
      subtitle: "A thousand earthquakes by location off Fiji",
      x: "Longitude (°E)",
      y: "Latitude (°)",
      fill: "Events",
    })
    .spec(),
);

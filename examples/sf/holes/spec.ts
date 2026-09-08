import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { slopeBands } from "./data.js";

export default defineExample(
  // The second and later rings of a GeoJSON Polygon are interior rings. The
  // even-odd fill rule leaves them open, so a band of slope reads as a band
  // and not as a disc painted over its own summit.
  gg(slopeBands, aes({ fill: "band" }))
    .geomSf({ alpha: 0.75, linewidth: 0.9 })
    .coordFixed()
    .theme("classic")
    .labs({
      title: "Polygons with holes",
      subtitle: "Two elevation bands where the higher ring is a hole in the lower",
      fill: "Height band",
    })
    .spec(),
);

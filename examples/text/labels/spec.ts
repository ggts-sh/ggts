import { aes, gg, scaleXContinuous, scaleYContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { langrenLabels } from "./data.js";

export default defineExample(
  gg(langrenLabels, aes({ x: "longitude", y: "rank" }))
    // Thumbnail contract: few short names, large, above points so bare ink
    // reads at the 96×96 geoms-index crop. No boxes — that is GeomLabel's job.
    .scales({
      ...scaleXContinuous({ limits: [18, 30] }),
      ...scaleYContinuous({ limits: [0.2, 3.8] }),
    })
    .geomPoint({
      size: 4,
      alpha: 0.5,
      aes: aes({ color: { value: "#4a5568" } }),
    })
    .geomText({
      aes: aes({ label: "name", color: { value: "#1a202c" } }),
      anchor: "middle",
      dy: -18,
      size: 20,
    })
    .theme("minimal")
    .labs({
      title: "Bare text labels",
      subtitle: "Three short names — ink only, no box",
      x: "Estimated longitude (°)",
      y: "Order",
    })
    .spec(),
);

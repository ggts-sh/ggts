import { aes, gg, scaleXContinuous, scaleYContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { langrenLabels } from "./data.js";

export default defineExample(
  gg(langrenLabels, aes({ x: "longitude", y: "rank" }))
    // Thumbnail contract: same three short names as text/labels, with a cool
    // fill + dark stroke so boxes read at the 96×96 geoms-index crop.
    .scales({
      ...scaleXContinuous({ limits: [18, 30] }),
      ...scaleYContinuous({ limits: [0.2, 3.8] }),
    })
    .geomPoint({
      size: 4,
      alpha: 0.5,
      aes: aes({ color: { value: "#4a5568" } }),
    })
    .geomLabel({
      aes: aes({
        label: "name",
        fill: { value: "#b8c9e0" },
        color: { value: "#0f172a" },
      }),
      anchor: "middle",
      dy: -18,
      size: 20,
      padding: 7,
      radius: 6,
      linewidth: 2.2,
    })
    .theme("minimal")
    .labs({
      title: "Boxed labels",
      subtitle: "Same three names, each in a rounded box",
      x: "Estimated longitude (°)",
      y: "Order",
    })
    .spec(),
);

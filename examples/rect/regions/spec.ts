import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { reigns, wheatPrices } from "./data.js";

export default defineExample(
  // Two layers over two datasets with nothing in common, so neither inherits a
  // plot-level mapping: the rects are the reigns, the line is the price series.
  gg(reigns)
    .geomRect({
      aes: aes({
        xmin: "start",
        xmax: "end",
        ymin: "ymin",
        ymax: "ymax",
        fill: "rule",
        // A white hairline on every rect is what makes twelve adjacent bands
        // legible as twelve reigns rather than one long block.
        color: { value: "#ffffff" },
      }),
      alpha: 0.55,
      linewidth: 1,
    })
    .geomLine({
      data: wheatPrices,
      aes: aes({ x: "year", y: "shillings", color: { value: "#1a1a1a" } }),
      linewidth: 2,
    })
    .scaleFillDiscrete({
      domain: ["Monarchy", "Commonwealth"],
      scheme: "few_light",
    })
    .scales({ x: { labels: "d" } })
    .theme("economist")
    .labs({
      title: "Background rectangles for eras",
      subtitle: "Wheat prices with a band for each reign that covered those years",
      x: "Year",
      y: "Shillings per quarter",
      fill: "",
    })
    .spec(),
);

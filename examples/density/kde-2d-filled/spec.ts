import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { choleraDeaths, waterPumps } from "./data.js";

export default defineExample(
  gg(choleraDeaths, aes({ x: "x", y: "y" }))
    .geomDensity2dFilled({ bins: 6, n: 48, alpha: 0.8 })
    .geomPoint({
      alpha: 0.55,
      size: 1.6,
      aes: aes({ color: { value: "Deaths", scale: true } }),
    })
    .geomPoint({
      data: waterPumps,
      aes: aes({ x: "x", y: "y", color: { value: "Pumps", scale: true } }),
      size: 4,
      shape: "cross",
    })
    // Domain fixed so Deaths/Pumps never flip with layer order; palette, not hex.
    .scaleColorDiscrete({
      domain: ["Deaths", "Pumps"],
      scheme: "wsj_dem_rep",
    })
    .coordFixed()
    .theme("map")
    .labs({
      title: "Filled density bands over points",
      subtitle: "Cholera deaths in Soho, 1854",
      // theme_map blanks tick labels; empty x/y suppress the field-name fallbacks.
      x: "",
      y: "",
      fill: "Density",
      color: "",
    })
    .spec(),
);

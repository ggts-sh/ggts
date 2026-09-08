import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { choleraDeaths, waterPumps } from "./data.js";

export default defineExample(
  gg(choleraDeaths, aes({ x: "x", y: "y" }))
    .geomPoint({
      alpha: 0.55,
      size: 1.6,
      aes: aes({ color: { value: "Deaths", scale: true } }),
    })
    .geomDensity2d({
      bins: 6,
      n: 48,
      linewidth: 1,
    })
    // The pumps are the argument: without them the rings are a crowd of dots,
    // and with them the innermost ring lands on Broad Street.
    .geomPoint({
      data: waterPumps,
      aes: aes({ x: "x", y: "y", color: { value: "Pumps", scale: true } }),
      size: 4,
      shape: "cross",
    })
    // Domain fixed so Deaths/Pumps never flip with layer order; palette, not hex.
    .scaleColorDiscrete({
      domain: ["Deaths", "Pumps"],
      scheme: "observable10",
    })
    .coordFixed()
    .theme("map")
    .labs({
      title: "Density isolines over points",
      subtitle: "Cholera deaths in Soho, 1854",
      // theme_map blanks tick labels; empty x/y suppress the field-name fallbacks.
      x: "",
      y: "",
      color: "",
    })
    .spec(),
);

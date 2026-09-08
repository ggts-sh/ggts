import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { wheatAndWages } from "./data.js";

export default defineExample(
  gg(wheatAndWages, aes({ x: "year", y: "value", color: "series" }))
    .geomLine({ linewidth: 2 })
    // Small points over the line keep the layer-composition demo this example
    // is for, and match how Playfair plotted the observations themselves —
    // at 53 readings per series they read as data marks, not clutter.
    .geomPoint({ size: 1.6 })
    // Domain fixed so series-to-colour never depends on row order; 4-stop palette for two series.
    .scaleColorDiscrete({
      domain: ["Wheat / quarter", "Wage / week"],
      scheme: "wsj_rgby",
    })
    .scales({
      x: { breaks: [1600, 1650, 1700, 1750, 1800], labels: "d", nice: false },
    })
    .theme("economist")
    .labs({
      title: "Wheat price and a mechanic's weekly wage",
      subtitle:
        "Price of one quarter of wheat (~8 bushels) beside a week's pay — both in shillings",
      x: "Year",
      y: "Shillings",
      color: "Series",
    })
    .spec(),
);

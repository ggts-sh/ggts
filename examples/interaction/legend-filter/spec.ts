import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { britishFinances } from "./data.js";

export default defineExample(
  gg(britishFinances, aes({ x: "year", y: "value", color: "series" }))
    .geomLine({ linewidth: 2.2 })
    .geomPoint({ size: 2.6 })
    .scales({ x: { labels: "d" } })
    .theme("fivethirtyeight")
    .labs({
      title: "Filter series from the legend",
      subtitle: "Debt, revenue, and expenditure",
      x: "Year",
      y: "Playfair's index units",
      color: "Series",
    })
    .spec(),
);

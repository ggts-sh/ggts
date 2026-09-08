import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { laborCostOfWheat } from "./data.js";

export default defineExample(
  gg(laborCostOfWheat, aes({ x: "year", y: "weeks" }))
    .geomLine({ linewidth: 2, aes: aes({ color: { value: "#014d64" } }) })
    .geomPoint({ size: 1.6, aes: aes({ color: { value: "#014d64" } }) })
    .scales({
      x: { breaks: [1600, 1650, 1700, 1750, 1800], labels: "d", nice: false },
    })
    .theme("economist")
    .labs({
      title: "Weeks of work for a quarter of wheat",
      subtitle: "Wheat price ÷ weekly mechanic wage (~8 bushels)",
      x: "Year",
      y: "Weeks of work",
    })
    .spec(),
);

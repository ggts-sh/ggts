import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { beerProduction } from "./data.js";

export default defineExample(
  gg(beerProduction, aes({ x: "year", fill: "package", weight: "barrelsMillions" }))
    .geomBar({ position: "dodge" })
    .scales({ fill: { type: "ordinal", scheme: "observable10" } })
    .theme("few")
    .labs({
      title: "US beer production by package type",
      subtitle: "Millions of barrels each year as bottles and cans, kegs, or on-premises pours",
      x: "Year",
      y: "Millions of barrels",
      fill: "Package",
    })
    .spec(),
);

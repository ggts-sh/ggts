import { aes, gg, guideNone } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { coffeeRatings } from "./data.js";

export default defineExample(
  // Data-driven form: aes.x is mapped, so every row draws one vertical rule
  // spanning the panel. A rug is the natural chart for a 1-D sample of scores.
  //
  // y is synthetic for panel-spanning vertical rules; suppress the 0–1
  // axis ladder (#700).
  gg(coffeeRatings, aes({ x: "totalCupPoints" }))
    .geomRule({ alpha: 0.2, linewidth: 1 })
    .guides({ y: guideNone() })
    .theme("minimal")
    .labs({
      title: "A rug of every cupping score",
      subtitle:
        "One vertical line per coffee lot. Most lots sit between about 80 and 88 total cup points",
      x: "Total cup points",
    })
    .spec(),
);

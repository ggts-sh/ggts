import { aes, gg, guideNone } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { fastfoodMenu } from "./data.js";

export default defineExample(
  gg(fastfoodMenu, aes({ x: "restaurant", y: "calories", color: "restaurant" }))
    .geomJitter({ width: 0.22, height: 0, alpha: 0.65 })
    .scales({ color: { type: "ordinal", scheme: "observable10" } })
    .guides({ color: guideNone() })
    .theme("clean")
    .labs({
      title: "Menu calories, spread so items do not stack",
      subtitle: "Each point is one entrée. Jitter separates items that share a restaurant",
      x: "Restaurant",
      y: "Calories",
    })
    .spec(),
);

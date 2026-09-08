import { aes, gg, guideNone } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { fastfoodMenu } from "./data.js";

export default defineExample(
  gg(fastfoodMenu, aes({ x: "restaurant", y: "calories", color: "restaurant" }))
    .geomPoint({ position: "jitter", positionParams: { width: 0.22, height: 0 }, alpha: 0.65 })
    .scales({ color: { type: "ordinal", scheme: "observable10" } })
    .guides({ color: guideNone() })
    .theme("clean")
    .labs({
      title: "Calories by restaurant, with jitter",
      subtitle: "Horizontal jitter spreads marks that share a restaurant",
      x: "Restaurant",
      y: "Calories",
    })
    .spec(),
);

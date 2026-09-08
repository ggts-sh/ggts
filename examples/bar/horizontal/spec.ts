import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { armadaMen } from "./data.js";

export default defineExample(
  gg(armadaMen, aes({ x: "squadron", y: "men" }))
    .geomCol()
    .coordFlip()
    .theme("fivethirtyeight")
    .labs({
      title: "Category totals, flipped so labels read across",
      subtitle: "Ordered smallest to largest so the flip reads bottom-up",
      x: "Squadron",
      y: "Men",
    })
    .spec(),
);

import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { chestSizes } from "./data.js";

export default defineExample(
  gg(chestSizes, aes({ x: "chest", y: "soldiers" }))
    .geomCol()
    .scales({ x: { nice: false } })
    .theme("linedraw")
    .labs({
      title: "Linedraw theme on chest-size columns",
      subtitle: "Hard black lines, white panel, no grey fill",
      x: "Chest circumference (inches)",
      y: "Soldiers",
    })
    .spec(),
);

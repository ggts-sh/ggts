import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { chestSizes } from "./data.js";

export default defineExample(
  gg(chestSizes, aes({ x: "chest", y: "soldiers" }))
    .geomCol()
    .scales({ x: { nice: false } })
    .theme("classic")
    .labs({
      title: "Counts across ordered chest sizes",
      subtitle: "How many men fell in each chest-measure class",
      x: "Chest circumference (inches)",
      y: "Soldiers",
    })
    .spec(),
);

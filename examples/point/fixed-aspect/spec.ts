import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { unitCircle } from "./data.js";

export default defineExample(
  gg(unitCircle, aes({ x: "x", y: "y" }))
    .geomPoint({ size: 3 })
    .coordFixed()
    .labs({
      title: "Equal data units on both axes",
      subtitle: "A circular cloud stays circular when the aspect ratio locks x and y",
      x: "x",
      y: "y",
    })
    .spec(),
);

import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { rows } from "./data.js";

export default defineExample(
  gg(rows, aes({ x: "year", y: "value", color: "series" }))
    .geomPoint({ size: 4 })
    .scales({ x: { labels: "d" } })
    .theme("few")
    .labs({
      title: "Focus a legend group without changing the data",
      x: "Year",
      y: "Playfair's index units",
      color: "Series",
    })
    .spec(),
);

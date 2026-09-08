import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { britishExports } from "./data.js";

export default defineExample(
  gg(britishExports, aes({ x: "year", y: "value" }))
    .geomLine({ linewidth: 1.5 })
    .theme("fivethirtyeight")
    .labs({
      title: "Years inferred from raw four-digit strings",
      subtitle: "Export totals over time without pre-parsing dates in the table",
      x: "Year",
      y: "£ millions",
    })
    .spec(),
);

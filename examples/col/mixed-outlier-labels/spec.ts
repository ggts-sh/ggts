import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { filings } from "./data.js";

export default defineExample(
  gg(filings, aes({ x: "category", y: "count" }))
    .geomCol()
    .labs({
      title: "One long label among short ones",
      subtitle: "At a normal panel width the axis should wrap the outlier, not rotate every label",
      x: "Category",
      y: "Count",
    })
    .spec(),
);

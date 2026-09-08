import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { filings } from "./data.js";

export default defineExample(
  gg(filings, aes({ x: "category", y: "count" }))
    .geomCol()
    .labs({
      title: "Long category labels at a narrow width",
      subtitle: "The band axis has to wrap and rotate to fit these names at 480px",
      x: "Category",
      y: "Count",
    })
    .spec(),
);

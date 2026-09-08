import { aes, gg, guideNone } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { londonBills } from "./data.js";

export default defineExample(
  gg(londonBills, aes({ x: "year", y: "value", color: "measure" }))
    .geomLine({ linewidth: 1.6 })
    .facet({
      wrap: {
        field: "measure",
        levels: ["Male / female ratio", "Male christenings", "All burials", "Plague deaths"],
      },
      ncol: 2,
      scales: "free_y",
    })
    .scales({ x: { labels: "d" } })
    .guides({ color: guideNone() })
    .theme("fivethirtyeight")
    .labs({
      title: "Facets with free y scales",
      subtitle: "Christenings and burials on their own vertical ranges so neither series flattens",
      x: "Year",
      y: "",
    })
    .spec(),
);

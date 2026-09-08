import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { guerry } from "./data.js";

export default defineExample(
  gg(guerry, aes({ x: "literacy", y: "crimePersons", color: "region" }))
    .geomPoint({ size: 3 })
    .scales({ color: { type: "ordinal", scheme: "observable10" } })
    .theme("few")
    .labs({
      title: "Two measures coloured by region",
      subtitle: "Literacy and crime by French department",
      x: "Literate conscripts (%)",
      y: "Population per crime against persons",
      color: "Region",
    })
    .spec(),
);

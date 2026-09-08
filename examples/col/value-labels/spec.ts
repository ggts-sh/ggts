import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { polioTrial } from "./data.js";

export default defineExample(
  gg(polioTrial, aes({ x: "group", y: "rate" }))
    .geomCol({ width: 0.7 })
    .geomText({ aes: { label: "label" }, dy: -8 })
    .scales({ x: { domain: ["Vaccinated", "Placebo", "Not inoculated"] } })
    .theme("fivethirtyeight")
    .labs({
      title: "Columns with the rate printed on each bar",
      subtitle: "Paralytic polio per 100,000 children in each arm of the trial",
      x: "Group",
      y: "Cases per 100,000",
    })
    .spec(),
);

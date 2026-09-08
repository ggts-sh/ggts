import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { crimeanMortality } from "./data.js";

export default defineExample(
  gg(crimeanMortality, aes({ x: "month", y: "deaths", fill: "cause" }))
    .geomArea({ alpha: 0.9 })
    // Domain is fixed so cause-to-colour never depends on row order.
    .scaleFillDiscrete({
      domain: ["Disease", "Wounds", "Other"],
      scheme: "stata",
    })
    .scales({ x: { labels: "%b %Y" } })
    .theme("economist")
    .labs({
      title: "Stacked deaths by cause over time",
      subtitle: "Monthly rates split so each band is one cause of death",
      x: "Month",
      y: "Deaths per 1,000 per year",
      fill: "Cause",
    })
    .spec(),
);

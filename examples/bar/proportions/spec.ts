import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { armadaCrews } from "./data.js";

export default defineExample(
  gg(armadaCrews, aes({ x: "squadron", fill: "role", weight: "men" }))
    .geomBar({ position: "fill" })
    .scaleFillDiscrete({
      domain: ["Soldiers", "Sailors"],
      scheme: "fivethirtyeight",
    })
    .scales({ y: { labels: ".0%" } })
    .theme("fivethirtyeight")
    .labs({
      title: "Parts of a whole within each group",
      subtitle: "Share of soldiers and sailors in each squadron",
      x: "Squadron",
      y: "Share of complement",
      fill: "Role",
    })
    .spec(),
);

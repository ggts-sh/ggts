import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { maizeDifferences } from "./data.js";

export default defineExample(
  // The same stairs as line/ecdf, but from precomputed (x, F̂) rows: geom_step
  // with direction hv holds each value until the next observation arrives.
  gg(maizeDifferences, aes({ x: "difference", y: "share" }))
    .geomStep({ direction: "hv", linewidth: 1.8 })
    .geomPoint({ size: 2.6, alpha: 0.85 })
    .theme("classic")
    .labs({
      title: "Step ECDF of paired differences",
      subtitle: "Cross-fertilised height minus self-fertilised",
      x: "Cross-fertilised height less self-fertilised (inches)",
      y: "Share of pairs at or below",
    })
    .spec(),
);

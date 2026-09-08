import { aes, gg, guideColorsteps, scaleColorBinned } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { jevonsTrials } from "./data.js";

export default defineExample(
  gg(jevonsTrials, aes({ x: "actual", y: "estimated", color: "trials" }))
    .geomPoint({ size: 5 })
    // Colour carries a third variable — how often that (actual, estimated)
    // pairing came up across 1,027 throws — rather than restating x or y.
    .scales(
      scaleColorBinned({
        breaks: [0, 5, 20, 60, 130],
        range: ["#d3d3d0", "#8ba89c", "#4f8a6e", "#1e5c43"],
      }),
    )
    .guides({
      color: guideColorsteps({ position: "bottom", direction: "horizontal" }),
    })
    .theme("bw")
    .labs({
      title: "How many items you can tell apart at once",
      subtitle: "Binned colour so nearby values share a fill step",
      x: "Beans actually thrown",
      y: "Beans estimated",
      color: "Trials",
    })
    .spec(),
);

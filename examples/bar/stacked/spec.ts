import { aes, gg, scaleXDiscrete } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { pyxTrial } from "./data.js";

export default defineExample(
  gg(pyxTrial, aes({ x: "bag", fill: "deviation", weight: "count" }))
    // The source is a frequency table, not one row per coin: the weight channel
    // makes the count stat sum counts instead of counting rows, so 72 rows
    // stand in for 10,000 sovereigns.
    .geomBar()
    // Bag labels are numeric-looking strings ("3", "10"), so the band scale is
    // requested explicitly - a bare domain on an inferred continuous x silently
    // drops every bar.
    .scales(scaleXDiscrete({ domain: ["1 and 2", "3", "4", "5", "6", "7", "8", "9", "10"] }))
    .scales({
      fill: {
        type: "ordinal",
        // Deviation is an ordered factor running light to heavy, and flexoki's
        // eight keys line up one-to-one with its eight bins.
        domain: [
          "Below -R",
          "(-R to -.2)",
          "(-.2 to -.1)",
          "(-.1 to 0)",
          "(0 to .1)",
          "(.1 to .2)",
          "(.2 to R)",
          "Above R",
        ],
        scheme: "flexoki",
      },
    })
    .theme("light")
    .labs({
      title: "Stacked counts inside each bag",
      subtitle: "Each bar is one group, split by how far the coins miss standard weight",
      x: "Bag",
      y: "Sovereigns",
      fill: "Deviation",
    })
    .spec(),
);

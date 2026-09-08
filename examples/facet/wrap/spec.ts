import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { familyHeights } from "./data.js";

export default defineExample(
  gg(familyHeights, aes({ x: "child", weight: "n" }))
    // The source is Pearson and Lee's frequency table, not one row per child:
    // the weight channel makes the bin stat sum counts instead of counting
    // rows, so 81 rows stand in for 4,892 measured children.
    .geomHistogram({ bins: 18 })
    .facet({ wrap: "pair", ncol: 2 })
    .theme("ggplot2")
    .labs({
      title: "One panel per parent–child pair type",
      subtitle:
        "Child height histograms for father→son, father→daughter, mother→son, mother→daughter",
      x: "Child's height (inches)",
      y: "Children",
    })
    .spec(),
);

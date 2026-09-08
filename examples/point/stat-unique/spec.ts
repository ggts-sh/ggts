import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { deadlyQuarrels } from "./data.js";

export default defineExample(
  // stat unique keeps the first row per aesthetic combination. Richardson
  // coded one row per pair of belligerents, so a big war arrives as dozens of
  // rows with the same year and the same death toll: 779 rows, 321 marks.
  gg(deadlyQuarrels, aes({ x: "year", y: "magnitude" }))
    .geomPoint({ stat: "unique", size: 3, alpha: 0.8 })
    .theme("classic")
    .labs({
      title: "Collapse duplicate coordinates to unique marks",
      subtitle: "One row per belligerent pair becomes one mark per distinct (year, magnitude)",
      x: "Year the quarrel began",
      y: "Magnitude (log10 killed)",
    })
    .spec(),
);

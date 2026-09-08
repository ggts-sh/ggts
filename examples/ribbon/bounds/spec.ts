import { aes, gg, scaleYSqrt } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { breslauBurials } from "./data.js";

export default defineExample(
  // The band is observed, not modelled: lo and hi are the smallest and largest
  // of the five annual counts Halley recorded at each age, and the line is his
  // five-year average.
  gg(breslauBurials, aes({ x: "age", ymin: "lo", ymax: "hi" }))
    .geomRibbon({ alpha: 0.35, aes: aes({ fill: { value: "#4385be" } }) })
    .geomLine({
      aes: aes({ x: "age", y: "mean", color: { value: "#1a4a6b" } }),
      linewidth: 1.6,
    })
    // 353 burials at age one against single digits past age eighty: on a linear
    // axis the band is invisible everywhere but infancy. A square-root axis
    // keeps every zero (a log axis could not) and lets the whole band read.
    .scales(scaleYSqrt())
    .theme("clean")
    .labs({
      title: "A ribbon for year-to-year range",
      subtitle: "Mean burials by age with a band from the lowest to highest year at each age",
      x: "Age at death",
      y: "Burials per year (square-root scale)",
    })
    .spec(),
);

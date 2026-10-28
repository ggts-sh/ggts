import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { meanHwy, mpg } from "./data.js";

const DRIVES = { f: "Front-wheel drive", r: "Rear-wheel drive", "4": "Four-wheel drive" };

export default defineExample(
  gg(mpg, aes({ x: "class", y: "hwy" }))
    .geomPoint({ size: 2.2, alpha: 0.45 })
    .geomHline({ yintercept: meanHwy, linetype: "dashed" })
    // space "free_x": each column width follows its category count, so
    // every class column is the same width in every drive-train group.
    .facet({
      cols: { field: "drv", levels: ["f", "r", "4"], labels: DRIVES },
      scales: "free_x",
      space: "free_x",
    })
    // Author-given labels name each explicit break, including the mean.
    .scaleYContinuous({
      breaks: [10, 20, meanHwy, 30, 40],
      labels: ["10", "20", `mean ${meanHwy.toFixed(1)}`, "30", "40"],
    })
    .theme("minimal")
    .labs({
      title: "Grid facets sized by category count",
      subtitle: "Highway fuel economy of 234 cars by class; the dashed line is the mean",
      x: "Vehicle class",
      y: "Highway miles per gallon",
    })
    .spec(),
);

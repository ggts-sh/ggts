import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { chocolateBarsSample } from "./data.js";

export default defineExample(
  gg(chocolateBarsSample, aes({ x: "cocoaPercent", y: "rating" }))
    .geomSmooth({ method: "loess", span: 0.75 })
    .geomPoint({ alpha: 0.25, size: 2 })
    .theme("tufte")
    .labs({
      title: "Cocoa percent against bar rating",
      subtitle: "Loess through a sample of chocolate reviews, with a confidence band",
      x: "Cocoa (%)",
      y: "Rating (1–4)",
    })
    .spec(),
);

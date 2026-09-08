import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { shortSample } from "./data.js";

export default defineExample(
  // Thumbnail contract: large Q–Q points only — no reference line — so the
  // cloud mark stays distinct from geom_qq_line at the 96×96 crop.
  gg(shortSample, aes({ sample: "value" }))
    .geomQq({
      size: 6,
      alpha: 0.95,
      aes: aes({ color: { value: "#1a202c" } }),
    })
    .theme("minimal")
    .labs({
      title: "Sparse Q–Q cloud",
      subtitle: "Twelve sample quantiles against the theoretical normal",
      x: "Theoretical quantile",
      y: "Sample quantile",
    })
    .spec(),
);

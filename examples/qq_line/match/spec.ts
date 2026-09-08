import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { shortSample } from "./data.js";

export default defineExample(
  // Thumbnail contract: reference line only — no scatter cloud — so the
  // line mark stays distinct from geom_qq at the 96×96 crop.
  gg(shortSample, aes({ sample: "value" }))
    .geomQqLine({
      linewidth: 3.2,
      alpha: 1,
      aes: aes({ color: { value: "#1a202c" } }),
    })
    .theme("minimal")
    .labs({
      title: "Q–Q reference line",
      subtitle: "Line through the sample/theoretical quartile match",
      x: "Theoretical quantile",
      y: "Sample quantile",
    })
    .spec(),
);

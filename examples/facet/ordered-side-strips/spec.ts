import { aes, gg, guideNone } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { SAMPLE_LABELS, SAMPLES, yeastCounts } from "./data.js";

export default defineExample(
  gg(yeastCounts, aes({ x: "cells", y: "squares", fill: "sample" }))
    .geomCol({ alpha: 0.9 })
    .facet({
      wrap: {
        field: "sample",
        levels: [...SAMPLES],
        labels: { ...SAMPLE_LABELS },
      },
      ncol: 1,
      strip: { position: "left" },
    })
    // Fill comes from the palette rather than a literal hex, but the strips
    // already name every panel — a four-key legend would only repeat them.
    .scales({ fill: { type: "ordinal", domain: [...SAMPLES], scheme: "flexoki" } })
    .guides({ fill: guideNone() })
    .theme("light")
    .labs({
      title: "Facets with ordered side strips",
      subtitle: "Yeast counts under a microscope, one panel per sample (A–D)",
      x: "Cells in a square",
      y: "Squares",
    })
    .spec(),
);

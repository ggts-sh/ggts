import { aes, gg, guideNone, scaleXContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { spacedScores } from "./data.js";

export default defineExample(
  // Thumbnail contract: a handful of long thick bottom ticks — not a dense
  // rule strip — so the rug mark reads at the 96×96 geoms-index crop.
  gg(spacedScores, aes({ x: "score" }))
    .scales({
      ...scaleXContinuous({ limits: [0, 11] }),
    })
    .geomRug({
      sides: "b",
      length: 0.22,
      linewidth: 2.8,
      alpha: 1,
      aes: aes({ color: { value: "#1a202c" } }),
    })
    // y is a placeholder domain for edge ticks only; hide the ladder.
    .guides({ y: guideNone() })
    .theme("minimal")
    .labs({
      title: "Bottom-edge rug ticks",
      subtitle: "Ten long ticks along the panel bottom for each score",
      x: "Score",
    })
    .spec(),
);

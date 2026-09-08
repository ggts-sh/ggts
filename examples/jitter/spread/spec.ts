import { aes, gg, scaleXDiscrete, scaleYContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { sparseGroups } from "./data.js";

export default defineExample(
  // Thumbnail contract: a few large points per category with wide horizontal
  // jitter — not a dense menu cloud — so the spread reads at 96×96.
  gg(sparseGroups, aes({ x: "group", y: "value" }))
    .scales({
      ...scaleXDiscrete({ domain: ["A", "B", "C"] }),
      ...scaleYContinuous({ limits: [0, 10] }),
    })
    .geomJitter({
      width: 0.35,
      height: 0,
      seed: 7,
      size: 6.5,
      alpha: 0.9,
      aes: aes({ color: { value: "#1a202c" } }),
    })
    .theme("minimal")
    .labs({
      title: "Jittered points by group",
      subtitle: "Sideways jitter unstacks points",
      x: "Group",
      y: "Value",
    })
    .spec(),
);

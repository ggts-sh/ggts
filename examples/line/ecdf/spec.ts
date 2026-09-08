import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { deadlyQuarrels } from "./data.js";

export default defineExample(
  // stat ecdf computes F̂ from the raw sample; curve step-hv draws the stairs
  // right-continuous, and pad extends them to the panel edges at 0 and 1.
  gg(deadlyQuarrels, aes({ x: "magnitude" }))
    .geomLine({ stat: "ecdf", curve: "step-hv", linewidth: 1.8, pad: true })
    .theme("classic")
    .labs({
      title: "Empirical distribution of event sizes",
      subtitle: "How many wars reach each magnitude on a step from zero to one",
      x: "Magnitude (log10 killed)",
      y: "Share of quarrels at or below",
    })
    .spec(),
);

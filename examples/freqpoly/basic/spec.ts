import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { michelson } from "./data.js";

export default defineExample(
  // Same Michelson sample as the histogram specimen — bin centers connected
  // as a line (ggplot2 geom_freqpoly) instead of bars.
  gg(michelson, aes({ x: "velocity" }))
    .geomFreqpoly({ binwidth: 40, linewidth: 1.4 })
    .geomRule({ xintercept: 734.5, linewidth: 1.2, aes: aes({ color: { value: "#d14d41" } }) })
    .theme("fivethirtyeight")
    .labs({
      title: "Frequency polygon through bin centres",
      subtitle: "Same speed-of-light runs as the histogram, joined at the tops of the bins",
      x: "Velocity (km/s − 299,000)",
      y: "Runs",
    })
    .spec(),
);

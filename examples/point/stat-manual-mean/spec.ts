import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { michelsonRuns } from "./data.js";

export default defineExample(
  // stat manual with fun "mean" collapses each group to one synthesized point.
  // The faint marks are the twenty measurements of a run; the solid one is
  // that run's mean, which is the number his worry about drift is about.
  gg(michelsonRuns, aes({ x: "order", y: "velocity", color: "run" }))
    .geomPoint({ size: 2.4, alpha: 0.35 })
    .geomPoint({ stat: "manual", fun: "mean", size: 6, alpha: 0.95 })
    .scales({ color: { type: "ordinal", scheme: "observable10" } })
    .theme("classic")
    .labs({
      title: "Raw points with a manual mean per group",
      subtitle: "Twenty readings per run",
      x: "Measurement, 1 to 100",
      y: "Speed of light, km/s less 299,000",
      color: "Run",
    })
    .spec(),
);

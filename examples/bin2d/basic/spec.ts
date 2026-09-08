import { aes, gg, scaleFillContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { oldFaithful } from "./data.js";

export default defineExample(
  gg(oldFaithful, aes({ x: "duration", y: "waiting" }))
    .geomBin2d({ bins: 16 })
    .scales(scaleFillContinuous({ scheme: "viridis" }))
    .theme("minimal")
    .labs({
      title: "Two-dimensional bins for a dense cloud",
      subtitle: "Waiting time against eruption length for Old Faithful",
      x: "Eruption length (minutes)",
      y: "Wait for the next eruption (minutes)",
      fill: "Eruptions",
    })
    .spec(),
);

import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { michelson } from "./data.js";

export default defineExample(
  gg(michelson, aes({ sample: "velocity" }))
    .geomQq({ size: 2.5, alpha: 0.85 })
    .geomQqLine({ linewidth: 1.2, alpha: 0.7 })
    .theme("classic")
    .labs({
      title: "Sample quantiles against the normal",
      subtitle:
        "A hundred experimental runs compared with the normal they would follow under pure chance",
      x: "Normal quantile",
      y: "Speed of light, km/s less 299,000",
    })
    .spec(),
);

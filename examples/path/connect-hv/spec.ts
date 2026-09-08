import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { retreatCold } from "./data.js";

export default defineExample(
  // stat connect turns each pair of successive points into real path vertices.
  // "hv" goes horizontal first, then vertical: the last reading is carried
  // west until the next one is taken, instead of guessing a gradual slide.
  gg(retreatCold, aes({ x: "long", y: "temp" }))
    .geomPath({
      stat: "connect",
      connection: "hv",
      linewidth: 2.5,
      alpha: 0.95,
    })
    .geomPoint({ size: 3.5, alpha: 0.85 })
    .scales({ x: { reverse: true } })
    .theme("classic")
    .labs({
      title: "The cold Minard drew under the retreat",
      subtitle: "Nine readings between Moscow and Wilna, each carried west until the next",
      x: "Longitude east",
      y: "Degrees Réaumur",
    })
    .spec(),
);

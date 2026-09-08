import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { earthDensity, waterDensity } from "./data.js";

export default defineExample(
  // geom_blank trains the scales from its own rows and draws nothing. Here it
  // carries the density of water, so the axis reaches the number Cavendish's
  // result is quoted against without a mark pretending to be a measurement.
  gg(earthDensity, aes({ x: "trial", y: "density" }))
    .geomPoint({ size: 3.5, alpha: 0.9 })
    .geomBlank({ data: waterDensity, aes: aes({ x: "trial", y: "density" }) })
    .theme("classic")
    .labs({
      title: "Expanded domain with no marks",
      subtitle: "Domain opened so a known constant sits inside the frame",
      x: "Determination",
      y: "Density of the earth, water = 1",
    })
    .spec(),
);

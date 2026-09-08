import { aes, gg, scaleColorSteps } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { londonDistricts } from "./data.js";

export default defineExample(
  // A binned ramp reads as bands rather than a gradient, which suits a rate
  // people argue about in brackets: these are the poorest districts, and they
  // are also the lowest-lying ones.
  gg(londonDistricts, aes({ x: "elevation", y: "deathRate", color: "poorRate" }))
    .geomPoint({ size: 4 })
    .scales(scaleColorSteps({ low: "#132B43", high: "#56B1F7" }))
    .theme("minimal")
    .labs({
      title: "Cholera fell away with height above the Thames",
      subtitle: "38 London districts in 1849, shaded in bands by their poor rate",
      x: "Elevation above high water (feet)",
      y: "Cholera deaths per 10,000",
      color: "Poor rate",
    })
    .spec(),
);

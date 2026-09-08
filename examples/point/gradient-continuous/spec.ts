import { aes, gg, scaleColorGradient } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { parisRegister } from "./data.js";

export default defineExample(
  // A two-stop continuous ramp: every year lies on top of every other, so the
  // colour is the only thing telling 1812 from 1854.
  gg(parisRegister, aes({ x: "month", y: "registered", color: "year" }))
    .geomPoint({ size: 2.6, alpha: 0.85 })
    .scales({
      ...scaleColorGradient({ low: "#132B43", high: "#56B1F7" }),
      x: { breaks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    })
    .theme("minimal")
    .labs({
      title: "Many years folded onto one seasonal axis",
      subtitle: "Colour tracks year",
      x: "Month",
      y: "Women on the register",
      color: "Year",
    })
    .spec(),
);

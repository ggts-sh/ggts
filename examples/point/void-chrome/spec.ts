import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { britishExports } from "./data.js";

export default defineExample(
  // theme_void takes away every axis, tick, grid line and panel border and
  // leaves the marks. What is left is a sparkline: shape without magnitude,
  // which is the right chart when it sits inside a sentence rather than on a
  // page of its own.
  gg(britishExports, aes({ x: "year", y: "value" }))
    .geomLine({ linewidth: 1.5 })
    .geomPoint({ size: 2.4, alpha: 0.8 })
    .theme("void")
    .labs({
      title: "A sparkline without axes or grid",
      subtitle: "Exports over decades reduced to a thin line with no chart furniture",
      x: "",
      y: "",
    })
    .spec(),
);

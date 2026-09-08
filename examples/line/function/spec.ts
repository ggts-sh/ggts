import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { chestSizes } from "./data.js";

export default defineExample(
  // geom_function evaluates a portable named function on a grid, so the curve
  // is the claim and the points are the evidence. Quetelet's classes are one
  // inch wide, which is what makes a share directly comparable with a density.
  gg(chestSizes, aes({ x: "chest" }))
    .geomPoint({ aes: { y: "share" }, size: 3 })
    .geomFunction({
      fun: "dnorm",
      n: 201,
      xlim: [32, 49],
      args: { mean: 39.83, sd: 2.05 },
      linewidth: 2,
      alpha: 0.95,
    })
    .theme("classic")
    .labs({
      title: "Observed counts against a fitted curve",
      subtitle: "Chest measurements with a normal of the same mean and spread drawn through them",
      x: "Chest circumference (inches)",
      y: "Share of soldiers",
    })
    .spec(),
);

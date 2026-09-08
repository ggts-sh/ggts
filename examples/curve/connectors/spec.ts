import { aes, gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { darwinMaize } from "./data.js";

export default defineExample(
  // Curved connectors (ggplot2 geom_curve): same (x,y)→(xend,yend) contract as
  // segment, but tessellated as a quadratic Bezier in panel px so curvature is
  // aspect-safe. Here each curve runs self → cross for Darwin's maize pairs.
  gg(darwinMaize, aes({ x: "pair", y: "self", xend: "pair", yend: "cross", color: "winner" }))
    .geomCurve({ linewidth: 2, lineend: "round", curvature: 0.4, alpha: 0.9 })
    .geomPoint({ size: 2.5, alpha: 0.6 })
    .geomPoint({ aes: { x: "pair", y: "cross" }, size: 3.2 })
    .scaleColorDiscrete({
      domain: ["Cross-fertilised taller", "Self-fertilised taller"],
      scheme: "wsj_red_green",
    })
    .theme("classic")
    .labs({
      title: "Paired points joined by a curve",
      subtitle: "Each curve runs from the self-fertilised plant to its cross-fertilised pair",
      x: "Pair",
      y: "Final height (inches)",
      color: "",
    })
    .spec(),
);

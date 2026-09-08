import { aes, gg, guideNone } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { pumpNeighbourhoods, waterPumps } from "./data.js";

export default defineExample(
  // Closed filled polygons in data order per group: the vertices of each ring
  // arrive in winding order and the path closes itself.
  gg(pumpNeighbourhoods, aes({ x: "x", y: "y", group: "pump", fill: "pump" }))
    .geomPolygon({ alpha: 0.55, linewidth: 1.2 })
    .geomPoint({
      data: waterPumps,
      aes: aes({ x: "x", y: "y", color: { value: "#111827" } }),
      size: 3.6,
      shape: "cross",
    })
    // Thirteen fills would be a legend taller than the map, and the crosses
    // already say where the pumps are.
    .guides({ fill: guideNone() })
    .coordFixed()
    .theme("classic")
    .labs({
      title: "Which pump was nearest",
      subtitle: "Soho split into the thirteen areas closest to each public pump, 1854",
      x: "Map east",
      y: "Map north",
    })
    .spec(),
);

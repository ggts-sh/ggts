import { aes, gg, scaleFillContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { neighbourhoodDeaths, pumpNeighbourhoods } from "./data.js";

export default defineExample(
  // geom_map joins value rows to a fortified map on map_id, so the table
  // carries the numbers and the map carries only the shapes.
  gg(neighbourhoodDeaths, aes({ map_id: "pump", fill: "deaths" }))
    .geomMap({
      map: { values: pumpNeighbourhoods },
      mapId: "pump",
      linewidth: 1.2,
      alpha: 0.95,
    })
    .scales(scaleFillContinuous({ scheme: "viridis" }))
    .coordFixed()
    .theme("map")
    .labs({
      title: "359 of 578 deaths were nearest the Broad Street pump",
      subtitle: "The 1854 Soho outbreak counted into the area closest to each public pump",
      fill: "Deaths",
    })
    .spec(),
);
